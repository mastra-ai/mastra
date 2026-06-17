import { stringToColor } from '@mastra/playground-ui';
import type { TopicSubtopicWithCounts } from '@mastra/playground-ui';

const TOPIC_CHART_CLUSTERS = [
  { label: 'Fast paths', count: 27, duration: 120, spans: 5 },
  { label: 'Standard paths', count: 27, duration: 620, spans: 14 },
  { label: 'Complex paths', count: 26, duration: 1280, spans: 28 },
];

export type TopicChartPoint = {
  id: string;
  name: string;
  cluster: string;
  duration: number;
  spans: number;
  color: string;
};

export function getTraceChartData(subtopics: TopicSubtopicWithCounts[]): TopicChartPoint[] {
  return subtopics.flatMap((subtopic, subtopicIndex) =>
    TOPIC_CHART_CLUSTERS.flatMap(cluster =>
      Array.from({ length: cluster.count }, (_, index) => {
        const offset = index - (cluster.count - 1) / 2;
        const durationJitter = ((index * 37 + subtopicIndex * 19) % 90) - 45;
        const durationScatter = Math.sin((index + 1 + subtopicIndex) * 1.7) * 34 + Math.cos((index + 3) * 0.9) * 21;
        const spanJitter = ((index * 11 + subtopicIndex * 3) % 7) - 3;

        return {
          id: `${subtopic.id}-${cluster.label.toLowerCase().replaceAll(' ', '-')}-${index + 1}`,
          name: `${subtopic.name} · ${cluster.label} ${index + 1}`,
          cluster: cluster.label,
          duration: Math.max(0, Math.round(cluster.duration + offset * 8 + durationJitter + durationScatter)),
          spans: Math.max(1, cluster.spans + spanJitter),
          color: stringToColor(`${subtopic.name}-${cluster.label}`),
        };
      }),
    ),
  );
}
