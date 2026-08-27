import { useState } from 'react';

import { itemBoard } from '../../boardStages';
import { factoryAttentionTargetPath } from '../../services/attention';
import type { WorkItem } from '../../services/workItems';
import { CommentComposer } from './CommentComposer';
import { CommentList } from './CommentList';
import type { FeedUser } from './CommentList';
import type { CommentQuoteDraft } from './CommentQuote';

// Mounted only once the popover opens, so closed cards run no feed queries.
export function CommentsSection({
  item,
  factoryId,
  enabled,
  currentUser,
  highlightCommentId,
}: {
  item: WorkItem;
  factoryId: string;
  enabled: boolean;
  currentUser?: FeedUser;
  highlightCommentId?: string;
}) {
  const factoryProjectId = factoryId || undefined;
  const [quote, setQuote] = useState<CommentQuoteDraft>();

  return (
    <div className="border-border1 flex flex-col border-t" data-card-morph="reveal">
      <CommentList
        item={item}
        factoryProjectId={factoryProjectId}
        enabled={enabled}
        currentUser={currentUser}
        highlightCommentId={highlightCommentId}
        commentUrl={commentId =>
          `${window.location.origin}${factoryAttentionTargetPath(factoryId, {
            kind: 'work-item',
            board: itemBoard(item),
            workItemId: item.id,
            commentId,
          })}`
        }
        onQuote={setQuote}
        maxHeight="min(16rem, 40vh)"
        className="px-1"
      />
      <div className="px-3 py-2">
        <CommentComposer
          workItemId={item.id}
          factoryProjectId={factoryProjectId}
          variant="panel"
          quote={quote}
          onDismissQuote={() => setQuote(undefined)}
        />
      </div>
    </div>
  );
}
