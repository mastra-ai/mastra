import { cn } from '@/lib/utils';

export type MainHeaderColumnProps = {
  children?: React.ReactNode;
  className?: string;
};

export function MainHeaderColumn({ children, className }: MainHeaderColumnProps) {
  return <div className={cn('grid content-start', className)}>{children}</div>;
}
