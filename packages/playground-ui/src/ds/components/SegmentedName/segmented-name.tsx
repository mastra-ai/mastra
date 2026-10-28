import { Fragment } from 'react';

export type SegmentedNameProps = {
  /** The name's parts, broadest first, e.g. `['openai', 'gpt-5']` or a span's kind and value. */
  parts: string[];
};

/**
 * One name made of parts, joined by a dimmed "›": "openai › gpt-5", "agent run › Code Agent".
 * Plain text that inherits the surrounding type, for table cells, legends and span names. Not
 * navigation: for a page trail, use `Breadcrumb`.
 */
export function SegmentedName({ parts }: SegmentedNameProps) {
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span aria-hidden className="px-1 text-foreground/70">
              ›
            </span>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}
