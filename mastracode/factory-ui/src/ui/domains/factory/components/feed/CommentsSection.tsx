import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { useRef, useState } from 'react';

import { useWorkItemComments } from '../../../../../hooks/useWorkItemComments';
import { itemBoard } from '../../boardStages';
import { factoryAttentionTargetPath } from '../../services/attention';
import type { WorkItem } from '../../services/workItems';
import { CommentComposer } from './CommentComposer';
import { CommentList } from './CommentList';
import type { FeedUser } from './CommentList';
import type { CommentQuoteDraft } from './CommentQuote';
import { commentAuthorName } from './CommentRow';

type FeedState = 'collapsed' | 'open' | 'compose';

function summaryLabel(commentCount: number, hasComments: boolean): string {
  if (commentCount > 0) return `Comments (${commentCount})`;
  return hasComments ? 'Comments' : 'Add a comment';
}

// The popover stays a glance surface: one summary row, the conversation behind it.
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
  const [quote, setQuote] = useState<CommentQuoteDraft | null>(null);
  const [feed, setFeed] = useState<FeedState>(highlightCommentId === undefined ? 'collapsed' : 'open');
  const lastHighlight = useRef(highlightCommentId);
  if (lastHighlight.current !== highlightCommentId) {
    lastHighlight.current = highlightCommentId;
    if (highlightCommentId !== undefined && feed === 'collapsed') setFeed('open');
  }

  const comments = useWorkItemComments({ workItemId: item.id, factoryProjectId, enabled });
  const newest = (comments.data?.pages ?? [])
    .flatMap(page => page.comments)
    .find(comment => comment.deletedAt === null);
  const open = feed !== 'collapsed';

  const toggle = () => {
    if (open) {
      setFeed('collapsed');
      return;
    }
    setFeed(item.commentCount === 0 && newest === undefined ? 'compose' : 'open');
  };

  return (
    <div className="border-border1 flex flex-col border-t" data-card-morph="reveal">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="text-ui-xs text-icon3 hover:bg-surface4/60 hover:text-icon5 focus-visible:outline-accent1 flex min-w-0 cursor-pointer items-center gap-1.5 px-3 py-2 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <MessageSquare size={13} aria-hidden className="shrink-0" />
        <span className="shrink-0">{summaryLabel(item.commentCount, newest !== undefined)}</span>
        {!open && newest ? (
          <span className="text-icon2 min-w-0 truncate">{`${commentAuthorName(newest)}: ${newest.body}`}</span>
        ) : null}
        <ChevronDown
          size={13}
          aria-hidden
          className={cn('ml-auto shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <>
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
              autoFocus={feed === 'compose'}
              quote={quote}
              onDismissQuote={() => setQuote(null)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
