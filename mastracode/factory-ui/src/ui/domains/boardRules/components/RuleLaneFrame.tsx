import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { isOpenedLane, laneText } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { GithubOnlyBadge } from './GithubOnlyBadge';

export const LANE_CARD = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4';
export const LANE_FOOTER = 'flex flex-1 items-center gap-2.5 px-3 py-1.5';

export function LaneHeading({ event }: { event: RuleEvent }) {
  const text = laneText(event);
  const Icon = text.icon;
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <Icon className="text-badge-amber-indicator size-3.5 shrink-0" aria-hidden />
        <Txt as="h3" variant="label" tone="ink">
          {text.label}
        </Txt>
        {text.githubOnly && <GithubOnlyBadge />}
      </span>
      {text.description && (
        <Txt as="p" variant="caption" tone="muted">
          {text.description}
        </Txt>
      )}
    </div>
  );
}

export function LaneSection({
  title,
  events,
  chain,
  children,
}: {
  title: string;
  events: readonly RuleEvent[];
  chain: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Txt as="h2" variant="subheading" tone="ink">
          {title}
        </Txt>
        {events.some(isOpenedLane) ? (
          chain
        ) : (
          <Txt as="p" variant="caption" tone="muted">
            Only cards already on this board; other boards never see them.
          </Txt>
        )}
      </div>
      {children}
    </section>
  );
}
