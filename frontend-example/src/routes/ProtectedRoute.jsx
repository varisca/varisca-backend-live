import { Navigate } from 'react-router-dom';
import { getToken } from '../services/authApi';

export default function ProtectedRoute({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/login-phone" replace />;
  return children;
}
