// Fails a file listed in vitest.durable-storage-version.ts as soon as it builds a DurableAgent,
// since the list keeps it out of the second storage version pass. The count comes from the
// plugin next to that list.
import path from 'node:path';
import { afterAll, expect } from 'vitest';
import { durableTestsWithoutDurableAgent } from './vitest.durable-storage-version';

const g = globalThis as { __mastraDurableAgentsBuilt?: number };
// Read before the test file is imported, so agents built while it loads count too.
const before = g.__mastraDurableAgentsBuilt ?? 0;

afterAll(() => {
  const file = path
    .relative(__dirname, expect.getState().testPath ?? '')
    .split(path.sep)
    .join('/');
  if ((g.__mastraDurableAgentsBuilt ?? 0) > before && durableTestsWithoutDurableAgent.includes(file)) {
    throw new Error(
      `${file} builds a DurableAgent, so it has to run on both workflow storage versions. ` +
        'Remove it from packages/core/vitest.durable-storage-version.ts.',
    );
  }
});
