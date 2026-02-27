import { cn } from '@/lib/utils';

export type ChipsGroupProps = {
  children: React.ReactNode;
  className?: string;
};

export function ChipsGroup({ children, className }: ChipsGroupProps) {
  return (
    <div
      className={cn(
        'flex gap-[1px] items-center [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:rounded-l-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
