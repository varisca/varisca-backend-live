import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ResendCountdown from '../components/ResendCountdown';
import { saveToken, sendOtp, verifyOtp } from '../services/authApi';

export default function OtpVerifyPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const phone = state?.phone || '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(state?.resendAfterSeconds || 30);

  useEffect(() => {
    if (!phone) navigate('/login-phone');
  }, [phone, navigate]);

  const onVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await verifyOtp(phone, otp);
      const token = response.data?.data?.token;
      if (token) saveToken(token);
      setSuccess('OTP verified. Redirecting...');
      setTimeout(() => navigate('/account'), 500);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResendLoading(true);
    setError('');
    try {
      const response = await sendOtp(phone);
      setCooldown(response.data?.data?.resendAfterSeconds || 30);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend OTP.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Verify OTP</h1>
        <p>Enter the 6-digit OTP sent to {phone}.</p>
        <form onSubmit={onVerify}>
          <label htmlFor="otp">One-Time Password</label>
          <input
            id="otp"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit OTP"
            required
          />
          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">{success}</p>}
          <button className="btn" type="submit" disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
        <ResendCountdown seconds={cooldown} onResend={onResend} disabled={resendLoading} />
      </section>
    </main>
  );
}
