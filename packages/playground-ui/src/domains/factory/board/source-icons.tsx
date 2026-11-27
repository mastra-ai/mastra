import type { SVGProps } from 'react';

/**
 * GitLab logomark (fill-based; inherits currentColor). Spreads SVG props like the other brand marks,
 * so the board's SourceIcon can stamp data and aria attributes on it.
 */
export const GitLabIcon = ({ size = 16, ...props }: { size?: number } & SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M23.955 13.587 20.613 3.307a.54.54 0 0 0-1.025 0l-2.257 6.946H6.67L4.413 3.307a.54.54 0 0 0-1.025 0L.045 13.587a1.08 1.08 0 0 0 .393 1.207L12 23.196l11.562-8.402a1.08 1.08 0 0 0 .393-1.207Z" />
  </svg>
);

/**
 * Official Jira logomark (fill-based; inherits currentColor). Spreads SVG
 * props so consumers like the board's SourceIcon can stamp data/aria attrs.
 */
export const JiraIcon = ({ size = 16, ...props }: { size?: number } & SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z" />
  </svg>
);

export const IncidentIoIcon = ({ size = 16, ...props }: { size?: number } & SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 128 163" fill="currentColor" aria-hidden="true" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.7336 139.642V163C20.7585 156.323 0 131.711 0 102.372C0 85.4557 7.15792 72.0354 18.1053 58.8703C27.1831 47.9534 49.5985 19.0426 56.6543 3.08954C58.3673-.783473 62.7348-.633805 64.6182 1.44721C70.6432 8.10421 78.0694 22.6432 80.4983 39.135C80.9932 42.4953 81.1969 45.2388 81.3587 47.4184C81.706 52.0954 81.8604 54.1748 84.2854 54.1748C88.0955 54.1748 90.588 48.3977 91.1358 42.4345C91.4869 38.6136 95.2774 37.3346 97.8914 38.6136C110.463 44.7644 123.292 74.0426 126.393 88.4102C127.366 92.9158 128 97.5719 128 102.372C128 131.646 107.335 156.214 79.4537 162.955V139.642H48.7336ZM64.0002 130.333C73.8316 130.333 81.8016 122.789 81.8016 113.483C81.8016 98.6407 70.8577 88.0345 65.4048 84.8105C65.0364 84.5928 64.8523 84.4839 64.3512 84.4974C63.9843 84.5073 63.4429 84.7369 63.181 84.9935C62.8232 85.3441 62.7283 85.743 62.5387 86.5409C61.5721 90.6065 58.5292 93.5054 55.327 96.556C50.9141 100.76 46.1988 105.252 46.1988 113.483C46.1988 122.789 54.1688 130.333 64.0002 130.333Z"
    />
  </svg>
);
