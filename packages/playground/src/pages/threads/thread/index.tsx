import type { FeedbackRecord } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import { AlertCircleIcon, ArrowLeftIcon, DownloadIcon, Link2Icon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ThreadTraceInspector } from '@/domains/threads-view/components/thread-trace-inspector';
import { ThreadTurnCard } from '@/domains/threads-view/components/thread-turn-card';
import { useConversationThreads } from '@/domains/threads-view/hooks/use-conversation-threads';
import { useReviewedTraceIds } from '@/domains/threads-view/hooks/use-thread-review-status';
import { buildConversationExport, downloadConversationJson } from '@/domains/threads-view/utils/export-conversation';

export default function ThreadPage() {
  const { threadKey } = useParams() as { threadKey: string };
  const navigate = useNavigate();
  const { data: threads, isLoading } = useConversationThreads();
  const { data: reviewedTraceIds } = useReviewedTraceIds();
  const thread = threads?.find(candidate => candidate.threadKey === threadKey);
  const [inspectedTraceId, setInspectedTraceId] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const client = useMastraClient();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('The link could not be copied.');
    }
  };

  const handleDownload = async () => {
    if (!thread) return;
    setIsExporting(true);
    try {
      const feedbackByTraceId = new Map<string, FeedbackRecord[]>();
      for (const turn of thread.turns) {
        const response = await client.listFeedback({
          filters: { traceId: turn.traceId },
          pagination: { page: 0, perPage: 100 },
        });
        feedbackByTraceId.set(turn.traceId, response.feedback);
      }
      downloadConversationJson(thread.threadKey, buildConversationExport(thread, feedbackByTraceId));
    } catch {
      toast.error('The conversation could not be exported.');
    } finally {
      setIsExporting(false);
    }
  };

  const reviewedTurns = thread?.turns.filter(turn => reviewedTraceIds?.has(turn.traceId)).length ?? 0;

  return (
    <PageLayout width="default" height="full">
      <PageLayout.TopArea>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon-md"
            variant="ghost"
            tooltip="All conversations"
            aria-label="All conversations"
            onClick={() => void navigate('/threads')}
          >
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0">
            <h1 className="text-ui-lg text-neutral6 truncate font-medium">Conversation review</h1>
            {thread && (
              <p className="text-ui-sm text-neutral3">
                {thread.turns.length} {thread.turns.length === 1 ? 'turn' : 'turns'}
                {thread.actors.length > 0 && <> · {thread.actors.join(', ')}</>}
                {' · '}
                {reviewedTurns}/{thread.turns.length} reviewed
              </p>
            )}
          </div>
          {thread?.hasErrors && (
            <span className="text-ui-sm text-accent2 flex items-center gap-1">
              <AlertCircleIcon className="size-4" /> Contains a failed turn
            </span>
          )}
          {thread && (
            <ButtonsGroup className="ml-auto">
              <Button type="button" size="md" tooltip="Copy conversation link" onClick={() => void handleCopyLink()}>
                <Link2Icon />
              </Button>
              <Button
                type="button"
                size="md"
                tooltip="Download conversation JSON"
                disabled={isExporting}
                onClick={() => void handleDownload()}
              >
                <DownloadIcon />
              </Button>
            </ButtonsGroup>
          )}
        </div>
      </PageLayout.TopArea>

      <div className="mx-auto grid w-full max-w-4xl content-start gap-4 overflow-y-auto pt-4">
        {isLoading ? (
          <p className="text-ui-md text-neutral3 py-16 text-center">Loading conversation…</p>
        ) : !thread ? (
          <div className="grid justify-items-center gap-3 py-16 text-center">
            <p className="text-ui-lg text-neutral5">This conversation is no longer available.</p>
            <Button type="button" variant="outline" onClick={() => void navigate('/threads')}>
              Back to all conversations
            </Button>
          </div>
        ) : (
          thread.turns.map((turn, index) => (
            <ThreadTurnCard key={turn.traceId} turn={turn} index={index} onInspectTrace={setInspectedTraceId} />
          ))
        )}
      </div>

      {inspectedTraceId && (
        <ThreadTraceInspector
          key={inspectedTraceId}
          traceId={inspectedTraceId}
          onClose={() => setInspectedTraceId(undefined)}
        />
      )}
    </PageLayout>
  );
}
