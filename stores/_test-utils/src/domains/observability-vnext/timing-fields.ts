/** The timing columns share query semantics: numbers that can be empty, with empty values sorted last. */
export const TIMING_FIELDS = [
  { field: 'timeToFirstChunkMs', sortFeature: 'trace-query-time-to-first-chunk-sort' },
  { field: 'timeToFirstTokenMs', sortFeature: 'trace-query-time-to-first-token-sort' },
] as const;

export type TimingField = (typeof TIMING_FIELDS)[number]['field'];

/** A span record override that sets only `field`. */
export const timingValue = (field: TimingField, value: number | null) =>
  field === 'timeToFirstChunkMs' ? { timeToFirstChunkMs: value } : { timeToFirstTokenMs: value };
