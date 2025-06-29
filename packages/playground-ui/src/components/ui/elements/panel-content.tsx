import { cn } from '@/lib/utils';

type PanelContentProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function PanelContent({ children, className, style }: PanelContentProps) {
  return (
    <div className={cn('grid gap-[30px] content-start overflow-y-auto', className)} style={style}>
      {children}
    </div>
  );
}
