import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CircleDashed, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { isOpenedLane, laneText } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { GithubOnlyBadge } from './GithubOnlyBadge';

function LaneHeading({ event }: { event: RuleEvent }) {
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

export function LaneCard({
  event,
  dimmed = false,
  children,
}: {
  event: RuleEvent;
  dimmed?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={laneText(event).label}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
        dimmed && 'opacity-60 focus-within:opacity-100 hover:opacity-100',
      )}
    >
      <LaneHeading event={event} />
      {children}
    </section>
  );
}

export function LaneEnd({ fallback, onAdd }: { fallback: ReactNode; onAdd: (() => void) | undefined }) {
  return (
    <li className="flex flex-wrap items-center gap-3">
      {fallback !== undefined && (
        <Txt as="span" variant="caption" tone="muted" className="flex flex-1 items-center gap-2.5 px-3 py-1.5">
          <CircleDashed className="size-icon-md shrink-0" aria-hidden />
          {fallback}
        </Txt>
      )}
      {onAdd && (
        <Button variant="ghost" size="sm" icon={<Plus />} onClick={onAdd}>
          Add rule
        </Button>
      )}
    </li>
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
