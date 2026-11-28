import type { ReactNode } from 'react';

import { SourceDescriptionLines } from './card-description';
import { overviewSectionClass } from './session-layout';
import { Txt } from '@/ds/components/Txt';

export function SectionLoadError({ children }: { children: string }) {
  return (
    <Txt variant="caption" tone="muted" className="m-0 px-2">
      {children}
    </Txt>
  );
}

/** The overview while it loads; `workspace` is the host's placeholder for its workspace section. */
export function OverviewSkeleton({ workspace }: { workspace?: ReactNode }) {
  return (
    <>
      <section role="status" aria-label="Loading overview" className={overviewSectionClass}>
        <SourceDescriptionLines />
      </section>
      {workspace}
    </>
  );
}

export interface CardOverviewProps {
  /** The card's own change request, linked above the source row. */
  reference?: ReactNode;
  /** The upstream source row, e.g. `CardSourceRow`. */
  source?: ReactNode;
  /** The card's body, e.g. `CardDescription`. */
  description?: ReactNode;
  /** A section of the host's own between the card and its activity. */
  workspace?: ReactNode;
  /** Change requests, related cards, load errors and the moves graph; the section hides when empty. */
  activity?: ReactNode;
}

/** A card's overview in the session panel: the card, an optional workspace section, then its activity. */
export function CardOverview({ reference, source, description, workspace, activity }: CardOverviewProps) {
  return (
    <>
      <section aria-label="Card" className={`${overviewSectionClass} empty:hidden`}>
        {reference}
        {source}
        {description}
      </section>
      {workspace}
      {activity ? (
        <section aria-label="Card activity" className={overviewSectionClass}>
          {activity}
        </section>
      ) : null}
    </>
  );
}
