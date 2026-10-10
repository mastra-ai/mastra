import type { ComponentProps } from 'react';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type TableProps = ComponentProps<'table'> & {
  columnDividers?: boolean;
};

export function TableRoot({ columnDividers, className, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      data-column-dividers={columnDividers || undefined}
      className={cn('group/table w-full rounded-xl p-1', raisedSurfaceStyle, className)}
    >
      <div data-slot="table-scroll" className="overflow-x-auto rounded-lg">
        <div className="group-data-column-dividers/table:-ml-px">
          <table
            data-slot="table"
            className="w-full border-separate border-spacing-0 text-body-sm tabular-nums"
            {...props}
          />
        </div>
      </div>
    </div>
  );
}
