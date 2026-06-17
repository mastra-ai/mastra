import {
  aggregateTopics,
  stringToColor,
  TopicTraceDetailsPanel,
  TopicTraceSummaryList,
  TopicsLayout,
  useTraces,
} from '@mastra/playground-ui';
import type { TopicSubtopicWithCounts, TopicWithCounts } from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { topics } from './topics-data';

function findSubtopicByTraceId(subtopics: TopicSubtopicWithCounts[], traceId: string | undefined) {
  if (!traceId) return undefined;
  return subtopics.find(subtopic => subtopic.traceSummaries.some(trace => trace.id === traceId));
}

interface TopicsCardsProps {
  topics: TopicWithCounts[];
  onSubtopicSelect: (subtopic: TopicSubtopicWithCounts) => void;
}

function TopicsCards({ topics, onSubtopicSelect }: TopicsCardsProps) {
  return (
    <section className="flex h-full min-w-0 flex-col gap-6 overflow-auto p-6">
      <div className="space-y-8">
        {topics.map(topic => (
          <section key={topic.id} className="space-y-3">
            <h2 className="text-ui-xs font-medium uppercase tracking-wide text-neutral2">{topic.name}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topic.subtopics.map(subtopic => (
                <button
                  key={subtopic.id}
                  type="button"
                  onClick={() => onSubtopicSelect(subtopic)}
                  className="cursor-pointer rounded-xl border border-border1 bg-surface2 p-4 text-left transition-colors hover:bg-surface3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: stringToColor(subtopic.name),
                        viewTransitionName: `topics-${subtopic.id}-pill`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-icon-lg font-semibold text-neutral5" style={{ viewTransitionName: `topics-${subtopic.id}-title` }}>
                        {subtopic.name}
                      </h3>
                      {subtopic.description ? (
                        <p className="mt-2 line-clamp-2 text-ui-sm text-neutral3" style={{ viewTransitionName: `topics-${subtopic.id}-description` }}>
                          {subtopic.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-ui-xs text-neutral2">{subtopic.traceCount} traces</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function TopicsPage() {
  const navigate = useNavigate();
  const { topicId, traceId } = useParams();
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const aggregatedTopics = useMemo(() => aggregateTopics(topics), []);
  const subtopics = useMemo(() => aggregatedTopics.flatMap(topic => topic.subtopics), [aggregatedTopics]);
  const { data: tracesData } = useTraces({});
  const resolvedTraceId = tracesData?.spans[0]?.traceId ?? null;
  const selectedSubtopic = topicId ? subtopics.find(subtopic => subtopic.id === topicId) : findSubtopicByTraceId(subtopics, traceId);
  const selectedTraceId = traceId ?? null;

  const handleSubtopicSelect = (subtopic: TopicSubtopicWithCounts) => {
    setSelectedSpanId(null);
    navigate(`/topics/${subtopic.id}`, { viewTransition: true });
  };

  const handleTraceSelect = () => {
    if (!selectedSubtopic || !resolvedTraceId) return;

    setSelectedSpanId(null);
    navigate(`/topics/${selectedSubtopic.id}/traces/${resolvedTraceId}`);
  };

  const handleTraceClose = () => {
    setSelectedSpanId(null);
    navigate(selectedSubtopic ? `/topics/${selectedSubtopic.id}` : '/topics');
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
              <h1 className="text-icon-xl font-semibold text-neutral6" style={{ viewTransitionName: `topics-${selectedSubtopic.id}-title` }}>
                {selectedSubtopic.name}
              </h1>
              {selectedSubtopic.description ? (
                <p className="text-ui-sm text-neutral3" style={{ viewTransitionName: `topics-${selectedSubtopic.id}-description` }}>
                  {selectedSubtopic.description}
                </p>
              ) : null}
            </div>
          </header>
          <TopicTraceSummaryList
            traces={selectedSubtopic.traceSummaries}
            selectedTraceId={selectedTraceId}
            onTraceSelect={handleTraceSelect}
          />
        </section>
      ) : (
        <TopicsCards topics={aggregatedTopics} onSubtopicSelect={handleSubtopicSelect} />
      )}
    </TopicsLayout>
  );
}
