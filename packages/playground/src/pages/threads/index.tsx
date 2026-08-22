import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { getReadableTraceInput } from '@mastra/playground-ui/domains/traces/utils/trace-review-utils';
import { cn } from '@mastra/playground-ui/utils/cn';
import { format } from 'date-fns';
import { AlertCircleIcon, CheckCircle2Icon, CircleDashedIcon, MessagesSquareIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ConversationThread } from '@/domains/threads-view/hooks/use-conversation-threads';
import { useConversationThreads } from '@/domains/threads-view/hooks/use-conversation-threads';
import { useReviewedTraceIds } from '@/domains/threads-view/hooks/use-thread-review-status';

function ThreadCard({
  thread,
  reviewedTraceIds,
  onOpen,
}: {
  thread: ConversationThread;
  reviewedTraceIds?: Set<string>;
  onOpen: () => void;
}) {
  const firstTurn = thread.turns[0];
  const readable = firstTurn ? getReadableTraceInput(firstTurn.input) : '';
  const previewSource = readable || firstTurn?.name || thread.threadKey;
  const preview = previewSource.length > 120 ? `${previewSource.slice(0, 120)}…` : previewSource;
  const reviewedTurns = thread.turns.filter(turn => reviewedTraceIds?.has(turn.traceId)).length;
  const fullyReviewed = reviewedTurns === thread.turns.length && thread.turns.length > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full rounded-xl border border-border1 bg-surface2 px-4 py-3 text-left transition-colors hover:bg-surface3',
        'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral5/55',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-ui-md text-neutral6 line-clamp-2">{preview}</p>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-ui-sm',
            fullyReviewed ? 'bg-surface5 text-neutral5' : 'bg-surface4 text-neutral3',
          )}
        >
          {fullyReviewed ? <CheckCircle2Icon className="size-3.5" /> : <CircleDashedIcon className="size-3.5" />}
          {fullyReviewed ? 'Reviewed' : `${reviewedTurns}/${thread.turns.length} reviewed`}
        </span>
      </div>
      <div className="text-ui-sm text-neutral3 mt-2 flex flex-wrap items-center gap-2">
        <span>
          {thread.turns.length} {thread.turns.length === 1 ? 'turn' : 'turns'}
        </span>
        {thread.actors.map(actor => (
          <span key={actor} className="bg-surface5 text-neutral4 rounded-full px-2 py-0.5">
            {actor}
          </span>
        ))}
        {thread.hasErrors && (
          <span className="text-accent2 flex items-center gap-1">
            <AlertCircleIcon className="size-3.5" /> Error
          </span>
        )}
        <span className="ml-auto tabular-nums">{format(new Date(thread.lastActivityAt), 'MMM d, h:mm aaa')}</span>
      </div>
    </button>
  );
}

export default function ThreadsPage() {
  const { data: threads, isLoading, error } = useConversationThreads();
  const { data: reviewedTraceIds } = useReviewedTraceIds();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageLayout width="default" height="full">
        <PageLayout.MainArea isCentered>
          <p className="text-ui-md text-neutral3">Loading conversations…</p>
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  if (error || !threads || threads.length === 0) {
    return (
      <PageLayout width="default" height="full">
        <PageLayout.MainArea isCentered>
          <div className="grid justify-items-center gap-2 text-center">
            <MessagesSquareIcon className="text-neutral3 size-8" />
            <p className="text-ui-lg text-neutral5">No conversations yet</p>
            <p className="text-ui-md text-neutral3 max-w-[45ch]">
              Threads group an agent's turns into one reviewable conversation. Run an agent to see its conversations
              here.
            </p>
          </div>
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="default" height="full">
      <div className="mx-auto grid w-full max-w-3xl content-start gap-2 overflow-y-auto">
        {threads.map(thread => (
          <ThreadCard
            key={thread.threadKey}
            thread={thread}
            reviewedTraceIds={reviewedTraceIds}
            onOpen={() => void navigate(`/threads/${encodeURIComponent(thread.threadKey)}`)}
          />
        ))}
      </div>
    </PageLayout>
  );
}
