import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const column = 'flex w-4 shrink-0 flex-col items-center self-stretch';
const vertical = 'w-0 flex-1 border-l border-dashed border-surface-overlay-strong';

type TimelineStructureSignProps = {
  /** Per ancestor level (shallowest first): whether that level's connector continues past this row. */
  guides?: boolean[];
  isRootSpan?: boolean;
  isLastChild?: boolean;
  /** Draw the line from this row's dot down to its children. */
  hasStem?: boolean;
  /** The status dot. Omit on continuation lines (the part of a row under its first line). */
  dot?: ReactNode;
};

/**
 * Tree rail rendered before a span name: one equal-width column per ancestor level, the
 * connector column, then the dot column. Every column centres its line, so a parent's dot
 * column lines up with its children's connector column without any offset math.
 */
export function TimelineStructureSign({
  guides = [],
  isRootSpan,
  isLastChild,
  hasStem,
  dot,
}: TimelineStructureSignProps) {
  const isHead = dot !== undefined;

  return (
    <>
      {guides.map((show, index) => (
        <span key={index} aria-hidden className={column}>
          {show && <span data-testid="timeline-structure-guide" className={vertical} />}
        </span>
      ))}

      {!isRootSpan && (
        <span aria-hidden className={cn(column, 'relative')}>
          {isHead ? (
            <>
              <span className={vertical} />
              <span className={cn(vertical, isLastChild && 'invisible')} />
              <span className="absolute top-1/2 -right-1 left-1/2 border-t border-dashed border-surface-overlay-strong" />
            </>
          ) : (
            !isLastChild && <span className={vertical} />
          )}
        </span>
      )}

      <span className={column}>
        {isHead ? (
          <>
            <span className="mb-0.5 flex-1" />
            {dot}
            <span className={cn(vertical, 'mt-0.5', !hasStem && 'invisible')} />
          </>
        ) : (
          hasStem && <span aria-hidden className={vertical} />
        )}
      </span>
    </>
  );
}
