import { createHash } from 'node:crypto';

import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';

import type { ObservationalMemory } from './observational-memory';

export const OBSERVATIONAL_MEMORY_STATE_ID = 'observational-memory';
export const OBSERVATIONAL_MEMORY_STATE_PROCESSOR_ID = 'observational-memory-state';

/**
 * Delivers Observational Memory's extracted values (current task, suggested response and custom
 * extractors) as a state signal, so they stay out of the system prompt. Enabled by
 * `observationalMemory.stateSignals`; the OM processor then leaves the sections out of its context.
 */
export class ObservationalMemoryStateProcessor implements Processor<typeof OBSERVATIONAL_MEMORY_STATE_PROCESSOR_ID> {
  readonly id = OBSERVATIONAL_MEMORY_STATE_PROCESSOR_ID;
  readonly stateId = OBSERVATIONAL_MEMORY_STATE_ID;

  constructor(private readonly engine: ObservationalMemory) {}

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const contents = await this.engine.buildExtractedValueStateContents(args.threadId);
    if (!contents) return;

    const cacheKey = `sha256:${createHash('sha256').update(contents).digest('hex')}`;
    if (args.tracking?.currentCacheKey === cacheKey && args.contextWindow.hasSnapshot) return;

    return {
      id: OBSERVATIONAL_MEMORY_STATE_ID,
      mode: 'snapshot',
      cacheKey,
      tagName: 'observational-memory',
      contents,
    };
  }
}
