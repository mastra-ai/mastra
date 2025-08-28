import clsx from 'clsx';

export interface KbdProps {
  children: React.ReactNode;
  theme?: 'light' | 'dark';
}

const themeClasses: Record<NonNullable<KbdProps['theme']>, string> = {
  light: 'bg-gray-100 border-gray-300 text-gray-700',
  dark: 'bg-surface4 border-border1 text-icon6',
};

export const Kbd = ({ children, theme = 'dark' }: KbdProps) => {
  const themeClass = themeClasses[theme];
  return <kbd className={clsx('border-sm rounded-md px-1 py-0.5 font-mono', themeClass)}>{children}</kbd>;
};
