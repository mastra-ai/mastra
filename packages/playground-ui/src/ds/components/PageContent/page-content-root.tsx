import { cn } from '@/index';

export function PageContentRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(`grid  grid-rows-[3.5rem_1fr] overflow-y-auto pb-3 mr-3 `, className)}>{children}</div>;
}
