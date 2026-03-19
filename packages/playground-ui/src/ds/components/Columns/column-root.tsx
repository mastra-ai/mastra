import { cn } from '@/index';

export type ColumnProps = {
  children: React.ReactNode;
  className?: string;
  withRightSeparator?: boolean;
  withLeftSeparator?: boolean;
};

export function ColumnRoot({ children, className, withLeftSeparator, withRightSeparator }: ColumnProps) {
  return (
    <div className="flex overflow-y-auto w-full">
      {withLeftSeparator && <Separator />}

      <div className={cn(`grid gap-8 content-start w-full overflow-y-auto`, className)}>{children}</div>

      {withRightSeparator && <Separator />}
    </div>
  );
}

function Separator() {
  return <div className={cn('bg-surface5 w-[3px] shrink-0 mx-[1.5vw]')}></div>;
}
