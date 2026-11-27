import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

/**
 * One step of a phase in the panel: Starts, Agent runs, Ends, Allowed moves, Outcomes. Step icons sit in the
 * header's icon column, each joined to the next by a line, and the step's settings line up with its title, so the
 * panel reads top to bottom in the order a card meets them.
 */
export function PanelSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="group/step grid grid-cols-[var(--spacing-icon-md)_minmax(0,1fr)] gap-x-2 gap-y-2.5 px-1"
    >
      <span aria-hidden className="grid h-4 place-items-center text-foreground [&_svg]:size-3.25">
        {icon}
      </span>
      <Txt as="h3" variant="column" tone="ink" className="font-semibold">
        {title}
      </Txt>
      {/* From just under this step's icon to just above the next one's, across the panel's gap between steps. */}
      <span
        aria-hidden
        className="-mt-1.5 -mb-3 w-px justify-self-center bg-border-strong group-last-of-type/step:hidden"
      />
      <div className="col-start-2 flex min-w-0 flex-col gap-2.5">{children}</div>
    </section>
  );
}

/** A label on the left and its control on the right. */
export function PanelRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-5 min-w-0 items-center justify-between gap-1.5', className)}>
      <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
        {label}
      </Txt>
      {children}
    </div>
  );
}

/** "12 / 1000" beside a field, in the warning colour once the text runs over. */
export function LimitCount({ length, max }: { length: number; max: number }) {
  return (
    <Txt
      as="span"
      variant="caption"
      tone={length > max ? undefined : 'muted'}
      className={cn('tabular-nums', length > max && 'text-warning-foreground')}
    >
      {length.toLocaleString('en-US')} / {max}
    </Txt>
  );
}
