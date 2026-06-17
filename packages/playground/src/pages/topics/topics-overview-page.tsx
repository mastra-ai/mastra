import { aggregateTopics, Badge, ScatterPlotChart, stringToColor, TopicsLayout } from '@mastra/playground-ui';
import type { TopicSubtopicWithCounts, TopicWithCounts } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { getTraceChartData } from './topics-chart-data';
import { topics } from './topics-data';

interface TopicsListProps {
  topics: TopicWithCounts[];
  onSubtopicSelect: (subtopic: TopicSubtopicWithCounts) => void;
}

function TopicsList({ topics, onSubtopicSelect }: TopicsListProps) {
  return (
    <nav
      className="min-h-0 min-w-0 overflow-y-auto border-r border-border1/60 py-1 px-3 space-y-4 py-6"
      aria-label="Topic groups"
    >
      {topics.map(topic => (
        <section key={topic.id}>
          <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-neutral2 pl-6 pr-3 pb-2">
            {topic.name}
          </h2>

          <div className="space-y-1">
            {topic.subtopics.map(subtopic => (
              <button
                key={subtopic.id}
                type="button"
                className="cursor-pointer w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1"
                onClick={() => onSubtopicSelect(subtopic)}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: stringToColor(subtopic.name),
                      viewTransitionName: `topics-${subtopic.id}-pill`,
                    }}
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <h3
                      className="block truncate text-sm font-medium text-neutral5 font-medium"
                      style={{ viewTransitionName: `topics-${subtopic.id}-title` }}
                    >
                      {subtopic.name}
                    </h3>

                    {subtopic.description ? (
                      <p
                        className="line-clamp-2 block text-sm text-neutral2 pb-1"
                        style={{ viewTransitionName: `topics-${subtopic.id}-description` }}
                      >
                        {subtopic.description}
                      </p>
                    ) : null}

                    <Badge variant="default">
                      {subtopic.traceCount} {subtopic.traceCount === 1 ? 'trace' : 'traces'}
                    </Badge>
                  </div>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function TopicsOverviewPage() {
  const navigate = useNavigate();
  const aggregatedTopics = useMemo(() => aggregateTopics(topics), []);
  const subtopics = useMemo(() => aggregatedTopics.flatMap(topic => topic.subtopics), [aggregatedTopics]);
  const chartData = useMemo(() => getTraceChartData(subtopics), [subtopics]);

  const handleSubtopicSelect = (subtopic: TopicSubtopicWithCounts) => {
    void navigate(`/topics/${subtopic.id}`, { viewTransition: true });
  };

  return (
    <TopicsLayout sidebar={null} contentPadding={false}>
      <section className="grid h-full min-w-0 grid-cols-[24rem_minmax(0,1fr)]">
        <TopicsList topics={aggregatedTopics} onSubtopicSelect={handleSubtopicSelect} />
        <section className="flex min-h-0 min-w-0 flex-col px-6 py-4" aria-label="Topics trace distribution">
          <ScatterPlotChart
            data={chartData}
            xKey="duration"
            yKey="spans"
            nameKey="name"
            colorKey="color"
            height="100%"
            className="h-full"
            xLabel="Duration"
            yLabel="Spans"
            formatX={value => `${value}ms`}
            formatY={value => `${value} spans`}
          />
        </section>
      </section>
    </TopicsLayout>
  );
}

export default TopicsOverviewPage;
