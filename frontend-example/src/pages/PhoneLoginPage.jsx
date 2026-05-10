import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp } from '../services/authApi';

export default function PhoneLoginPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await sendOtp(phone);
      navigate('/verify-otp', {
        state: {
          phone,
          resendAfterSeconds: response.data?.data?.resendAfterSeconds || 30,
        },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Login With Mobile OTP</h1>
        <p>Use your registered mobile number to continue.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="phone">Mobile Number</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            autoComplete="tel"
            required
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      </section>
    </main>
  );
}
