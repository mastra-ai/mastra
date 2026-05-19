import type { CallSettings } from '@internal/ai-sdk-v5';

export type ModelTimeoutSettings = {
  /**
   * Maximum time for the overall agent/model run, in milliseconds.
   */
  totalMs?: number;
  /**
   * Maximum time for a single model step, in milliseconds.
   */
  stepMs?: number;
};

export type MastraModelSettings = Omit<CallSettings, 'abortSignal'> & {
  timeout?: ModelTimeoutSettings;
};

export type ModelConfigModelSettings = Omit<MastraModelSettings, 'maxRetries' | 'headers'>;
