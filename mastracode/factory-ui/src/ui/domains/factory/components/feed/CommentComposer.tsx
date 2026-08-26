import { Button } from '@mastra/playground-ui/components/Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput } from '@mastra/playground-ui/components/Composer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUp } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';

import { useFactoryMembers } from '../../../../../hooks/useFactoryMembers';
import { useCreateWorkItemCommentMutation } from '../../../../../hooks/useWorkItemComments';
import { ComposerSuggestions } from '../../../chat/components/ComposerParts';
import { CommentQuote } from './CommentQuote';
import type { CommentQuoteDraft } from './CommentQuote';
import { applyMention, findMentionQuery, matchMembers, mentionLabel, resolveMentions } from './mentions';

export function CommentComposer({
  workItemId,
  factoryProjectId,
  variant,
  autoFocus = false,
  quote,
  onDismissQuote,
}: {
  workItemId: string;
  factoryProjectId: string | undefined;
  variant: 'panel' | 'thread';
  autoFocus?: boolean;
  quote: CommentQuoteDraft | null;
  onDismissQuote: () => void;
}) {
  const hintId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const clientTokenRef = useRef<string | null>(null);
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createComment = useCreateWorkItemCommentMutation({ workItemId, factoryProjectId });
  const members = useFactoryMembers(factoryProjectId, { enabled: focused });

  const mentionQuery = findMentionQuery(draft, caret);
  const mentionKey = mentionQuery ? `${mentionQuery.start}:${mentionQuery.query}` : null;
  const dropdownOpen = mentionQuery !== null && mentionKey !== dismissedQuery;
  const suggestions = dropdownOpen ? matchMembers(members.data ?? [], mentionQuery.query) : [];

  const syncCaret = () => {
    const el = textareaRef.current;
    if (el) setCaret(el.selectionStart);
  };

  // Applied in a layout effect so the caret lands with the same commit as the
  // new value; a deferred restore (rAF) can fire after the next keystroke.
  const pendingCaretRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaretRef.current === null) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    }
    pendingCaretRef.current = null;
  }, [draft]);

  const pickSuggestion = (index: number) => {
    const member = suggestions[index];
    if (!member || !mentionQuery) return;
    const next = applyMention(draft, caret, mentionQuery, member);
    pendingCaretRef.current = next.caret;
    setDraft(next.text);
    setCaret(next.caret);
    setActiveIndex(0);
  };

  const send = () => {
    const body = draft.trim();
    if (body.length === 0 || createComment.isPending) return;
    clientTokenRef.current ??= crypto.randomUUID();
    setError(null);
    createComment.mutate(
      {
        body,
        clientToken: clientTokenRef.current,
        ...(quote ? { replyTo: { commentId: quote.commentId, quote: quote.quote } } : {}),
        mentions: resolveMentions(body, members.data ?? []),
      },
      {
        onSuccess: () => {
          clientTokenRef.current = null;
          setDraft('');
          setCaret(0);
          onDismissQuote();
        },
        onError: cause => {
          setError(cause instanceof Error ? cause.message : 'Unable to post comment');
        },
      },
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (dropdownOpen && suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex(index => (index + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pickSuggestion(activeIndex);
        return;
      }
      if (event.key === 'Escape') {
        // Only the dropdown closes: the popover behind must not dismiss with it.
        event.preventDefault();
        event.stopPropagation();
        setDismissedQuery(mentionKey);
        return;
      }
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  };

  return (
    <Composer
      onSubmit={event => {
        event.preventDefault();
        send();
      }}
      aria-label="Add a comment"
    >
      <ComposerBox data-composing={variant === 'panel' && focused ? 'true' : undefined} className="rounded-xl">
        <ComposerSuggestions
          items={suggestions.map(member => ({ id: member.id, label: mentionLabel(member) }))}
          activeIndex={activeIndex}
          contextLabel="Mentions"
          onSelect={pickSuggestion}
        />
        {quote ? (
          <CommentQuote
            authorName={quote.authorName}
            quote={quote.quote}
            onDismiss={onDismissQuote}
            className="mx-3 mt-2"
          />
        ) : null}
        <ComposerInput
          ref={textareaRef}
          value={draft}
          autoFocus={autoFocus}
          placeholder="Add a comment…"
          aria-label="Comment"
          aria-keyshortcuts="Meta+Enter Control+Enter"
          aria-describedby={hintId}
          maxHeight={variant === 'panel' ? '4.5rem' : '10rem'}
          className={cn('text-ui-sm', variant === 'panel' && 'min-h-9 pt-2')}
          onChange={event => {
            setDraft(event.target.value);
            setCaret(event.target.selectionStart);
            setActiveIndex(0);
          }}
          onSelect={syncCaret}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        {error ? (
          <p role="alert" className="text-ui-xs text-error m-0 px-3 pb-1">
            {error}
          </p>
        ) : null}
        <ComposerActions>
          <span id={hintId} className="text-ui-xs text-icon2 px-1.5">
            ⌘/Ctrl + Enter to send
          </span>
          <Button
            type="submit"
            variant="primary"
            size="icon-xs"
            aria-label="Send comment"
            disabled={draft.trim().length === 0 || createComment.isPending}
          >
            <ArrowUp aria-hidden />
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  );
}
