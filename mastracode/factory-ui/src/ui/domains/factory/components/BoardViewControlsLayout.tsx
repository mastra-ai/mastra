import type { ReactNode } from 'react';

export function BoardViewControlsLayout({
  views,
  search,
  aside,
  filters,
}: {
  views: ReactNode;
  search: ReactNode;
  aside?: ReactNode;
  filters: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 grow basis-80 flex-wrap items-center gap-3 max-sm:contents">{views}</div>
        {search}
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {filters}
    </div>
  );
}
