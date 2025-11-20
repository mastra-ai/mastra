import { cn } from '@/lib/utils';

type ButtonsGroupProps = {
  children: React.ReactNode;
  className?: string;
};

export function ButtonsGroup({ children, className }: ButtonsGroupProps) {
  return <div className={cn(`flex gap-2 items-center`, '[&>button]:flex-grow', className)}>{children}</div>;
}
