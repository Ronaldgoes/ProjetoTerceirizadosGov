import { BrowserRouter, Route, Routes } from "react-router-dom";
import CusteioDashboard from "../pages/CusteioDashboard";
import ContractsDashboardPage from "../pages/ContractsDashboardPage";
import OrgansHomePage from "../pages/OrgansHomePage";

// Ponto central das rotas do sistema.
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrgansHomePage />} />
        <Route path="/analise-custeio" element={<CusteioDashboard />} />
        <Route path="/gestao/:orgaoId/*" element={<ContractsDashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
