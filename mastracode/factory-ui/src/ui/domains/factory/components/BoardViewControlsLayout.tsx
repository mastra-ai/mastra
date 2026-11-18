import type { ReactNode } from 'react';

export function BoardViewControlsLayout({
  tabs,
  layoutToggle,
  properties,
  search,
  aside,
  editor,
}: {
  tabs: ReactNode;
  layoutToggle: ReactNode;
  properties: ReactNode;
  search: ReactNode;
  aside: ReactNode;
  editor?: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 grow basis-80 flex-wrap items-center gap-3 max-sm:contents">
          <div className="max-sm:w-full">{tabs}</div>
          <div className="flex shrink-0 items-center gap-2">
            {layoutToggle}
            {properties}
          </div>
        </div>
        {search}
        <div className="shrink-0">{aside}</div>
      </div>
      {editor}
    </div>
  );
}
