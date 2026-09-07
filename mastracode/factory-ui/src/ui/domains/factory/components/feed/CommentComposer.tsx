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
import { mentionLabel } from './mentions';
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

  const sendComment = async () => {
    const body = draft.trim();
    if (body.length === 0 || createComment.isPending) return;
    // The token belongs to one body: a retry of the same text recovers the
    // stored comment, an edited draft after a failure is a different send.
    if (pendingSend.current?.body !== body) pendingSend.current = { body, clientToken: crypto.randomUUID() };
    const { clientToken } = pendingSend.current;
    setSendError(undefined);
    // The pending row carries the text, so the box clears message-app style.
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
          items={mentions.suggestions.map(member => ({ id: member.id, label: mentionLabel(member) }))}
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
