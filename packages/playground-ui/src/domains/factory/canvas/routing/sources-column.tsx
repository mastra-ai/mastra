import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/** One trigger new items arrive on, with the sources that send it. */
export interface IntakeSourceLane {
  event: string;
  label: string;
  icon: ReactNode;
  /** Cards filed from it in the last 30 days; undefined while the counts load. */
  filed: number | undefined;
  /** The connected sources that send it, each with its mark. */
  sources: readonly { key: string; name: string; icon: ReactNode }[];
}

/**
 * Where new issues and pull requests come from: the project's repositories and the issue trackers bound to it, with
 * what intake filed from each trigger in the last 30 days.
 */
export function SourcesColumn({
  lanes,
  routeList,
  intakeHref,
  LinkComponent: Link,
}: {
  lanes: readonly IntakeSourceLane[];
  /** Intake still runs the old route list, so the order decides nothing yet. */
  routeList: boolean;
  /** The project's Work Intake settings. */
  intakeHref: string;
  LinkComponent: LinkComponent;
}) {
  return (
    <section aria-label="Sources" className="flex w-63 shrink-0 flex-col gap-3 max-sm:w-full">
      <div className="flex h-5 items-center justify-between">
        <Txt as="h2" variant="column" tone="muted">
          Sources
        </Txt>
        <Link href={intakeHref} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <Txt as="span" variant="caption">
            Work Intake
          </Txt>
          <IconArrowUpRight className="size-icon-xs" aria-hidden />
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {lanes.map(lane => (
          <li
            key={lane.event}
            data-link-source
            aria-label={lane.label}
            className={cn(raisedSurfaceStyle, 'flex h-17 flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3')}
          >
            {/* The order cards' title row height, so a link between two titles at one height runs straight. */}
            <div className="flex min-h-5.5 items-center gap-2">
              {lane.icon}
              <Txt as="span" variant="card-title-strong" tone="ink" className="flex-1">
                {lane.label}
              </Txt>
              {lane.filed !== undefined && (
                <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
                  {lane.filed}
                </Txt>
              )}
            </div>
            <div className="flex items-center gap-3">
              {lane.sources.map(source => (
                <span key={source.key} className="flex items-center gap-1.25">
                  {source.icon}
                  <Txt as="span" variant="caption" tone="muted">
                    {source.name}
                  </Txt>
                </span>
              ))}
              {lane.sources.length === 0 && (
                <Txt as="span" variant="caption" tone="muted">
                  No source connected
                </Txt>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* With the old route list still in charge, the order's notice says so instead. */}
      {!routeList && (
        <div className="flex flex-col gap-2.5 px-3.25 pt-2">
          <Txt as="p" variant="caption" tone="muted">
            A new issue or pull request is offered to the boards in this order. The first rule that matches keeps it.
          </Txt>
          <Txt as="p" variant="caption" tone="muted">
            After that, only its board’s card rules apply.
          </Txt>
        </div>
      )}
    </section>
  );
}
