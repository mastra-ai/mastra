// Crisp inline SVG icon set for MastraCode Web. Stroke-based, currentColor —
// so icons inherit text color and theme automatically. Kept tiny and
// dependency-free.

type IconProps = { size?: number; className?: string; title?: string };

function svg(path: React.ReactNode, size = 16, className?: string, title?: string) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );
}

/** The MastraCode brand mark: a stylized prompt chevron + cursor inside a
 *  rounded tile. Rendered with a gradient fill via CSS (.logo-mark). */
export function LogoMark({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mc-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#mc-logo-grad)" />
      <path
        d="M10 11.5L14 16L10 20.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path d="M16.5 21H22" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
}

/** The "MASTRA CODE" wordmark in half-block ASCII art, mirroring the TUI
 *  banner. Rendered as the empty-state hero. */
const CODE_WORDMARK_ART = `█▀▄▀█ ▄▀█ █▀ ▀█▀ █▀█ ▄▀█   █▀▀ █▀█ █▀▄ █▀▀
█ ▀ █ █▀█ ▀█  █  █▀▄ █▀█   █   █ █ █ █ █▀▀
▀   ▀ ▀ ▀ ▀▀  ▀  ▀ ▀ ▀ ▀   ▀▀▀ ▀▀▀ ▀▀  ▀▀▀`;

const FACTORY_WORDMARK_ART = `█▀▄▀█ ▄▀█ █▀ ▀█▀ █▀█ ▄▀█   █▀▀ ▄▀█ █▀▀ ▀█▀ █▀█ █▀█ █▄█
█ ▀ █ █▀█ ▀█  █  █▀▄ █▀█   █▀  █▀█ █    █  █ █ █▀▄  █
▀   ▀ ▀ ▀ ▀▀  ▀  ▀ ▀ ▀ ▀   ▀   ▀ ▀ ▀▀▀  ▀  ▀▀▀ ▀ ▀  ▀`;

export function Wordmark({ className, brand = 'code' }: { className?: string; brand?: 'code' | 'factory' }) {
  const factory = brand === 'factory';

  return (
    <pre
      className={`m-0 overflow-x-auto font-mono text-xs leading-[1.25] whitespace-pre select-none text-icon6${className ? ` ${className}` : ''}`}
      aria-label={factory ? 'Mastra Factory' : 'Mastra Code'}
    >
      {factory ? FACTORY_WORDMARK_ART : CODE_WORDMARK_ART}
    </pre>
  );
}

export const ChevronIcon = ({ size = 14, className }: IconProps) => svg(<path d="M9 6l6 6-6 6" />, size, className);

export const ArrowDownIcon = ({ size = 16, className }: IconProps) =>
  svg(<path d="M12 5v14M19 12l-7 7-7-7" />, size, className);

export const PlusIcon = ({ size = 16, className }: IconProps) =>
  svg(
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>,
    size,
    className,
  );

export const EllipsisIcon = ({ size = 16, className }: IconProps) =>
  svg(
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>,
    size,
    className,
  );

export const CloseIcon = ({ size = 14, className }: IconProps) =>
  svg(
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>,
    size,
    className,
  );

export const CopyIcon = ({ size = 13, className }: IconProps) =>
  svg(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>,
    size,
    className,
  );

export const SunIcon = ({ size = 15, className }: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
    size,
    className,
  );

export const MoonIcon = ({ size = 15, className }: IconProps) =>
  svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />, size, className);

export const SendIcon = ({ size = 16, className }: IconProps) =>
  svg(
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </>,
    size,
    className,
  );

export const StopIcon = ({ size = 14, className }: IconProps) =>
  svg(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />, size, className);

export const MenuIcon = ({ size = 18, className }: IconProps) =>
  svg(
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>,
    size,
    className,
  );

export const GearIcon = ({ size = 16, className }: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
    size,
    className,
  );

export const FolderIcon = ({ size = 16, className }: IconProps) =>
  svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />, size, className);

/**
 * Official Jira logomark (fill-based; inherits currentColor). Spreads SVG
 * props so consumers like the board's SourceIcon can stamp data/aria attrs.
 */
export const JiraIcon = ({ size = 16, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z" />
  </svg>
);

/** Official incident.io flame logomark (fill-based; inherits currentColor). */
export const IncidentIoIcon = ({ size = 16, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 128 163" fill="currentColor" aria-hidden="true" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.7336 139.642V163C20.7585 156.323 0 131.711 0 102.372C0 85.4557 7.15792 72.0354 18.1053 58.8703C27.1831 47.9534 49.5985 19.0426 56.6543 3.08954C58.3673-.783473 62.7348-.633805 64.6182 1.44721C70.6432 8.10421 78.0694 22.6432 80.4983 39.135C80.9932 42.4953 81.1969 45.2388 81.3587 47.4184C81.706 52.0954 81.8604 54.1748 84.2854 54.1748C88.0955 54.1748 90.588 48.3977 91.1358 42.4345C91.4869 38.6136 95.2774 37.3346 97.8914 38.6136C110.463 44.7644 123.292 74.0426 126.393 88.4102C127.366 92.9158 128 97.5719 128 102.372C128 131.646 107.335 156.214 79.4537 162.955V139.642H48.7336ZM64.0002 130.333C73.8316 130.333 81.8016 122.789 81.8016 113.483C81.8016 98.6407 70.8577 88.0345 65.4048 84.8105C65.0364 84.5928 64.8523 84.4839 64.3512 84.4974C63.9843 84.5073 63.4429 84.7369 63.181 84.9935C62.8232 85.3441 62.7283 85.743 62.5387 86.5409C61.5721 90.6065 58.5292 93.5054 55.327 96.556C50.9141 100.76 46.1988 105.252 46.1988 113.483C46.1988 122.789 54.1688 130.333 64.0002 130.333Z"
    />
  </svg>
);

export const BellIcon = ({ size = 15, className }: IconProps) =>
  svg(
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>,
    size,
    className,
  );

export const TargetIcon = ({ size = 15, className }: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>,
    size,
    className,
  );

export const BrainIcon = ({ size = 14, className }: IconProps) =>
  svg(
    <path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 7 17a3 3 0 0 0 5 1 3 3 0 0 0 5-1 3 3 0 0 0 2-5.2A3 3 0 0 0 18 6a3 3 0 0 0-3-3 3 3 0 0 0-3 1.5A3 3 0 0 0 9 3z" />,
    size,
    className,
  );

export const SearchIcon = ({ size = 15, className }: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>,
    size,
    className,
  );

export const CheckIcon = ({ size = 15, className }: IconProps) => svg(<path d="M20 6L9 17l-5-5" />, size, className);

export const KeyIcon = ({ size = 15, className }: IconProps) =>
  svg(
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.5 12.5L20 3" />
      <path d="M16 7l3 3" />
    </>,
    size,
    className,
  );

export const SlidersIcon = ({ size = 16, className }: IconProps) =>
  svg(
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>,
    size,
    className,
  );

export const PaletteIcon = ({ size = 16, className }: IconProps) =>
  svg(
    <>
      <circle cx="13.5" cy="6.5" r="1" />
      <circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8.5" cy="7.5" r="1" />
      <circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.7-1.8-.4-.4-.6-1-.6-1.5a2.5 2.5 0 0 1 2.5-2.5H18a4 4 0 0 0 4-4c0-4.4-4.5-7.7-10-7.7z" />
    </>,
    size,
    className,
  );

export const ServerIcon = ({ size = 15, className }: IconProps) =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>,
    size,
    className,
  );

export const LayersIcon = ({ size = 15, className }: IconProps) =>
  svg(
    <>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 12l10 5 10-5M2 17l10 5 10-5" />
    </>,
    size,
    className,
  );

// Tool icons keyed by tool name family. Falls back to a generic gear.
export function ToolIcon({ name, size = 14, className }: { name: string } & IconProps) {
  const n = name.toLowerCase();
  if (n.includes('view') || n.includes('read') || n.includes('cat'))
    return svg(
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>,
      size,
      className,
    );
  if (n.includes('write') || n.includes('edit') || n.includes('replace') || n.includes('str_replace'))
    return svg(
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>,
      size,
      className,
    );
  if (n.includes('exec') || n.includes('command') || n.includes('shell') || n.includes('bash') || n.includes('run'))
    return svg(
      <>
        <path d="M4 17l6-5-6-5" />
        <path d="M12 19h8" />
      </>,
      size,
      className,
    );
  if (n.includes('search') || n.includes('grep') || n.includes('find') || n.includes('glob'))
    return svg(
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </>,
      size,
      className,
    );
  if (n.includes('task') || n.includes('todo'))
    return svg(
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>,
      size,
      className,
    );
  if (n.includes('browser') || n.includes('web') || n.includes('fetch') || n.includes('http'))
    return svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
      </>,
      size,
      className,
    );
  // generic tool: wrench
  return svg(
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z" />,
    size,
    className,
  );
}
