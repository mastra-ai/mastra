import type { ReactNode } from 'react';

export type ObservabilityListBodyProps = {
  /** Controls above the list (filters, columns…). */
  toolbar?: ReactNode;
  /** A fixed-height (`shrink-0`) chart between the toolbar and the list. Hidden with the error and empty states. */
  chart?: ReactNode;
  /** The list failed to load. Takes precedence over `empty` and `children`. */
  error?: ReactNode;
  /** The full-page empty state. Takes precedence over `children`. */
  empty?: ReactNode;
  children: ReactNode;
};

/** The body of an observability list page: a toolbar and an optional chart above the list, its error or its empty state. */
export function ObservabilityListBody({ toolbar, chart, error, empty, children }: ObservabilityListBodyProps) {
  let body: ReactNode = children;
  if (error) body = <div className="flex h-full items-center justify-center">{error}</div>;
  else if (empty) body = empty;

  const shownChart = error || empty ? null : chart;

  if (!toolbar && !shownChart) return body;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {toolbar}
      {shownChart}
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}
