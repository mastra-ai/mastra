import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { HoverCardContent } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { RefObject } from 'react';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import { WorkItemExternalLink } from '../../factory/components/WorkItemExternalLink';
import type { FactoryMentionMember } from '../../factory/services/members';
import type { WorkItem } from '../../factory/services/workItems';
import { useSessionTrail } from '../hooks/useSessionTrail';
import { layoutSessionTrack } from '../services/sessionTrack';
import type { SessionOwnerDetails } from '../services/sessionPresentation';
import type { SessionRowStatus } from '../services/sessionStatus';
import type { FactoryUserSession } from '../services/user-sessions';
import { SessionTrack } from './SessionTrack';

export interface SessionPreviewDetails {
  factoryId: string;
  session: FactoryUserSession;
  owner: SessionOwnerDetails;
  item?: WorkItem;
  threadId?: string;
}

const STATUS_LABELS: Record<SessionRowStatus, string> = {
  initializing: 'Initializing',
  working: 'Agent working',
  ready: 'Waiting on you',
};

export function SessionPreviewCard({
  name,
  anchor,
  status,
  merged,
  details,
}: {
  name: string;
  /** The sidebar row box — a stable anchor, unlike the label whose width follows the hover-revealed actions. */
  anchor: RefObject<HTMLElement | null>;
  status?: SessionRowStatus;
  merged?: boolean;
  details: SessionPreviewDetails;
}) {
  return (
    <HoverCardContent
      aria-label={`${name} session details`}
      anchor={anchor}
      side="right"
      align="start"
      sideOffset={8}
      collisionPadding={8}
      showArrow={false}
      className="w-80 max-w-[calc(100vw-2rem)]"
    >
      <SessionPreview name={name} status={status} merged={merged} details={details} />
    </HoverCardContent>
  );
}

/** Mounts only while the card is open, so the trail is fetched for the session being looked at, not every row. */
function SessionPreview({
  name,
  status,
  merged,
  details,
}: {
  name: string;
  status?: SessionRowStatus;
  merged?: boolean;
  details: SessionPreviewDetails;
}) {
  const [openedAt] = useState(Date.now);
  const { runs, ownerChanges, people } = useSessionTrail({
    factoryId: details.factoryId,
    sessionRowId: details.session.id,
    threadId: details.threadId,
  });
  const startedAt = Date.parse(details.session.createdAt);
  const layout = layoutSessionTrack({
    startedAt,
    now: openedAt,
    stageHistory: details.item?.stageHistory ?? [],
    runs,
    ownerChanges,
  });
  const previousOwnerId = ownerChanges.at(-1)?.fromOwnerId;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <Txt as="p" variant="label" tone="ink" className="m-0 line-clamp-2 wrap-anywhere">
          {name}
        </Txt>
        <div className="flex items-center justify-between gap-3">
          <SessionOwner
            owner={details.owner}
            previousOwner={previousOwnerId === undefined ? undefined : ownerDetailsFor(people, previousOwnerId)}
          />
          {details.item && <WorkItemExternalLink item={details.item} variant="default" />}
        </div>
      </div>
      <SessionStatusLine status={status} merged={merged} />
      {(layout.stages.length > 0 || layout.runs.length > 0) && (
        <SessionTrack layout={layout} startedAt={startedAt} now={openedAt} people={people} />
      )}
    </div>
  );
}

function ownerDetailsFor(people: ReadonlyMap<string, FactoryMentionMember>, personId: string): SessionOwnerDetails {
  const person = people.get(personId);
  return { name: person?.name ?? personId, ...(person?.avatarUrl ? { avatarUrl: person.avatarUrl } : {}) };
}

function SessionOwner({ owner, previousOwner }: { owner: SessionOwnerDetails; previousOwner?: SessionOwnerDetails }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {previousOwner && (
        <>
          <span className="sr-only">Taken over from {previousOwner.name}</span>
          <span aria-hidden title={`Previously ${previousOwner.name}`} className="flex items-center gap-1.5">
            <span className="flex opacity-50">
              <Avatar src={previousOwner.avatarUrl} name={previousOwner.name} size="inline" />
            </span>
            <ArrowRight className="text-placeholder size-2.5" />
          </span>
        </>
      )}
      <Avatar src={owner.avatarUrl} name={owner.name} size="inline" />
      <Txt as="span" variant="caption" tone="muted" className="truncate">
        {owner.name}
      </Txt>
    </div>
  );
}

function SessionStatusLine({ status, merged }: { status?: SessionRowStatus; merged?: boolean }) {
  if (status) {
    return (
      <div className="flex items-center gap-2">
        {/* `session-*` sets the hue the sidebar belt shows for the same status. */}
        <span aria-hidden className={cn('size-[7px] shrink-0 rounded-sm bg-(--belt-hue)', `session-${status}`)} />
        <Txt as="span" variant="caption" tone="ink">
          {STATUS_LABELS[status]}
        </Txt>
      </div>
    );
  }
  if (!merged) return null;
  return (
    <div className="flex items-center gap-2">
      <PullRequestStatusIcon status="merged" size={12} decorative />
      <Txt as="span" variant="caption" tone="ink">
        Merged
      </Txt>
    </div>
  );
}
