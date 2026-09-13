import { Button } from '@mastra/playground-ui/components/Button';
import { CommentQuote } from '@mastra/playground-ui/components/Comment';
import {
  Composer,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  ComposerSuggestions,
} from '@mastra/playground-ui/components/Composer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUp } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { useFactoryMembers } from '../../../../../hooks/useFactoryMembers';
import { useCreateWorkItemCommentMutation } from '../../../../../hooks/useWorkItemComments';
import { mentionLabel } from './mentions';
import type { CommentQuoteDraft } from './quoteDraft';
import { useMentionResolver } from './useMentionResolver';
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
  quote?: CommentQuoteDraft;
  onDismissQuote: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSend = useRef<{ body: string; clientToken: string } | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const createComment = useCreateWorkItemCommentMutation({ workItemId, factoryProjectId });
  const members = useFactoryMembers(factoryProjectId, { enabled: focused });
  const resolveMentions = useMentionResolver(factoryProjectId);
  const mentions = useMentionAutocomplete({ draft, setDraft, members: members.data ?? [], textareaRef });
  const suggestionsId = useId();
  const suggestionItems = mentions.suggestions.map(member => ({
    id: `${suggestionsId}-${encodeURIComponent(member.id)}`,
    label: mentionLabel(member),
  }));

  const sendComment = async () => {
    const body = draft.trim();
    if (body.length === 0 || createComment.isPending) return;
    if (pendingSend.current?.body !== body) pendingSend.current = { body, clientToken: crypto.randomUUID() };
    const { clientToken } = pendingSend.current;
    setSendError(undefined);
    setDraft('');
    createComment.mutate(
      {
        body,
        clientToken,
        ...(quote ? { replyTo: { commentId: quote.commentId, quote: quote.quote } } : {}),
        mentions: (await resolveMentions(body)) ?? [],
      },
      {
        onSuccess: () => {
          pendingSend.current = undefined;
          onDismissQuote();
        },
        onError: cause => {
          setSendError(cause instanceof Error ? cause.message : 'Unable to post comment');
          setDraft(current => (current.length === 0 ? body : current));
        },
      },
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (mentions.handleKeyDown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendComment();
    }
  };

  return (
    <Composer
      onSubmit={event => {
        event.preventDefault();
        void sendComment();
      }}
      aria-label="Add a comment"
    >
      <ComposerBox
        data-composing={variant === 'panel' && focused ? 'true' : undefined}
        className={variant === 'thread' ? 'rounded-none border-x-0 border-b-0' : 'rounded-xl'}
      >
        <ComposerSuggestions
          id={suggestionsId}
          items={suggestionItems}
          activeIndex={mentions.activeIndex}
          contextLabel="Mentions"
          onSelect={mentions.pickSuggestion}
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
          aria-autocomplete="list"
          aria-controls={suggestionItems.length > 0 ? suggestionsId : undefined}
          aria-activedescendant={suggestionItems[mentions.activeIndex]?.id}
          autoFocus={variant === 'thread'}
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
        {sendError ? (
          <p role="alert" className="text-ui-xs text-error m-0 px-3 pb-1">
            {sendError}
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
