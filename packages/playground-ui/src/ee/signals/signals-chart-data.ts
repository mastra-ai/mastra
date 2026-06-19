import { stringToColor } from '../../lib/colors';
import type { SignalFacet } from './types';

const SIGNAL_CHART_CLUSTERS = [
  { label: 'Fast paths', count: 27, duration: 120, spans: 5 },
  { label: 'Standard paths', count: 27, duration: 620, spans: 14 },
  { label: 'Complex paths', count: 26, duration: 1280, spans: 28 },
];

export type SignalChartPoint = {
  id: string;
  name: string;
  cluster: string;
  duration: number;
  spans: number;
  color: string;
};

export function getSignalChartData(facets: SignalFacet[]): SignalChartPoint[] {
  return facets.flatMap((facet, facetIndex) =>
    SIGNAL_CHART_CLUSTERS.flatMap(cluster =>
      Array.from({ length: cluster.count }, (_, index) => {
        const offset = index - (cluster.count - 1) / 2;
        const durationJitter = ((index * 37 + facetIndex * 19) % 90) - 45;
        const durationScatter = Math.sin((index + 1 + facetIndex) * 1.7) * 34 + Math.cos((index + 3) * 0.9) * 21;
        const spanJitter = ((index * 11 + facetIndex * 3) % 7) - 3;

        return {
          id: `${facet.id}-${cluster.label.toLowerCase().replaceAll(' ', '-')}-${index + 1}`,
          name: `${facet.name} · ${cluster.label} ${index + 1}`,
          cluster: cluster.label,
          duration: Math.max(0, Math.round(cluster.duration + offset * 8 + durationJitter + durationScatter)),
          spans: Math.max(1, cluster.spans + spanJitter),
          color: stringToColor(`${facet.name}-${cluster.label}`),
        };
      }),
    ),
  );
}
