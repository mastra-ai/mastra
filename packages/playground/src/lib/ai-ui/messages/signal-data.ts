export type SignalData = {
  id?: string;
  type?: string;
  tagName?: string;
  contents?: unknown;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isSignalData = (value: unknown): value is SignalData => {
  if (!isRecord(value)) return false;
  return value.type === 'notification' || value.type === 'state' || value.type === 'reactive';
};
