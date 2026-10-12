/** Axis and tooltip labels for chart buckets, shared by the Metrics and Requests charts. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Over a day (with an hour of slack for "last 24 hours" presets), axes label days too. */
export const isMultiDay = (start: Date, end: Date) => end.getTime() - start.getTime() > DAY + HOUR;

export type BucketLabels = {
  /** Bucket start, ms since epoch: the x-axis puts its labels on round clock times from it. */
  ts: number;
  /** Axis label. */
  label: string;
  /** Axis label for a narrow chart that labels only its first and last bucket: always with the day. */
  edgeLabel: string;
  /** Tooltip heading. */
  time: string;
};

const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtHour = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric' });

export function bucketLabels(ts: number, stepHours: number, multiDay: boolean): BucketLabels {
  const d = new Date(ts);
  if (stepHours >= 24) {
    return {
      ts,
      label: fmtDay(d),
      edgeLabel: fmtDay(d),
      time: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  }
  const time = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
  const edgeLabel = `${fmtDay(d)}, ${fmtHour(d)}`;
  if (!multiDay) return { ts, label: fmtHour(d), edgeLabel, time };
  // Over several days the axis labels midnights with the day alone, other ticks with the hour.
  return { ts, label: d.getHours() === 0 ? fmtDay(d) : edgeLabel, edgeLabel, time };
}
