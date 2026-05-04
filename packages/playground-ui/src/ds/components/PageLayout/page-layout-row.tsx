import { cn } from '@/lib/utils';

export type PageLayoutRowProps = {
  children?: React.ReactNode;
  className?: string;
};

export function PageLayoutRow({ children, className }: PageLayoutRowProps) {
  return <div className={cn('flex items-start justify-between', className)}>{children}</div>;
}
