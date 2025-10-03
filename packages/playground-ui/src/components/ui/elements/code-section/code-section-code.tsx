import { cn } from '@/lib/utils';

type CodeSectionCodeProps = {
  children: React.ReactNode;
  className?: string;
};

export function CodeSectionCode({ children, className }: CodeSectionCodeProps) {
  return (
    <div
      className={cn(
        'bg-surface3 p-[1rem] overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all',
        className,
      )}
    >
      {children}
    </div>
  );
}
