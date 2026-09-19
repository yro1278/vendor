import VendorManagement, { VendorLogin } from "./VendorModule";
import { useAdminSession, useVendorData } from "./vendor-data";

export default function App() {
  const { data, actions } = useVendorData();
  const [isAdmin, setAdmin] = useAdminSession();

  if (!isAdmin) {
    return <VendorLogin onLogin={() => setAdmin(true)} />;
  }

  return <VendorManagement data={data} actions={actions} onLogout={() => setAdmin(false)} />;
}