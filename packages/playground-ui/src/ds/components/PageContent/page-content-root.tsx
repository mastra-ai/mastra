import { cn } from '@/index';

export function PageContentRoot({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn(`grid  grid-rows-[3.5rem_1fr] overflow-y-auto pb-3 mr-3 `, className)}>{children}</div>;
}
