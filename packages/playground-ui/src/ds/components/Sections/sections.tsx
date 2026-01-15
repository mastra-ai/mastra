import { cn } from '@/lib/utils';

export type SectionsProps = {
  children: React.ReactNode;
  className?: string;
};

export function Sections({ children, className }: SectionsProps) {
  return <div className={cn('grid gap-[3rem]', className)}>{children}</div>;
}
