import type { DatasetExperiment } from '@mastra/client-js';

import { experiment } from './experiment-item-route';

/** Same experiment while it is still queued: nothing processed yet. */
export const queuedExperiment: DatasetExperiment = {
  ...experiment,
  status: 'pending',
  succeededCount: 0,
  failedCount: 0,
  completedAt: null,
};

/** Same experiment mid-run: two of its three items are done, one of them errored. */
export const runningExperiment: DatasetExperiment = {
  ...experiment,
  status: 'running',
  succeededCount: 1,
  failedCount: 1,
  completedAt: null,
};

/** Mid-run, but the store never recorded when it started. */
export const runningExperimentWithoutStart: DatasetExperiment = {
  ...runningExperiment,
  startedAt: null,
};
