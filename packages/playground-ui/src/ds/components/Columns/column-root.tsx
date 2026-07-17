import { cn } from '@/lib/utils';

export type ColumnProps = {
  children: React.ReactNode;
  className?: string;
  withRightSeparator?: boolean;
  withLeftSeparator?: boolean;
};

export function ColumnRoot({ children, className, withLeftSeparator, withRightSeparator }: ColumnProps) {
  return (
    <div className="flex w-full overflow-y-auto">
      {withLeftSeparator && <Separator />}

      <div className={cn(`grid w-full content-start gap-8 overflow-y-auto`, className)}>{children}</div>

      {withRightSeparator && <Separator />}
    </div>
  );
}

function Separator() {
  return <div className={cn('mx-[1.5vw] w-[3px] shrink-0 bg-surface5')}></div>;
}
