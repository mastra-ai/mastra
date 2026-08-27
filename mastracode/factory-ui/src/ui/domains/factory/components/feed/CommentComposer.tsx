import { Button } from '@mastra/playground-ui/components/Button';
import { Composer, ComposerActions, ComposerBox, ComposerInput } from '@mastra/playground-ui/components/Composer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUp } from 'lucide-react';
import { useRef, useState } from 'react';

import { useFactoryMembers } from '../../../../../hooks/useFactoryMembers';
import { useCreateWorkItemCommentMutation } from '../../../../../hooks/useWorkItemComments';
import { ComposerSuggestions } from '../../../chat/components/ComposerParts';
import { CommentQuote } from './CommentQuote';
import type { CommentQuoteDraft } from './CommentQuote';
import { mentionLabel, resolveMentions } from './mentions';
import { useMentionAutocomplete } from './useMentionAutocomplete';

export function CommentComposer({
  workItemId,
  factoryProjectId,
  variant,
  quote,
  onDismissQuote,
}: {
  workItemId: string;
  factoryProjectId: string | undefined;
  variant: 'panel' | 'thread';
  quote: CommentQuoteDraft | null;
  onDismissQuote: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const clientTokenRef = useRef<string | null>(null);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createComment = useCreateWorkItemCommentMutation({ workItemId, factoryProjectId });
  const members = useFactoryMembers(factoryProjectId, { enabled: focused });
  const mentions = useMentionAutocomplete({ draft, setDraft, members: members.data ?? [], textareaRef });

  const send = () => {
    const body = draft.trim();
    if (body.length === 0 || createComment.isPending) return;
    clientTokenRef.current ??= crypto.randomUUID();
    setError(null);
    // Cleared at send, message-app style; the pending row carries the text.
    setDraft('');
    mentions.reset();
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
          onDismissQuote();
        },
        onError: cause => {
          setError(cause instanceof Error ? cause.message : 'Unable to post comment');
          // Restore the failed body unless a new draft was started meanwhile.
          setDraft(current => (current.length === 0 ? body : current));
        },
      },
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // An IME commit fires Enter mid-composition; acting on it would send half a word.
    if (event.nativeEvent.isComposing) return;
    if (mentions.handleKeyDown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey) {
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
          items={mentions.suggestions.map(member => ({ id: member.id, label: mentionLabel(member) }))}
          activeIndex={mentions.activeIndex}
          contextLabel="Mentions"
          onSelect={mentions.pick}
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
          placeholder="Add a comment…"
          aria-label="Comment"
          maxHeight={variant === 'panel' ? '4.5rem' : '10rem'}
          className={cn('text-ui-sm', variant === 'panel' && 'min-h-9 pt-2')}
          onChange={event => {
            setDraft(event.target.value);
            mentions.onDraftChange(event.target.selectionStart);
          }}
          onSelect={mentions.syncCaret}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        {error ? (
          <p role="alert" className="text-ui-xs text-error m-0 px-3 pb-1">
            {error}
          </p>
        ) : null}
        <ComposerActions className="justify-end">
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
