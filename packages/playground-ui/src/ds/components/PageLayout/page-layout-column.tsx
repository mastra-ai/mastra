import { cn } from '@/lib/utils';

export type PageLayoutColumnProps = {
  children?: React.ReactNode;
  className?: string;
};

export function PageLayoutColumn({ children, className }: PageLayoutColumnProps) {
  return <div className={cn('grid content-start', className)}>{children}</div>;
}
