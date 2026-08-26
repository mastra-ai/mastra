import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, Link2, Pencil, Quote, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { relativeTime } from '../../../../../lib/date/relativeTime';
import type { WorkItemComment } from '../../services/commentsWire';
import { REVEAL_ON_CARD_HOVER } from '../BoardCardParts';
import { CommentQuote } from './CommentQuote';
import type { CommentQuoteDraft } from './CommentQuote';

const SELECTION_QUOTE_LIMIT = 280;
const WHOLE_BODY_QUOTE_LIMIT = 500;

export function commentAuthorName(comment: Pick<WorkItemComment, 'author'>): string {
  return comment.author.displayName ?? comment.author.id;
}

/** The selection inside `container` if any, else the whole body — both clamped. */
function quoteTextFor(container: HTMLElement | null, body: string): string {
  const selection = window.getSelection();
  const selected = selection?.toString().trim();
  if (selected && container && selection && container.contains(selection.anchorNode)) {
    return selected.slice(0, SELECTION_QUOTE_LIMIT);
  }
  return body.slice(0, WHOLE_BODY_QUOTE_LIMIT);
}

function RowAction({
  label,
  onClick,
  onMouseDown,
  children,
}: {
  label: string;
  onClick: () => void;
  onMouseDown?: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      tooltip={label}
      aria-label={label}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {children}
    </Button>
  );
}

export function CommentRow({
  comment,
  currentUserId,
  showHeader,
  pending = false,
  highlighted = false,
  commentUrl,
  onQuote,
  onSaveEdit,
  onDelete,
}: {
  comment: WorkItemComment;
  currentUserId?: string;
  showHeader: boolean;
  pending?: boolean;
  highlighted?: boolean;
  commentUrl?: string;
  onQuote?: (draft: CommentQuoteDraft) => void;
  onSaveEdit?: (body: string) => void;
  onDelete?: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const deleted = comment.deletedAt !== null;
  const own = comment.author.kind === 'user' && comment.author.id === currentUserId;
  const authorName = commentAuthorName(comment);

  const startEdit = () => {
    setDraft(comment.body);
    setEditing(true);
  };
  const saveEdit = () => {
    const body = draft.trim();
    if (body.length === 0 || body === comment.body) {
      setEditing(false);
      return;
    }
    onSaveEdit?.(body);
    setEditing(false);
  };
  const quoteReply = () => {
    onQuote?.({
      commentId: comment.id,
      quote: quoteTextFor(bodyRef.current, comment.body),
      authorName,
    });
  };

  return (
    <div
      data-comment-id={comment.id}
      aria-busy={pending || undefined}
      className={cn(
        'group hover:bg-surface3/60 relative flex gap-2 rounded-lg px-2 transition-opacity duration-300',
        showHeader ? 'py-1.5' : 'py-0.5',
        pending && 'opacity-60',
        highlighted && 'bg-accent1/10',
      )}
    >
      <div className="w-6 shrink-0 pt-0.5">
        {showHeader ? <Avatar src={comment.author.avatarUrl} name={authorName} size="sm" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        {showHeader ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-ui-sm text-icon6 truncate font-medium">{authorName}</span>
            <time dateTime={comment.occurredAt} className="text-ui-xs text-icon2 shrink-0">
              {relativeTime(comment.occurredAt)}
            </time>
          </div>
        ) : null}
        {comment.replyTo?.quote ? (
          <CommentQuote authorName={comment.replyTo.authorName} quote={comment.replyTo.quote} className="mt-1" />
        ) : null}
        {deleted ? (
          <p className="text-ui-sm text-icon2 m-0 italic">Comment deleted</p>
        ) : editing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              aria-label="Edit comment"
              rows={3}
              className="border-border1 bg-surface2 text-ui-sm text-icon6 focus:border-border2 w-full resize-y rounded-lg border px-2 py-1.5 outline-none"
            />
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" onClick={saveEdit}>
                <Check aria-hidden />
                Save
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X aria-hidden />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div ref={bodyRef} className="text-ui-sm">
            <MarkdownRenderer>{comment.body}</MarkdownRenderer>
            {comment.editedAt !== null ? <span className="text-ui-xs text-icon2 ml-1">(edited)</span> : null}
          </div>
        )}
      </div>
      {!deleted && !editing && !pending ? (
        <div
          className={cn(
            'bg-surface2 border-border1 absolute -top-2 right-2 flex items-center gap-0.5 rounded-lg border px-0.5',
            REVEAL_ON_CARD_HOVER,
          )}
        >
          {onQuote ? (
            <RowAction label="Quote reply" onClick={quoteReply} onMouseDown={event => event.preventDefault()}>
              <Quote aria-hidden />
            </RowAction>
          ) : null}
          {commentUrl ? (
            <RowAction label="Copy link" onClick={() => void navigator.clipboard.writeText(commentUrl)}>
              <Link2 aria-hidden />
            </RowAction>
          ) : null}
          {own && onSaveEdit ? (
            <RowAction label="Edit comment" onClick={startEdit}>
              <Pencil aria-hidden />
            </RowAction>
          ) : null}
          {own && onDelete ? (
            <RowAction label="Delete comment" onClick={onDelete}>
              <Trash2 aria-hidden />
            </RowAction>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
