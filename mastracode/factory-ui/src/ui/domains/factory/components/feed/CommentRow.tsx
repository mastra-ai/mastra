import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  CommentEditor,
  CommentItem,
  CommentItemActions,
  CommentItemAuthor,
  CommentItemAvatar,
  CommentItemBody,
  CommentItemContent,
  CommentItemHeader,
  CommentItemTimestamp,
  CommentQuote,
} from '@mastra/playground-ui/components/Comment';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Link2, Pencil, Quote, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Ref } from 'react';

import { relativeTime } from '../../../../../lib/date/relativeTime';
import type { WorkItemComment } from '../../services/commentsWire';
import type { CommentQuoteDraft } from './quoteDraft';

// A hand-picked passage is quoted as picked; quoting a whole comment gets more
// room, since the reader has no highlight to tell them what mattered.
const MAX_SELECTION_QUOTE_CHARS = 280;
const MAX_BODY_QUOTE_CHARS = 500;

function commentAuthorName(comment: Pick<WorkItemComment, 'author'>): string {
  return comment.author.displayName ?? comment.author.id;
}

/** The highlighted text, only when both ends of the highlight sit in `container`. */
function selectionWithin(container: HTMLElement | null): string | undefined {
  const selection = window.getSelection();
  if (!selection || !container) return undefined;
  if (!container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) return undefined;
  return selection.toString().trim() || undefined;
}

function quoteTextFor(container: HTMLElement | null, body: string): string {
  const selected = selectionWithin(container);
  return selected ? selected.slice(0, MAX_SELECTION_QUOTE_CHARS) : body.slice(0, MAX_BODY_QUOTE_CHARS);
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
  ref,
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
  ref?: Ref<HTMLElement>;
  comment: WorkItemComment;
  currentUserId?: string;
  showHeader: boolean;
  pending?: boolean;
  highlighted?: boolean;
  commentUrl?: string;
  onQuote?: (draft: CommentQuoteDraft) => void;
  onSaveEdit?: (body: string) => Promise<void>;
  onDelete?: () => void;
}) {
  const bodyRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const deleted = comment.deletedAt !== undefined;
  const own = comment.author.kind === 'user' && comment.author.id === currentUserId;
  const authorName = commentAuthorName(comment);

  const quoteReply = () => {
    onQuote?.({
      commentId: comment.id,
      quote: quoteTextFor(bodyRef.current, comment.body),
      authorName,
    });
  };

  return (
    <CommentItem ref={ref} aria-busy={pending || undefined} continued={!showHeader} highlighted={highlighted}>
      <CommentItemAvatar>
        {showHeader ? <Avatar src={comment.author.avatarUrl} name={authorName} size="sm" /> : null}
      </CommentItemAvatar>
      <CommentItemContent>
        {showHeader ? (
          <CommentItemHeader>
            <CommentItemAuthor>{authorName}</CommentItemAuthor>
            <CommentItemTimestamp dateTime={comment.occurredAt}>
              {relativeTime(comment.occurredAt)}
            </CommentItemTimestamp>
          </CommentItemHeader>
        ) : null}
        {comment.replyTo?.quote ? (
          <CommentQuote authorName={comment.replyTo.authorName} quote={comment.replyTo.quote} className="mt-1" />
        ) : null}
        {deleted ? (
          <p className="text-ui-sm text-icon2 m-0 italic">Comment deleted</p>
        ) : editing ? (
          <CommentEditor
            initialBody={comment.body}
            onSave={onSaveEdit}
            onClose={() => {
              setEditing(false);
            }}
          />
        ) : (
          <CommentItemBody ref={bodyRef}>
            <MarkdownRenderer>{comment.body}</MarkdownRenderer>
            {comment.editedAt ? <span className="text-ui-xs text-icon2 ml-1">(edited)</span> : null}
          </CommentItemBody>
        )}
      </CommentItemContent>
      {!deleted && !editing && !pending ? (
        <CommentItemActions>
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
            <RowAction
              label="Edit comment"
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil aria-hidden />
            </RowAction>
          ) : null}
          {own && onDelete ? (
            <RowAction label="Delete comment" onClick={onDelete}>
              <Trash2 aria-hidden />
            </RowAction>
          ) : null}
        </CommentItemActions>
      ) : null}
    </CommentItem>
  );
}
