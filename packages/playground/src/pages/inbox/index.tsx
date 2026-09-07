import type { FeedbackRecord } from '@mastra/core/storage';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Tabs, Tab, TabList, TabContent } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ClipboardCheck, MessageSquare } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useFeedback, useUpdateFeedbackReviewStatus } from '@/domains/feedback/hooks/use-feedback';
import { InboxDatasetReviewList } from '@/domains/inbox/components/inbox-dataset-review-list';
import { InboxEmptyState } from '@/domains/inbox/components/inbox-empty-state';
import { InboxFeedbackList } from '@/domains/inbox/components/inbox-feedback-list';
import { InboxTracePanel } from '@/domains/inbox/components/inbox-trace-panel';
import { useInboxDatasetReviewItems } from '@/domains/review/hooks/use-inbox-review-items';

type InboxTab = 'dataset' | 'feedback';

function isInboxTab(value: string | null): value is InboxTab {
  return value === 'dataset' || value === 'feedback';
}

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: InboxTab = isInboxTab(tabParam) ? tabParam : 'feedback';
  // The inbox only surfaces items that still need review.
  const feedbackQuery = useFeedback({ reviewStatus: 'needs-review' });
  const updateReviewStatus = useUpdateFeedbackReviewStatus();
  const datasetReviewQuery = useInboxDatasetReviewItems();

  const datasetItems = datasetReviewQuery.data ?? [];
  const feedbackCount = feedbackQuery.total ?? 0;

  // Global empty state only once both lists are known to be empty; loading or
  // errors fall through to the tabs so each list can report its own state.
  const isInboxEmpty =
    !feedbackQuery.isLoading &&
    !datasetReviewQuery.isLoading &&
    !feedbackQuery.error &&
    !datasetReviewQuery.error &&
    feedbackQuery.items.length === 0 &&
    datasetItems.length === 0;

  // Selected feedback lives in the URL so the side panel survives refresh / back navigation.
  const selectedFeedbackId = searchParams.get('feedbackId') ?? undefined;
  const selectedTraceId = searchParams.get('traceId') ?? undefined;
  const selectedSpanId = searchParams.get('spanId') ?? undefined;

  const updateSelection = (next: { feedbackId?: string; traceId?: string; spanId?: string }) => {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev);
        for (const key of ['feedbackId', 'traceId', 'spanId'] as const) {
          const value = next[key];
          if (value) params.set(key, value);
          else params.delete(key);
        }
        return params;
      },
      { replace: true },
    );
  };

  const closePanel = () => updateSelection({});

  const selectFeedback = (feedback: FeedbackRecord) =>
    updateSelection({
      feedbackId: feedback.feedbackId ?? undefined,
      traceId: feedback.traceId ?? undefined,
      spanId: feedback.spanId ?? undefined,
    });

  // Prev/next in the panel walk the feedback list (every feedback is attached to a trace).
  const selectedIndex = feedbackQuery.items.findIndex(f => f.feedbackId === selectedFeedbackId);
  const selectedFeedback = selectedIndex >= 0 ? feedbackQuery.items[selectedIndex] : undefined;
  const previousFeedback = selectedIndex > 0 ? feedbackQuery.items[selectedIndex - 1] : undefined;
  const nextFeedback =
    selectedIndex >= 0 && selectedIndex < feedbackQuery.items.length - 1
      ? feedbackQuery.items[selectedIndex + 1]
      : undefined;
  const showPanel = !!selectedTraceId && !!selectedFeedbackId;

  const markReviewed = (feedbackId: string) => {
    updateReviewStatus.mutate(
      { feedbackId, reviewStatus: 'reviewed' },
      { onSuccess: () => feedbackId === selectedFeedbackId && closePanel() },
    );
  };

  const setTab = (tab: InboxTab) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="relative h-full overflow-hidden">
      <PageLayout height="full">
        <PageLayout.TopArea>
          <PageHeader>
            <PageHeader.Title>Inbox</PageHeader.Title>
            <PageHeader.Description>Items waiting for review</PageHeader.Description>
          </PageHeader>
        </PageLayout.TopArea>

        <PageLayout.MainArea className="min-h-0 overflow-hidden">
          {isInboxEmpty ? (
            <InboxEmptyState />
          ) : (
            <Tabs<InboxTab>
              defaultTab="feedback"
              value={activeTab}
              onValueChange={setTab}
              className="grid h-full min-h-0 grid-rows-[auto_1fr]"
            >
              <TabList variant="pill-ghost">
                <Tab value="feedback" className="px-3 py-2.5">
                  <Icon size="sm">
                    <MessageSquare />
                  </Icon>
                  <Txt variant="ui-sm" className="text-inherit">
                    Feedback
                  </Txt>
                  {feedbackCount > 0 && (
                    <Badge variant="yellow" size="sm">
                      {feedbackCount}
                    </Badge>
                  )}
                </Tab>
                <Tab value="dataset" className="px-3 py-2.5">
                  <Icon size="sm">
                    <ClipboardCheck />
                  </Icon>
                  <Txt variant="ui-sm" className="text-inherit">
                    Dataset items
                  </Txt>
                  {datasetItems.length > 0 && (
                    <Badge variant="yellow" size="sm">
                      {datasetItems.length}
                    </Badge>
                  )}
                </Tab>
              </TabList>

              <TabContent value="feedback" className="h-full min-h-0 pt-4">
                <InboxFeedbackList
                  items={feedbackQuery.items}
                  isLoading={feedbackQuery.isLoading}
                  error={feedbackQuery.error ?? undefined}
                  hasNextPage={feedbackQuery.hasNextPage}
                  isFetchingNextPage={feedbackQuery.isFetchingNextPage}
                  fetchNextPage={feedbackQuery.fetchNextPage}
                  onMarkReviewed={markReviewed}
                  pendingFeedbackId={
                    updateReviewStatus.isPending ? updateReviewStatus.variables?.feedbackId : undefined
                  }
                  onSelect={selectFeedback}
                  selectedFeedbackId={selectedFeedbackId}
                />
              </TabContent>

              <TabContent value="dataset" className="h-full min-h-0 pt-4">
                <InboxDatasetReviewList
                  items={datasetItems}
                  isLoading={datasetReviewQuery.isLoading}
                  error={datasetReviewQuery.error ?? undefined}
                />
              </TabContent>
            </Tabs>
          )}
        </PageLayout.MainArea>
      </PageLayout>

      {showPanel && selectedTraceId && selectedFeedback && (
        <InboxTracePanel
          key={`${selectedFeedbackId}:${selectedTraceId}`}
          feedback={selectedFeedback}
          traceId={selectedTraceId}
          initialSpanId={selectedSpanId}
          onClose={closePanel}
          onPrevious={previousFeedback ? () => selectFeedback(previousFeedback) : undefined}
          onNext={nextFeedback ? () => selectFeedback(nextFeedback) : undefined}
          onMarkReviewed={() => selectedFeedbackId && markReviewed(selectedFeedbackId)}
          isMarkingReviewed={updateReviewStatus.isPending}
        />
      )}
    </div>
  );
}
