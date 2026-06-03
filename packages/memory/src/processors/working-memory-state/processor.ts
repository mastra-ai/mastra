/**
 * WorkingMemoryStateProcessor
 *
 * Experimental: delivers working memory to the model as a state signal instead
 * of folding it into the system message. Storage and the `setWorkingMemory`
 * tool are unchanged — this processor only changes the delivery path.
 *
 * Pattern matches `BrowserContextProcessor` in `@mastra/core/browser`:
 * - `stateId` namespaces the state lane on the thread.
 * - `cacheKey` is derived from the rendered payload so dedup is automatic.
 * - `contextWindow.hasSnapshot` re-injection ensures the model still sees the
 *   current snapshot after older messages drop out of the window.
 *
 * Delta emission (markdown mode only): when a prior snapshot exists in the
 * context window, the processor emits a unified-diff delta against that
 * snapshot's contents. Schema mode and the snapshot fallback always emit a
 * full snapshot.
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
import type {
  ComputeStateSignalArgs,
  ComputeStateSignalResult,
  Processor,
  ProcessorActiveStateSignal,
} from '@mastra/core/processors';
import { structuredPatch } from 'diff';

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

    const deltaCandidate =
      template.format === 'markdown' && !shouldRefreshSnapshot
        ? buildMarkdownDelta({
            lastSnapshot: args.lastSnapshot,
            nextContents: contents,
          })
        : undefined;

    if (deltaCandidate) {
      return {
        id: WORKING_MEMORY_STATE_ID,
        mode: 'delta',
        cacheKey,
        tagName: 'working-memory',
        contents: deltaCandidate.contents,
        attributes: {
          format: template.format,
          scope,
          patch: 'unified-diff',
        },
      };
    }

    return {
      id: WORKING_MEMORY_STATE_ID,
      mode: 'snapshot',
      cacheKey,
      tagName: 'working-memory',
      contents,
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

/**
 * Build a unified-diff delta from the prior snapshot's contents to the next
 * full contents. Returns undefined when:
 * - there's no prior snapshot to diff against
 * - the prior snapshot's contents aren't a plain string (multimodal signal)
 * - the rendered patch would be at least as large as the next snapshot
 *
 * In any of these cases the caller falls back to emitting a full snapshot.
 */
function buildMarkdownDelta(args: {
  lastSnapshot?: ProcessorActiveStateSignal;
  nextContents: string;
}): { contents: string } | undefined {
  const { lastSnapshot, nextContents } = args;
  if (!lastSnapshot) return undefined;

  const prior = typeof lastSnapshot.contents === 'string' ? lastSnapshot.contents : undefined;
  if (prior === undefined) return undefined;
  if (prior === nextContents) return undefined;

  const patch = renderHunksOnly(prior, nextContents);
  if (patch.length >= nextContents.length) return undefined;

  return { contents: patch };
}

/**
 * Render a unified-diff-style patch body containing only `@@` hunks and their
 * lines — dropping the filename preamble (`Index:` / `===` / `---` / `+++`)
 * that `createPatch` emits and the `\ No newline at end of file` trailer.
 * The preamble exists for tooling like `patch -p1` to know which file to
 * apply to; we only ever diff a single working-memory blob. The newline
 * trailer is semantically meaningless to the model and adds ~30 bytes of
 * noise that can flip the snapshot-vs-delta size guard against the delta.
 */
function renderHunksOnly(prior: string, next: string): string {
  const { hunks } = structuredPatch('', '', prior, next, '', '', { context: 3 });
  return hunks
    .map(hunk => {
      const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
      const lines = hunk.lines.filter(line => !line.startsWith('\\ No newline at end of file'));
      return [header, ...lines].join('\n');
    })
    .join('\n');
}
