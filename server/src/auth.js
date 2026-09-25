import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { httpError, toDbDateTime } from "./util.js";
import { ALLOWED_VENDOR_ROLES } from "./db/constants.js";

/* Verifies the JWT is well-formed, not expired, and not revoked.
   Only 401 here: an absent/bad/expired/revoked token is authentication,
   not authorization. */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw httpError(401, "Unauthorized.");

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      throw httpError(401, "Unauthorized or expired session.");
    }

    if (payload.jti) {
      const [revoked] = await pool.query(
        "SELECT 1 FROM revoked_tokens WHERE jti = ? AND expires_at > NOW() LIMIT 1",
        [payload.jti]
      );
      if (revoked.length > 0) throw httpError(401, "Session has been ended. Please sign in again.");
    }

    req.tokenPayload = payload;
    return next();
  } catch (err) {
    return next(err);
  }
}

/* Route-level role gate. Must run after requireVendor so req.user.role is
   populated from the database (never from JWT claims). Passing one or more
   allowed role values authorizes the route. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(httpError(403, "You do not have permission to access this feature."));
    }
    return next();
  };
}

/* Registers a new server-side session (sliding inactivity window).
   Call once right after a successful sign-in. */
export async function createSession({ jti, userId, vendorId }) {
  await pool.query(
    `INSERT INTO sessions (jti, user_id, vendor_id, last_seen, expires_at)
     VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [jti, userId, vendorId, config.session.timeoutMinutes]
  );
}

/* Permanently invalidates a token by moving its jti to the revoked list and
   dropping its session row, so it can never authenticate again. */
export async function revokeSession(payload) {
  if (!payload?.jti) return;
  let expires = new Date(Date.now() + 24 * 3600 * 1000);
  if (payload.exp) {
    const exp = new Date(payload.exp * 1000);
    if (!Number.isNaN(+exp) && payload.exp > Math.floor(Date.now() / 1000)) expires = exp;
  }
  await pool.query(
    "INSERT IGNORE INTO revoked_tokens (jti, user_id, expires_at, revoked_at) VALUES (?, ?, ?, NOW())",
    [payload.jti, payload.sub, toDbDateTime(expires)]
  );
  await pool.query("DELETE FROM sessions WHERE jti = ?", [payload.jti]);
}

/* Authorization + identity for the Vendor Management module:
   - the user must still exist (else 401 — session no longer valid)
   - the user role must be allowed vendor access (else 403)
   - the user must belong to a vendor account (else 403)
   - the vendor account must be active (else 403)
   - the server-side session must be within its 30-minute inactivity window
     (else the token is revoked and the request gets 401)

   req.user is rebuilt FROM THE DATABASE every request so role/vendor changes
   take effect immediately — never relies on the raw JWT claims for RBAC. */
export async function requireVendor(req, _res, next) {
  try {
    const payload = req.tokenPayload;
    if (!payload || !payload.sub) throw httpError(401, "Unauthorized.");

    /* 30-minute inactivity enforcement (sliding window). A protected vendor
       request only succeeds while the session keeps getting bumped; when the
       window lapses the token is revoked and every later call is denied. */
    if (payload.jti) {
      const [res] = await pool.query(
        `UPDATE sessions
         SET last_seen = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
         WHERE jti = ? AND expires_at > NOW()
           AND (user_id IS NULL OR user_id = ?)`,
        [config.session.timeoutMinutes, payload.jti, payload.sub]
      );
      if (res.affectedRows === 0) {
        const [sessionRows] = await pool.query("SELECT expires_at FROM sessions WHERE jti = ?", [payload.jti]);
        if (sessionRows.length === 0) {
          throw httpError(401, "Your session is no longer valid. Please sign in again.");
        }
        const expTs = new Date(String(sessionRows[0].expires_at)).getTime();
        const expired = Number.isNaN(expTs) || expTs <= Date.now();
        if (expired) {
          await revokeSession(payload);
          throw httpError(401, "Session expired due to inactivity. Please sign in again.");
        }
        throw httpError(401, "Session mismatch. Please sign in again.");
      }
    }

    const [users] = await pool.query(
      "SELECT u.id, u.username, u.display_name, u.role, u.vendor_id, v.is_active AS vendor_active FROM users u LEFT JOIN vendors v ON v.id = u.vendor_id WHERE u.id = ?",
      [payload.sub]
    );
    if (users.length === 0) throw httpError(401, "Unauthorized — account no longer exists.");

    const user = users[0];
    if (!ALLOWED_VENDOR_ROLES.includes(user.role)) {
      throw httpError(403, "Your account does not have access to Vendor Management.");
    }
    if (!user.vendor_id) {
      throw httpError(403, "No vendor account is assigned to this user.");
    }
    if (Number(user.vendor_active) !== 1) {
      throw httpError(403, "The vendor account is inactive.");
    }

    req.user = { sub: Number(user.id), username: user.username, displayName: user.display_name ?? user.username, role: user.role, vendorId: String(user.vendor_id) };
    return next();
  } catch (err) {
    return next(err);
  }
}