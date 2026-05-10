import { useEffect, useState } from 'react';

export default function ResendCountdown({ seconds, onResend, disabled }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return (
    <div className="countdown-wrap">
      {remaining > 0 ? (
        <p className="countdown-text">Resend OTP in {remaining}s</p>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={onResend} disabled={disabled}>
          Resend OTP
        </button>
      )}
    </div>
  );
}
