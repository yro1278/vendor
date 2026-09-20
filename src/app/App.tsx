import VendorManagement, { VendorLogin } from "./VendorModule";
import { useAdminSession, useVendorData } from "./vendor-data";
import { api, clearToken, getToken, setUnauthorizedHandler } from "./api";
import { useEffect } from "react";

export default function App() {
  const { data, actions, loading, error, sessionExpired, refresh } = useVendorData();
  const [isAdmin, setAdmin] = useAdminSession();

  useEffect(() => {
    setUnauthorizedHandler(() => setAdmin(false));
    return () => setUnauthorizedHandler(null);
  }, [setAdmin]);

  useEffect(() => {
    if (sessionExpired) {
      clearToken();
      setAdmin(false);
    }
  }, [sessionExpired, setAdmin]);

  if (!isAdmin) {
    return (
      <VendorLogin
        notice={sessionExpired ? "Your session expired or is no longer valid. Please sign in again." : undefined}
        onLogin={() => {
          setAdmin(true);
          void refresh();
        }}
      />
    );
  }

  return (
    <VendorManagement
      data={data}
      actions={actions}
      loading={loading}
      error={error}
      onLogout={() => {
        setAdmin(false);
        if (getToken()) void api.logout().catch(() => undefined);
        clearToken();
      }}
    />
  );
}