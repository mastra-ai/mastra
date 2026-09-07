import { useState } from 'react';

import { itemBoard } from '../boardStages';
import type { AuditActorProfile, AuditEvent } from '../services/audit';
import { factoryAttentionTargetPath } from '../services/attention';
import type { WorkItem } from '../services/workItems';
import { CardSourceDescription, useSourceDescription } from './BoardCardDetails';
import { CommentComposer } from './feed/CommentComposer';
import { CommentList } from './feed/CommentList';
import type { FeedUser } from './feed/CommentList';
import type { CommentQuoteDraft } from './feed/CommentQuote';

// One stream in time order, runs and moves and comments alike, the composer under it.
export function WorkItemTray({
  item,
  factoryId,
  projectRepositoryId,
  enabled,
  currentUser,
  highlightCommentId,
  events,
  actors,
}: {
  item: WorkItem;
  factoryId: string;
  projectRepositoryId: string;
  /** Mounted only once the panel opens, so closed cards run no feed queries. */
  enabled: boolean;
  currentUser?: FeedUser;
  highlightCommentId?: string;
  events: AuditEvent[];
  actors: Record<string, AuditActorProfile>;
}) {
  const factoryProjectId = factoryId || undefined;
  const [quote, setQuote] = useState<CommentQuoteDraft>();
  const description = useSourceDescription(item, projectRepositoryId, factoryProjectId);

  return (
    <>
      <CommentList
        item={item}
        factoryProjectId={factoryProjectId}
        enabled={enabled}
        currentUser={currentUser}
        highlightCommentId={highlightCommentId}
        events={events}
        actors={actors}
        leadingLoaded={description === undefined || !description.isPending}
        leading={
          <div className="bg-surface4 mx-1 my-2 flex flex-col gap-2 rounded-lg p-3">
            <h3 className="text-ui-smd text-icon6 m-0 font-[550] wrap-anywhere">{item.title}</h3>
            <CardSourceDescription
              item={item}
              projectRepositoryId={projectRepositoryId}
              factoryProjectId={factoryProjectId}
            />
          </div>
        }
        commentUrl={commentId =>
          `${window.location.origin}${factoryAttentionTargetPath(factoryId, {
            kind: 'work-item',
            board: itemBoard(item),
            workItemId: item.id,
            commentId,
          })}`
        }
        onQuote={setQuote}
        className="min-h-0 grow px-1"
      />
      <div className="p-2">
        <CommentComposer
          workItemId={item.id}
          factoryProjectId={factoryProjectId}
          variant="panel"
          quote={quote}
          onDismissQuote={() => setQuote(undefined)}
        />
      </div>
    </>
  );
}
