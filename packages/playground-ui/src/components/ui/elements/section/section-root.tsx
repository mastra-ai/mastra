import { cn } from '@/lib/utils';

export type SectionRootProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionRoot({ children, className }: SectionRootProps) {
  return <section className={cn(`grid gap-[1rem]`, className)}>{children}</section>;
}
