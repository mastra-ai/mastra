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

/** GitHub octocat mark (fill-based; inherits currentColor). */
export const GithubIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.13-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
  </svg>
);

/** Linear mark (fill-based; inherits currentColor). */
export const LinearIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3.04 7.51a10.5 10.5 0 0 0 13.45 13.45L3.04 7.51Zm-.96 3.13a10.5 10.5 0 0 0 11.28 11.28L2.08 10.64Zm2.04-5.42 14.66 14.66a10.56 10.56 0 0 0 1.39-1.67L5.79 3.83a10.56 10.56 0 0 0-1.67 1.39ZM12 1.5c-1.3 0-2.54.24-3.68.67l13.51 13.51A10.5 10.5 0 0 0 12 1.5Z" />
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
