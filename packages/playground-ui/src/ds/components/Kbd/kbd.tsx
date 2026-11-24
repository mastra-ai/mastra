import { KeyLabel } from './key-label';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type KbdProps = {
  children: React.ReactNode;
  size?: 'default' | 'sm' | 'xs';
  className?: string;
};

// Fixed heights, not padding — `font-mono` normal leading varies per glyph set and desyncs the scale
// Commit Mono has no medium, so `text-meta` is its bold here: `--key-stroke` matches the symbols to it
const sizeClasses: Record<NonNullable<KbdProps['size']>, string> = {
  default: 'h-6 min-w-6 rounded-md px-1.5 text-caption',
  sm: 'h-5 min-w-5 rounded-md px-1 text-meta [--key-stroke:2.5]',
  xs: 'h-4 min-w-4 rounded px-1 text-meta leading-none [--key-stroke:2.5]',
};

export const Kbd = ({ children, size = 'default', className }: KbdProps) => {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center bg-card font-mono text-foreground shadow-raised',
        sizeClasses[size],
        transitions.transform,
        'active:scale-95 active:shadow-none',
        className,
      )}
    >
      {/* Trim to cap height so the letters center in the fixed height whatever the font: a system mono
          (an app without Commit Mono) sits them high. An inline box, since trim doesn't apply to the flex box.
          A mono space is wide for a gap between keys, so tighten it */}
      <span className="[text-box:trim-both_cap_alphabetic] [word-spacing:-0.3em]">
        <KeyLabel>{children}</KeyLabel>
      </span>
    </kbd>
  );
};
