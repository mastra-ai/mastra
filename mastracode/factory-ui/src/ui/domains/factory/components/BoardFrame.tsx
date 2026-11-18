import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentPropsWithRef, PointerEventHandler, ReactNode } from 'react';

import { BOARD_SCROLL_SURFACE_CLASS } from '../boardLayout';
import type { BoardLayout } from '../boardLayout';

export const BOARD_COLUMNS_CLASS = 'flex flex-1 items-stretch gap-2 px-4 pb-4 lg:gap-3';
export const BOARD_LIST_BODY_CLASS = 'flex flex-1 flex-col px-4 pb-4';

export function BoardFrame({
  layout,
  toolbar,
  columnHeaders,
  onPointerOver,
  onPointerLeave,
  children,
  ...surface
}: Omit<ComponentPropsWithRef<'div'>, 'className' | 'onPointerOver' | 'onPointerLeave'> & {
  layout: BoardLayout;
  toolbar: ReactNode;
  columnHeaders: ReactNode;
  onPointerOver?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div {...surface} className={BOARD_SCROLL_SURFACE_CLASS}>
      <div
        className={cn('flex min-h-full min-w-full flex-col gap-3', layout === 'board' ? 'w-max lg:gap-0' : 'w-full')}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
      >
        <div
          className={cn(
            'from-background via-background z-20 flex flex-col gap-3 bg-linear-to-b to-transparent max-lg:contents lg:sticky lg:top-0',
            layout === 'board' ? 'via-[calc(100%-0.5rem)] pb-2' : 'via-[calc(100%-1rem)] pb-4',
          )}
        >
          <div className="sticky left-0 flex w-[100cqw] px-4 pt-4">{toolbar}</div>
          {layout === 'board' && (
            <div className="from-background via-background sticky top-0 z-20 flex items-start gap-2 via-[calc(100%-0.75rem)] to-transparent px-4 max-lg:bg-linear-to-b max-lg:pb-3 lg:gap-3">
              {columnHeaders}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
