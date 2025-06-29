import { cn } from '@/lib/utils';

type PanelLayoutProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function PanelLayout({ children, className, style }: PanelLayoutProps) {
  return (
    <div className={cn('grid grid-rows-[auto_1fr] p-[22px] h-ful overflow-y-auto', className)} style={style}>
      {children}
    </div>
  );
}
