import type { MastraDBMessage } from '@mastra/core/agent';

import type { Memory } from '../../../index';
import type { ObservationalMemory } from '../observational-memory';

export async function seedThreadAndEnsureObservations(opts: {
  memory: Memory;
  om: ObservationalMemory;
  threadId: string;
  seedMessages: MastraDBMessage[];
}): Promise<void> {
  const { memory, om, threadId, seedMessages } = opts;

  await memory.saveMessages({ messages: seedMessages });

  const observed = await om.observe({ threadId });

  if (!observed.observed || !observed.record.activeObservations) {
    throw new Error(
      'Seed phase did not produce active observations. Lower observationalMemory.observation.messageTokens for this demo.',
    );
  }
}
