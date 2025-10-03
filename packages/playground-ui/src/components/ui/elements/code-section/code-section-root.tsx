import { cn } from '@/lib/utils';

type CodeSectionRootProps = {
  children: React.ReactNode;
  className?: string;
};

export function CodeSectionRoot({ children, className }: CodeSectionRootProps) {
  return <section className={cn('border border-border1 rounded-lg overflow-clip', className)}>{children}</section>;
}
