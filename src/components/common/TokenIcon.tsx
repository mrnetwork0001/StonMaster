import React, { useState } from 'react';

interface TokenIconProps {
  /** URL string (https://) or emoji fallback */
  src?: string;
  symbol?: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Renders a real token logo when `src` is a URL, or a styled letter-abbrev
 * fallback when the image fails or src is empty/emoji.
 */
export const TokenIcon: React.FC<TokenIconProps> = ({ src, symbol = '?', size = 32, style }) => {
  const [errored, setErrored] = useState(false);

  const isUrl = src && (src.startsWith('http') || src.startsWith('data:image'));

  if (isUrl && !errored) {
    return (
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        onError={() => setErrored(true)}
        style={{
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  // Fallback: circle with first 2 letters of symbol
  const abbrev = symbol.slice(0, 2).toUpperCase();
  const hue = Array.from(symbol).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, hsl(${hue}, 65%, 48%), hsl(${(hue + 40) % 360}, 65%, 58%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 800,
        color: '#fff',
        flexShrink: 0,
        letterSpacing: '-0.03em',
        ...style,
      }}
    >
      {abbrev}
    </div>
  );
};
