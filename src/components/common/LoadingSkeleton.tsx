import React from 'react';

interface LoadingSkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  width = '100%',
  height = '14px',
  borderRadius,
  className = '',
  style,
}) => (
  <div
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius, ...style }}
  />
);

interface SkeletonGroupProps {
  rows?: number;
  spacing?: string;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  rows = 3,
  spacing = 'var(--space-3)',
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing }}>
    {Array.from({ length: rows }).map((_, i) => (
      <LoadingSkeleton
        key={i}
        width={i === 0 ? '80%' : i === rows - 1 ? '40%' : '60%'}
      />
    ))}
  </div>
);
