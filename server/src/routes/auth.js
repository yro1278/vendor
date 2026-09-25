import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { asyncHandler, httpError } from "../util.js";
import { ALLOWED_VENDOR_ROLES } from "../db/constants.js";
import { logAudit } from "../audit.js";
import { createSession, requireAuth, revokeSession } from "../auth.js";

const router = Router();

/* Returns the authenticated user's current identity — including role —
   so the frontend can re-sync its role-based navigation on reload without
   trusting anything stored in the browser. */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, username, display_name, role, vendor_id FROM users WHERE id = ?",
      [req.tokenPayload.sub]
    );
    if (rows.length === 0) throw httpError(401, "Unauthorized.");
    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        role: u.role,
        vendorId: u.vendor_id,
      },
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!username || !password) throw httpError(400, "Username and password are required.");

    const err401 = httpError(401, "Invalid username or password.");
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.vendor_id, v.is_active AS vendor_active
       FROM users u
       LEFT JOIN vendors v ON v.id = u.vendor_id
       WHERE u.username = ?`,
      [username]
    );
    if (rows.length === 0) throw err401;
    const user = rows[0];

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw err401;

    if (!ALLOWED_VENDOR_ROLES.includes(user.role)) {
      throw httpError(403, "Your account does not have access to Vendor Management.");
    }
    if (!user.vendor_id) {
      throw httpError(403, "No vendor account is assigned to this user.");
    }
    if (Number(user.vendor_active) !== 1) {
      throw httpError(403, "The vendor account is inactive.");
    }

    const jti = randomUUID();
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        vendorId: user.vendor_id,
        jti,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    await createSession({ jti, userId: user.id, vendorId: user.vendor_id });

    await logAudit({
      user: { sub: user.id, vendorId: user.vendor_id },
      action: "login",
      entityType: "session",
      detail: `${user.display_name || user.username} signed in.`,
      ip: req.ip,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        vendorId: user.vendor_id,
      },
    });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = req.tokenPayload;
    await revokeSession(payload);
    await logAudit({
      user: { sub: payload?.sub ?? null, vendorId: payload?.vendorId ?? null },
      action: "logout",
      entityType: "session",
      detail: "Signed out; session token revoked.",
      ip: req.ip,
    });
    res.json({ ok: true, message: "Signed out." });
  })
);

export default router;