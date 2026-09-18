import { Children } from 'react';

export interface DataPanelHeaderContentProps {
  children: React.ReactNode;
}

/**
 * Left block of a `DataPanel.Header`: heading followed inline by optional `Metadata`, truncated when too long.
 * A vertical separator is rendered between the heading and the metadata when both are present.
 */
export function DataPanelHeaderContent({ children }: DataPanelHeaderContentProps) {
  const [heading, ...rest] = Children.toArray(children);
  const metadata = rest.filter(Boolean);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      {heading}
      {metadata.length > 0 && (
        <>
          <div role="separator" aria-orientation="vertical" className="bg-border2 mx-1 h-4 w-px shrink-0" />
          {metadata}
        </>
      )}
    </div>
  );
}
