import { aggregateTopics, stringToColor, TopicTraceDetailsPanel, TopicTraceSummaryList, TopicsLayout, useTraces } from '@mastra/playground-ui';
import type { TopicSubtopicWithCounts } from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { topics } from './topics-data';

function findSubtopicByTraceId(subtopics: TopicSubtopicWithCounts[], traceId: string | undefined) {
  if (!traceId) return undefined;
  return subtopics.find(subtopic => subtopic.traceSummaries.some(trace => trace.id === traceId));
}

export function TopicDetailsPage() {
  const navigate = useNavigate();
  const { topicId, traceId } = useParams();
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const aggregatedTopics = useMemo(() => aggregateTopics(topics), []);
  const subtopics = useMemo(() => aggregatedTopics.flatMap(topic => topic.subtopics), [aggregatedTopics]);
  const { data: tracesData } = useTraces({});
  const resolvedTraceId = tracesData?.spans[0]?.traceId ?? null;
  const selectedSubtopic = topicId
    ? subtopics.find(subtopic => subtopic.id === topicId)
    : findSubtopicByTraceId(subtopics, traceId);
  const selectedTraceId = traceId ?? null;

  const handleTraceSelect = () => {
    if (!selectedSubtopic || !resolvedTraceId) return;

    setSelectedSpanId(null);
    void navigate(`/topics/${selectedSubtopic.id}/traces/${resolvedTraceId}`);
  };

  const handleTraceClose = () => {
    setSelectedSpanId(null);
    void navigate(selectedSubtopic ? `/topics/${selectedSubtopic.id}` : '/topics');
  };

  return (
    <TopicsLayout
      sidebar={null}
      tracePanel={
        selectedTraceId ? (
          <TopicTraceDetailsPanel
            traceId={selectedTraceId}
            selectedSpanId={selectedSpanId}
            onSpanSelect={spanId => setSelectedSpanId(spanId ?? null)}
            onClose={handleTraceClose}
          />
        ) : null
      }
    >
      {selectedSubtopic ? (
        <section className="flex h-full min-w-0 flex-col gap-4">
          <header className="flex items-start gap-3">
            <span
              className="mt-2 h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: stringToColor(selectedSubtopic.name),
                viewTransitionName: `topics-${selectedSubtopic.id}-pill`,
              }}
            />
            <div className="min-w-0 space-y-1">
              <h1
                className="text-icon-xl font-semibold text-neutral6"
                style={{ viewTransitionName: `topics-${selectedSubtopic.id}-title` }}
              >
                {selectedSubtopic.name}
              </h1>
              {selectedSubtopic.description ? (
                <p
                  className="text-ui-sm text-neutral3"
                  style={{ viewTransitionName: `topics-${selectedSubtopic.id}-description` }}
                >
                  {selectedSubtopic.description}
                </p>
              ) : null}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden py-4">
            <TopicTraceSummaryList
              traces={selectedSubtopic.traceSummaries}
              selectedTraceId={selectedTraceId}
              onTraceSelect={handleTraceSelect}
            />
          </div>
        </section>
      ) : null}
    </TopicsLayout>
  );
}

export default TopicDetailsPage;
