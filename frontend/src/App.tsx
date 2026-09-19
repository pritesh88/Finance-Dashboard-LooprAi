import { Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { AlertChips } from './components/AlertChips';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

function Gate() {
  const { status } = useAuth();

  if (status === 'checking') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  return status === 'signed-in' ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AlertProvider>
      <AlertChips />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </AlertProvider>
  );
}
