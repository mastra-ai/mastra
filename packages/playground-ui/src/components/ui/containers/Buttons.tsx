import { cn } from '@/lib/utils';

type ButtonsProps = {
  children: React.ReactNode;
  className?: string;
};

export function Buttons({ children, className }: ButtonsProps) {
  return <div className={cn(`flex gap-2 items-center`, className)}>{children}</div>;
}
