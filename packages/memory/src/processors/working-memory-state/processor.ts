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

    const cacheKey = stableWorkingMemoryCacheKey({ format: template.format, data });
    const shouldRefreshSnapshot = Boolean(args.lastSnapshot && !args.contextWindow.hasSnapshot);
    if (args.tracking?.currentCacheKey === cacheKey && !shouldRefreshSnapshot) return;

    const mergedConfig = this.memory.getMergedThreadConfig(this.memoryConfig);
    const scope = mergedConfig.workingMemory?.scope ?? 'resource';

    return {
      id: WORKING_MEMORY_STATE_ID,
      mode: 'snapshot',
      cacheKey,
      tagName: 'working-memory',
      contents: renderWorkingMemoryAsSignalContents({ template, data }),
      value: {
        template: template.content,
        format: template.format,
        data,
      },
      attributes: {
        format: template.format,
        scope,
      },
    };
  }
}

/**
 * Build the model-facing payload for the working-memory state signal.
 *
 * The shape mirrors the system-message rendering used by
 * `getWorkingMemoryToolInstruction` (template wrapped in `<working_memory_template>`,
 * data wrapped in `<working_memory_data>`) so the model sees the same content,
 * just delivered as an in-line signal instead of a system message. Tool
 * invocation guidance is dropped here — the `update-working-memory` tool is
 * still bound and its schema description is the authoritative source.
 */
export function renderWorkingMemoryAsSignalContents({
  template,
  data,
}: {
  template: WorkingMemoryTemplate;
  data: string | null;
}): string {
  const body = data ?? 'No working memory data stored yet.';
  return [
    'Current working memory for this conversation. Update it via the updateWorkingMemory tool when relevant information changes.',
    '',
    `<working_memory_template>`,
    template.content,
    `</working_memory_template>`,
    '',
    `<working_memory_data>`,
    body,
    `</working_memory_data>`,
  ].join('\n');
}

/**
 * Stable cache key for the rendered working memory payload. Matches the
 * deterministic-JSON pattern used by `stableBrowserStateCacheKey` so dedup is
 * insensitive to incidental key ordering in the template/data inputs.
 */
export function stableWorkingMemoryCacheKey(input: {
  format: WorkingMemoryTemplate['format'];
  data: string | null;
}): string {
  return JSON.stringify({ format: input.format, data: input.data ?? '' }, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[key] = (value as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return value;
  });
}
