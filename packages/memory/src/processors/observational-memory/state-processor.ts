import { createHash } from 'node:crypto';

import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';

import type { ObservationalMemory } from './observational-memory';

export const OBSERVATIONAL_MEMORY_STATE_ID = 'observational-memory';
export const OBSERVATIONAL_MEMORY_STATE_PROCESSOR_ID = 'observational-memory-state';

/**
 * Delivers Observational Memory's extracted values (current task, suggested response and custom
 * extractors) as a state signal, so they stay out of the system prompt. Enabled by
 * `observationalMemory.stateSignals`; the OM processor then leaves the sections out of its context, except on
 * read-only calls, which keep them there because a state signal is saved to the thread.
 */
export class ObservationalMemoryStateProcessor implements Processor<typeof OBSERVATIONAL_MEMORY_STATE_PROCESSOR_ID> {
  readonly id = OBSERVATIONAL_MEMORY_STATE_PROCESSOR_ID;
  readonly stateId = OBSERVATIONAL_MEMORY_STATE_ID;

  constructor(private readonly engine: ObservationalMemory) {}

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    // A state signal is saved to the thread, so read-only calls keep the sections in the system prompt instead.
    if (parseMemoryRequestContext(args.requestContext)?.memoryConfig?.readOnly) return;

    const contents = await this.engine.buildExtractedValueStateContents(args.threadId);
    // Once values were sent, an empty state replaces them; a thread that never had any gets nothing.
    if (!contents && !args.tracking?.currentCacheKey) return;

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
