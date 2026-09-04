import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link2, Pencil, Quote, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent, Ref } from 'react';

import { relativeTime } from '../../../../../lib/date/relativeTime';
import type { WorkItemComment } from '../../services/commentsWire';
import { REVEAL_ON_CARD_HOVER } from '../BoardCardParts';
import { CommentQuote } from './CommentQuote';
import type { CommentQuoteDraft } from './CommentQuote';

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

/**
 * Owns the draft so a failed save keeps what was typed; closing is the parent's
 * call, and only ever happens on a save that landed or on cancel.
 */
function CommentEditor({
  initialBody,
  onSave,
  onClose,
}: {
  initialBody: string;
  onSave?: (body: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialBody);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body = draft.trim();
    if (body.length === 0) {
      setError('Comment body must not be empty.');
      return;
    }
    if (body === initialBody) {
      onClose();
      return;
    }
    // One save in flight per row: a second one would carry the same expected
    // revision and race its own predecessor.
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSave?.(body);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save comment');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // An IME commit fires Enter mid-composition; acting on it would save half a word.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div className="relative">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Edit comment"
          rows={2}
          className="border-border1 bg-surface2 text-ui-sm text-icon6 focus:border-border2 block field-sizing-content max-h-40 w-full resize-none overflow-y-auto rounded-lg border px-2 pt-1.5 pb-9 outline-none"
        />
        {/* Opaque, so a scrolled line passes behind the actions instead of under them. */}
        <div className="bg-surface2 absolute inset-x-px bottom-px flex items-center justify-end gap-1 rounded-b-lg px-1.5 pt-1 pb-1.5">
          <Button type="button" variant="ghost" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-ui-xs text-error m-0">
          {error}
        </p>
      ) : null}
    </div>
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
  ref?: Ref<HTMLDivElement>;
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
  const bodyRef = useRef<HTMLDivElement | null>(null);
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
    <div
      ref={ref}
      aria-busy={pending || undefined}
      className={cn(
        'group hover:bg-surface3/60 relative flex gap-2 rounded-lg px-2',
        showHeader ? 'py-1.5' : 'py-0.5',
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
          <CommentEditor
            initialBody={comment.body}
            onSave={onSaveEdit}
            onClose={() => {
              setEditing(false);
            }}
          />
        ) : (
          <div ref={bodyRef} className="text-ui-sm">
            <MarkdownRenderer>{comment.body}</MarkdownRenderer>
            {comment.editedAt ? <span className="text-ui-xs text-icon2 ml-1">(edited)</span> : null}
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
        </div>
      ) : null}
    </div>
  );
}
