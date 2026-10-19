import { Children } from 'react';

export interface DataPanelHeaderContentProps {
  children: React.ReactNode;
}

/**
 * Left block of a `DataPanel.Header`: heading followed inline by optional `Metadata`.
 * A vertical separator is rendered between the heading and the metadata when both are present.
 * When the header is too narrow for everything on one row, the block dissolves into the header
 * so the metadata can take its own row below the heading and actions.
 */
export function DataPanelHeaderContent({ children }: DataPanelHeaderContentProps) {
  const [heading, ...metadata] = Children.toArray(children);

  return (
    <div
      data-slot="data-panel-header-content"
      className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden group-data-wrapped/data-panel-header:contents"
    >
      {heading}
      {metadata.length > 0 && (
        <>
          <div
            aria-hidden="true"
            className="mx-1 h-4 w-px shrink-0 bg-border-strong group-data-wrapped/data-panel-header:hidden"
          />
          {metadata}
        </>
      )}
    </div>
  );
}
