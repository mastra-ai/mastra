import { formatDuration } from '@mastra/playground-ui/utils/duration';

export const formatScore = (value: number | null) => (value != null ? value.toFixed(2) : '-');

export const formatDurationDelta = (ms: number) => formatDuration(ms) ?? '-';

export const diff = (value: number | null | undefined, baseline: number | null | undefined) =>
  value != null && baseline != null ? value - baseline : null;
