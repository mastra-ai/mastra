import { KeyLabel } from './key-label';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type KbdProps = {
  children: React.ReactNode;
  size?: 'default' | 'sm' | 'xs';
  className?: string;
};

// Fixed heights, not padding — `font-mono` normal leading varies per glyph set and desyncs the scale
const sizeClasses: Record<NonNullable<KbdProps['size']>, string> = {
  default: 'h-6 min-w-6 rounded-md px-1.5 text-caption',
  sm: 'h-5 min-w-5 rounded-md px-1 text-meta',
  xs: 'h-4 min-w-4 rounded px-1 text-meta leading-none',
};

// Match the letters' stems. At the small sizes those are bold: Commit Mono has no medium, so it uses Bold
const symbolStroke: Record<NonNullable<KbdProps['size']>, number> = {
  default: 2.2,
  sm: 2.8,
  xs: 2.8,
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
          (an app without Commit Mono) sits them high. An inline box, since trim doesn't apply to the flex box */}
      <span className="[text-box:trim-both_cap_alphabetic]">
        <KeyLabel strokeWidth={symbolStroke[size]}>{children}</KeyLabel>
      </span>
    </kbd>
  );
};
