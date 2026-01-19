import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export type KbdProps = {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  className?: string;
};

const themeClasses: Record<NonNullable<KbdProps['theme']>, string> = {
  light: 'bg-gray-100 border-gray-300 text-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.1)]',
  dark: 'bg-surface4 border-border1 text-neutral5 shadow-[0_1px_0_rgba(0,0,0,0.3)]',
};

export const Kbd = ({ children, theme = 'dark', className }: KbdProps) => {
  const themeClass = themeClasses[theme];
  return (
    <kbd
      className={cn(
        'border rounded-md px-1.5 py-0.5 font-mono text-ui-sm inline-flex items-center justify-center min-w-[1.5rem]',
        transitions.transform,
        'active:scale-95 active:shadow-none',
        themeClass,
        className,
      )}
    >
      {children}
    </kbd>
  );
};
