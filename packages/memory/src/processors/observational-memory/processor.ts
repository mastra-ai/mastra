import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { Processor, ProcessInputStepArgs, ProcessOutputResultArgs } from '@mastra/core/processors';

import type { ObservationalMemory } from './observational-memory';

/**
 * Thin processor adapter for ObservationalMemory.
 *
 * Delegates all logic to the ObservationalMemory engine's processInputStep()
 * and processOutputResult() methods. This class exists solely to satisfy the
 * Processor interface so OM can participate in the agent lifecycle pipeline.
 */
export class ObservationalMemoryProcessor implements Processor<'observational-memory'> {
  readonly id = 'observational-memory' as const;
  readonly name = 'Observational Memory';

  /** The underlying ObservationalMemory engine. */
  readonly engine: ObservationalMemory;

  constructor(engine: ObservationalMemory) {
    this.engine = engine;
  }

  // ─── Processor lifecycle hooks ──────────────────────────────────────────

  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    return this.engine.processInputStep(args);
  }

  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList | MastraDBMessage[]> {
    return this.engine.processOutputResult(args);
  }

  // ─── Pass-through API (used by server handlers, playground) ─────────

  get config() {
    return this.engine.config;
  }

  waitForBuffering(threadId?: string, resourceId?: string) {
    return this.engine.waitForBuffering(threadId, resourceId);
  }

  getResolvedConfig() {
    return this.engine.getResolvedConfig();
  }

  static async awaitBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    scope: 'thread' | 'resource',
    timeoutMs?: number,
  ) {
    const { ObservationalMemory: OM } = await import('./observational-memory');
    return OM.awaitBuffering(threadId, resourceId, scope, timeoutMs);
  }
}
