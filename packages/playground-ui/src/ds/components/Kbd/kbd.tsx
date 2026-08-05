import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type KbdProps = {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  size?: 'default' | 'sm' | 'xs';
  className?: string;
};

const themeClasses: Record<NonNullable<KbdProps['theme']>, string> = {
  light: 'bg-gray-100 border-gray-300 text-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.1)]',
  dark: 'bg-surface4 border-border1 text-neutral5 shadow-[0_1px_0_rgba(0,0,0,0.3)]',
};

// Fixed heights, not padding — `font-mono` normal leading varies per glyph set and desyncs the scale
const sizeClasses: Record<NonNullable<KbdProps['size']>, string> = {
  default: 'h-6 min-w-6 rounded-md px-1.5 text-ui-sm',
  sm: 'h-5 min-w-5 rounded-md px-1 text-ui-xs',
  xs: 'h-4 min-w-4 rounded px-1 text-ui-xs leading-none',
};

export const Kbd = ({ children, theme = 'dark', size = 'default', className }: KbdProps) => {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center border font-mono',
        sizeClasses[size],
        transitions.transform,
        'active:scale-95 active:shadow-none',
        themeClasses[theme],
        className,
      )}
    >
      {children}
    </kbd>
  );
};
