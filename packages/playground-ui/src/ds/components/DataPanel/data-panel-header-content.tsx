import { Children, Fragment } from 'react';

export interface DataPanelHeaderContentProps {
  children: React.ReactNode;
}

/**
 * Left block of a `DataPanel.Header`: heading followed inline by optional blocks such as `Metadata`,
 * truncated when too long. A vertical separator is rendered between consecutive blocks.
 */
export function DataPanelHeaderContent({ children }: DataPanelHeaderContentProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      {Children.toArray(children).map((child, index) => (
        <Fragment key={index}>
          {index > 0 && <div aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border-strong" />}
          {child}
        </Fragment>
      ))}
    </div>
  );
}
