import { cn } from '@/lib/utils';

export type FieldBlocksLayoutRootProps = {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2;
  gap?: string;
};

export function FieldBlocksLayoutRoot({ children, className, columns = 1, gap }: FieldBlocksLayoutRootProps) {
  return (
    <div
      className={cn(
        'grid',
        {
          'grid-cols-1': columns === 1,
          'grid-cols-2': columns === 2,
        },
        gap ?? 'gap-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
