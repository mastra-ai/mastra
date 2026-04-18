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
  md: 'w-10',
  lg: 'w-16',
};

function BrandLoader({ className, size = 'md', 'aria-label': ariaLabel = 'Loading' }: BrandLoaderProps) {
  const reactId = useId();
  const filterId = `brand-loader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn('brand-loader inline-block text-neutral6', sizeClasses[size], className)}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 34 21"
        className="block w-full h-auto overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.55" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <line className="brand-loader-ln23" x1="10.4" y1="4.5" x2="16.8" y2="16.2" />
          <line className="brand-loader-ln34" x1="16.8" y1="16.2" x2="23.2" y2="4.5" />
          <line className="brand-loader-ln45" x1="23.2" y1="4.5" x2="29.5" y2="16.2" />
          <circle className="brand-loader-b1" cx="4.5" cy="16.2" r="4.5" />
          <circle className="brand-loader-b2" cx="10.4" cy="4.5" r="4.5" />
          <circle className="brand-loader-b3" cx="16.8" cy="16.2" r="4.5" />
          <circle className="brand-loader-b4" cx="23.2" cy="4.5" r="4.5" />
          <circle className="brand-loader-b5" cx="29.5" cy="16.2" r="4.5" />
        </g>
      </svg>
    </div>
  );
}

export { BrandLoader };
