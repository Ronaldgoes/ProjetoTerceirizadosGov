import AppRouter from "./app/AppRouter";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { useAlertsRunner } from "./hooks/useAlerts";
import "./styles/Dashboard.css";

function AppShell() {
  const { loading } = useAuth();

  useAlertsRunner();

  if (loading) {
    return <div className="bi-loading">Verificando acesso...</div>;
  }

  return <AppRouter />;
}

// App.jsx fica leve e serve apenas como entrada visual da aplicação.
export default function App() {
  return (
    <AuthProvider>
      <AppErrorBoundary>
        <AppShell />
      </AppErrorBoundary>
    </AuthProvider>
  );
}
