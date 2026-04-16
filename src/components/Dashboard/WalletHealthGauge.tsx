import React, { useMemo } from 'react';

interface WalletHealthGaugeProps {
  score: number; // 0–100 (100 = max clutter)
  label?: string;
}

export const WalletHealthGauge: React.FC<WalletHealthGaugeProps> = ({
  score,
  label = 'Wallet Health',
}) => {
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const healthScore = 100 - score; // invert: 0 clutter = 100 health
  const offset = circumference - (healthScore / 100) * circumference;

  const color = useMemo(() => {
    if (healthScore >= 80) return 'var(--color-success)';
    if (healthScore >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
  }, [healthScore]);

  const status = useMemo(() => {
    if (healthScore >= 80) return 'Clean';
    if (healthScore >= 50) return 'Moderate';
    return 'Cluttered';
  }, [healthScore]);

  return (
    <div className="gauge-container">
      <div className="gauge-ring">
        <svg viewBox="0 0 200 200">
          <circle
            className="gauge-track"
            cx="100"
            cy="100"
            r={radius}
          />
          <circle
            className="gauge-fill"
            cx="100"
            cy="100"
            r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="gauge-label">
          <div className="gauge-value" style={{ color }}>
            {healthScore}
          </div>
          <div className="gauge-subtitle">{status}</div>
        </div>
      </div>
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        fontWeight: 500,
      }}>
        {label}
      </div>
    </div>
  );
};
