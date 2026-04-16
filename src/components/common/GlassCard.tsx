import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  glow?: 'blue' | 'green' | 'accent' | null;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  interactive = false,
  glow = null,
  onClick,
  style,
}) => {
  const classes = [
    'glass-card',
    interactive ? 'glass-card--interactive' : '',
    glow === 'blue' ? 'glass-card--glow-blue' : '',
    glow === 'green' ? 'glass-card--glow-green' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} style={style}>
      {children}
    </div>
  );
};
