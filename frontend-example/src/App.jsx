import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import PhoneLoginPage from './pages/PhoneLoginPage';
import OtpVerifyPage from './pages/OtpVerifyPage';
import AccountPage from './pages/AccountPage';
import ProtectedRoute from './routes/ProtectedRoute';
import './styles.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login-phone" replace />} />
        <Route path="/login-phone" element={<PhoneLoginPage />} />
        <Route path="/verify-otp" element={<OtpVerifyPage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
