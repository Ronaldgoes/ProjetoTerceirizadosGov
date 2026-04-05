import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminPage from "../pages/AdminPage";
import CusteioDashboard from "../pages/CusteioDashboard";
import ContractsDashboardPage from "../pages/ContractsDashboardPage";
import LoginPage from "../pages/LoginPage";
import MonitoringPage from "../pages/MonitoringPage";
import OrgansHomePage from "../pages/OrgansHomePage";

// Ponto central das rotas do sistema.
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrgansHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/analise-custeio"
          element={(
            <ProtectedRoute>
              <CusteioDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/monitoramento"
          element={(
            <ProtectedRoute>
              <MonitoringPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/gestao/:orgaoId/*"
          element={(
            <ProtectedRoute>
              <ContractsDashboardPage />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}
