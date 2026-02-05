import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';

export type ColumnsProps = {
  children: React.ReactNode;
  isSideColumnVisible?: boolean;
  className?: string;
};

export function Columns({ children, isSideColumnVisible = false, className }: ColumnsProps) {
  return (
    <div
      className={cn(
        'grid h-full overflow-hidden gap-10',
        transitions.allSlow,
        isSideColumnVisible ? 'grid-cols-[1fr_auto]' : 'grid-cols-1',
        className,
      )}
    >
      {children}
    </div>
  );
}
