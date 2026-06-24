import { stringToColor } from '../../lib/colors';
import type { SignalCluster } from './types';

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

export function getSignalChartData(clusters: SignalCluster[]): SignalChartPoint[] {
  return clusters.flatMap((cluster, clusterIndex) =>
    SIGNAL_CHART_CLUSTERS.flatMap(path =>
      Array.from({ length: path.count }, (_, index) => {
        const offset = index - (path.count - 1) / 2;
        const durationJitter = ((index * 37 + clusterIndex * 19) % 90) - 45;
        const durationScatter = Math.sin((index + 1 + clusterIndex) * 1.7) * 34 + Math.cos((index + 3) * 0.9) * 21;
        const spanJitter = ((index * 11 + clusterIndex * 3) % 7) - 3;

        return {
          id: `${cluster.id}-${path.label.toLowerCase().replaceAll(' ', '-')}-${index + 1}`,
          name: `${cluster.name} · ${path.label} ${index + 1}`,
          cluster: path.label,
          duration: Math.max(0, Math.round(path.duration + offset * 8 + durationJitter + durationScatter)),
          spans: Math.max(1, path.spans + spanJitter),
          color: stringToColor(`${cluster.name}-${path.label}`),
        };
      }),
    ),
  );
}
