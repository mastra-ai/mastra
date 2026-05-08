import { useId } from 'react';

import { cn } from '@/lib/utils';

import './brand-loader.css';

export type BrandLoaderProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  'aria-label'?: string;
};

const sizeClasses = {
  sm: 'w-6',
  md: 'w-8',
  lg: 'w-10',
};

/** Thinner strokes on small sizes so ridges don't visually dominate the disks. */
const strokeBySize = {
  sm: 2.2,
  md: 2.5,
  lg: 2.9,
};

/** Slightly smaller bubbles on small sizes so disks don't swallow the ridges at low pixel counts. */
const bubbleBySize = {
  sm: 4.3,
  md: 4.4,
  lg: 4.498,
};

function BrandLoader({ className, size = 'md', 'aria-label': ariaLabel = 'Loading' }: BrandLoaderProps) {
  const reactId = useId();
  const filterId = `brand-loader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const r = bubbleBySize[size];

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn('brand-loader inline-block text-neutral6', sizeClasses[size], className)}
      style={{ ['--brand-loader-stroke' as string]: strokeBySize[size] }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 21" aria-hidden="true">
        <defs>
          {/* Gooey merge: blur + sharp alpha threshold fuses overlapping shapes into a single blob. */}
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            {/* stdDeviation: blur radius. Larger = bigger fillet/roundness at line↔disk junction. */}
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.9" />
            {/*
             * outAlpha = M·α − K. Opaque where α ≥ K/M. Transition band = 1/M.
             * M=11, K=4.3 → cutoff 0.391, band 0.091 (soft, rounded edge, big fillet).
             */}
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 11 -4.3" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <line className="brand-loader-ln23" x1="10.387" y1="4.498" x2="16.899" y2="16.192" />
          <line className="brand-loader-ln34" x1="16.899" y1="16.192" x2="22.815" y2="4.56" />
          <line className="brand-loader-ln45" x1="22.815" y1="4.56" x2="28.57" y2="16.192" />
          <circle className="brand-loader-b1" cx="4.498" cy="16.192" r={r} />
          <circle className="brand-loader-b2" cx="10.387" cy="4.498" r={r} />
          <circle className="brand-loader-b3" cx="16.899" cy="16.192" r={r} />
          <circle className="brand-loader-b4" cx="22.815" cy="4.56" r={r} />
          <circle className="brand-loader-b5" cx="28.57" cy="16.192" r={r} />
        </g>
      </svg>
    </div>
  );
}

export { BrandLoader };
