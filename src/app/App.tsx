import { useState } from "react";
import SupplierPortal, { SupplierLogin } from "./SupplierPortal";

const SESSION_KEY = "trim_vendor_supplier_session";

export default function App() {
  const [session, setSession] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });

  const handleLogin = (id: string) => {
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      /* ignore */
    }
    setSession(id);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  };

  if (!session) {
    return <SupplierLogin onLogin={handleLogin} />;
  }

  return <SupplierPortal supplierId={session} onLogout={handleLogout} />;
}
