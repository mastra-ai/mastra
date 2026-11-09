import type { CSSProperties } from 'react';
import { cn } from '@/utils/cn';

interface ProviderLogoMonogramProps {
  providerId: string;
  className?: string;
  style?: CSSProperties;
}

export const ProviderLogoMonogram = ({ providerId, className, style }: ProviderLogoMonogramProps) => {
  const letter = providerId.match(/[a-z0-9]/i)?.[0]?.toUpperCase();

  return (
    <svg
      data-slot="provider-monogram"
      role={providerId ? 'img' : undefined}
      aria-label={providerId ? `${providerId} logo` : undefined}
      aria-hidden={providerId ? undefined : true}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      style={style}
    >
      <rect x="0.5" y="0.5" width="23" height="23" rx="4" className="fill-muted stroke-border" />
      {letter && (
        <text
          x="12"
          y="12"
          dy="0.35em"
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          className="fill-muted-foreground"
        >
          {letter}
        </text>
      )}
    </svg>
  );
};
