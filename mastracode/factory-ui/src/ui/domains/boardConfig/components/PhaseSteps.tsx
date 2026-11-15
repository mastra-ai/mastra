import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { useId } from 'react';

/** A phase's settings drawn as the steps a card goes through, joined by a line down their markers. */
export function PhaseSteps({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {children}
    </ol>
  );
}

export function PhaseStep({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <li
      aria-labelledby={titleId}
      className="before:bg-border relative grid grid-cols-[--spacing(7)_minmax(0,1fr)] gap-x-3 pb-8 before:absolute before:top-9 before:bottom-1 before:left-[calc(--spacing(3.5)-0.5px)] before:w-px last:pb-0 last:before:hidden"
    >
      <span className="border-border bg-card text-muted-foreground flex size-7 items-center justify-center rounded-full border [&_svg]:size-3.5">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-h-7 flex-col justify-center">
          <Txt as="h2" id={titleId} variant="subheading" tone="ink">
            {title}
          </Txt>
          {description && (
            <Txt as="p" variant="caption" tone="muted">
              {description}
            </Txt>
          )}
        </div>
        {children}
      </div>
    </li>
  );
}
