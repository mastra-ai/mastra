/**
 * WorkingMemoryStateProcessor
 *
 * Experimental: delivers working memory to the model as a state signal instead
 * of folding it into the system message. Storage and the `update-working-memory`
 * tool are unchanged — this processor only changes the delivery path.
 *
 * Pattern matches `BrowserContextProcessor` in `@mastra/core/browser`:
 * - `stateId` namespaces the state lane on the thread.
 * - `cacheKey` is derived from the rendered payload so dedup is automatic.
 * - `contextWindow.hasSnapshot` re-injection ensures the model still sees the
 *   current snapshot after older messages drop out of the window.
 *
 * @example
 * ```ts
 * new Memory({
 *   options: {
 *     workingMemory: {
 *       enabled: true,
 *       template: '...',
 *       useStateSignals: true, // auto-attaches this processor
 *     },
 *   },
 * });
 * ```
 */

import { createHash } from 'node:crypto';

import type { MastraMemory, MemoryConfigInternal, WorkingMemoryTemplate } from '@mastra/core/memory';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';

export const WORKING_MEMORY_STATE_ID = 'working-memory';
export const WORKING_MEMORY_STATE_PROCESSOR_ID = 'working-memory-state';

export class WorkingMemoryStateProcessor implements Processor<typeof WORKING_MEMORY_STATE_PROCESSOR_ID> {
  readonly id = WORKING_MEMORY_STATE_PROCESSOR_ID;
  readonly stateId = WORKING_MEMORY_STATE_ID;

  constructor(
    private readonly memory: MastraMemory,
    private readonly memoryConfig?: MemoryConfigInternal,
  ) {}

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const template = await this.memory.getWorkingMemoryTemplate({ memoryConfig: this.memoryConfig });
    if (!template) return;

    const data = await this.memory.getWorkingMemory({
      threadId: args.threadId,
      resourceId: args.resourceId,
      memoryConfig: this.memoryConfig,
    });

    // Nothing stored yet — no state to broadcast. The setWorkingMemory tool
    // description tells the model the expected shape; the signal carries state.
    const contents = data?.trim();
    if (!contents) return;

    const cacheKey = stableWorkingMemoryCacheKey({ format: template.format, data: contents });
    const shouldRefreshSnapshot = Boolean(args.lastSnapshot && !args.contextWindow.hasSnapshot);
    if (args.tracking?.currentCacheKey === cacheKey && !shouldRefreshSnapshot) return;

    const mergedConfig = this.memory.getMergedThreadConfig(this.memoryConfig);
    const scope = mergedConfig.workingMemory?.scope ?? 'resource';

    return {
      id: WORKING_MEMORY_STATE_ID,
      mode: 'snapshot',
      cacheKey,
      tagName: 'working-memory',
      contents,
      value: { data: contents },
      attributes: {
        format: template.format,
        scope,
      },
    };
  }
}

/**
 * Stable cache key for the rendered working memory payload. Returns a SHA-256
 * digest so dedup metadata stays compact regardless of payload size (working
 * memory blobs can grow arbitrarily long).
 */
export function stableWorkingMemoryCacheKey(input: {
  format: WorkingMemoryTemplate['format'];
  data: string | null;
}): string {
  const hash = createHash('sha256');
  hash.update(input.format);
  hash.update('\0');
  hash.update(input.data ?? '');
  return `sha256:${hash.digest('hex')}`;
}
