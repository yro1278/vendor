import VendorManagement, { VendorLogin } from "./VendorModule";
import { useSessionRole, useVendorData } from "./vendor-data";
import { api, ApiError, clearToken, getToken, setSessionUser, setUnauthorizedHandler } from "./api";
import { useEffect, useState } from "react";

export default function App() {
  const { data, actions, loading, error, sessionExpired, refresh } = useVendorData();
  const [role, setRole] = useSessionRole();
  const [idleNotice, setIdleNotice] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setRole(null));
    return () => setUnauthorizedHandler(null);
  }, [setRole]);

  useEffect(() => {
    if (sessionExpired) {
      clearToken();
      setRole(null);
    }
  }, [sessionExpired, setRole]);

  /* Re-sync the role from the server on reload so stale browser storage can
     never widen the authenticated scope. */
  useEffect(() => {
    if (!role || !getToken()) return;
    let cancelled = false;
    api.me()
      .then((res) => {
        if (cancelled) return;
        setRole(res.user.role);
        setSessionUser(res.user);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status !== 0) setRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [role, setRole]);

  if (!role) {
    return (
      <VendorLogin
        notice={idleNotice
          ? "Your session has expired due to inactivity. Please log in again."
          : sessionExpired
            ? "Your session expired or is no longer valid. Please sign in again."
            : undefined}
        onLogin={(newRole) => {
          setIdleNotice(false);
          setRole(newRole);
          void refresh();
        }}
      />
    );
  }

  return (
    <VendorManagement
      role={role}
      data={data}
      actions={actions}
      loading={loading}
      error={error}
      onLogout={() => {
        setRole(null);
        if (getToken()) void api.logout().catch(() => undefined);
        clearToken();
      }}
      onSessionExpired={() => setIdleNotice(true)}
    />
  );
}