import { cn } from '@/lib/utils';

type EntryListToolbarProps = {
  children?: React.ReactNode;
  className?: string;
};

export function EntryListToolbar({ children, className }: EntryListToolbarProps) {
  return (
    <div
      className={cn('flex justify-between bg-surface4 z-[1] mt-[1rem] mb-[1rem] rounded-lg px-[1.5rem] ', className)}
    >
      {children}
    </div>
  );
}
