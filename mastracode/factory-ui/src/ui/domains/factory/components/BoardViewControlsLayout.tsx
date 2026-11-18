import type { ReactNode } from 'react';

export const BOARD_DEFAULT_VIEW_LABEL = 'All cards';
export const BOARD_VIEW_TABS_CLASS = 'max-sm:w-full';
export const BOARD_SEARCH_CLASS = 'w-48 max-w-full max-sm:min-w-0 max-sm:flex-1';

export function BoardViewControlsLayout({
  views,
  search,
  aside,
  editor,
}: {
  views: ReactNode;
  search: ReactNode;
  aside?: ReactNode;
  editor?: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 grow basis-80 flex-wrap items-center gap-3 max-sm:contents">{views}</div>
        {search}
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {editor}
    </div>
  );
}
