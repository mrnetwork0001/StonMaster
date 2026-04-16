import React from 'react';
import { Link } from 'react-router-dom';

interface ModuleCardProps {
  to: string;
  variant: 'sweep' | 'earn' | 'share';
  icon: string;
  title: string;
  description: string;
  cta: string;
  stat?: string;
  statLabel?: string;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  to,
  variant,
  icon,
  title,
  description,
  cta,
  stat,
  statLabel,
}) => {
  return (
    <Link to={to} className={`module-card module-card--${variant}`}>
      <div className="module-card-icon">{icon}</div>
      <h3 className="module-card-title">{title}</h3>
      <p className="module-card-desc">{description}</p>
      {stat && (
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}>
            {stat}
          </span>
          {statLabel && (
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {statLabel}
            </span>
          )}
        </div>
      )}
      <div className="module-card-cta">
        {cta} <span>→</span>
      </div>
    </Link>
  );
};
