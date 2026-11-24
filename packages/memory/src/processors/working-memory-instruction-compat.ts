import type { MemoryConfigInternal, WorkingMemoryTemplate } from '@mastra/core/memory';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { ProcessInputArgs, ProcessInputResult, Processor } from '@mastra/core/processors';
import type { MemoryStorage } from '@mastra/core/storage';

/**
 * Local copy of `WorkingMemoryInstructionArgs` from `@mastra/core/processors`. Importing it would put the name in
 * the published declarations, and the peer range includes cores that don't export it, so consumers type-checking
 * with `skipLibCheck: false` would get TS2305. Keep in sync with
 * packages/core/src/processors/memory/working-memory.ts; type-tests/working-memory-instruction-args.test-d.ts
 * fails if the two drift.
 */
export type WorkingMemoryInstructionArgs =
  | { kind: 'tool' | 'vnext'; template: WorkingMemoryTemplate; data: string | null }
  | {
      kind: 'read-only';
      template: WorkingMemoryTemplate;
      data: string | null;
      /** True when the app updates working memory (`agentManaged: false`), false for `readOnly`. */
      autoUpdated: boolean;
    };

export interface WorkingMemoryInstructionCompatOptions {
  storage: MemoryStorage;
  template?: WorkingMemoryTemplate;
  scope?: 'thread' | 'resource';
  useVNext: boolean;
  readOnly?: boolean;
  agentManaged?: boolean;
  /** Used when neither `getWorkingMemoryTemplate` nor `template` gives a template. */
  defaultTemplate: string;
  getWorkingMemoryTemplate(args: { memoryConfig?: MemoryConfigInternal }): Promise<WorkingMemoryTemplate | null>;
  /** Renders the instruction using normalized `data: string | null`. An empty string adds no system message. */
  renderInstruction(args: WorkingMemoryInstructionArgs): string;
}

/**
 * Stand-in for core's `WorkingMemory` input processor on `@mastra/core` versions whose processor renders its own
 * built-in instruction text and has no instruction provider (every core before `getWorkingMemoryInstruction`
 * was added to `MastraMemory`, including 1.86.0-alpha.1 through 1.86.0-alpha.5). `Memory.getInputProcessors()`
 * swaps it in for the auto-created processor on those cores, so `Memory` subclass instruction overrides reach
 * the model there too (#29752).
 *
 * Loading and caching match core's `WorkingMemory.processInput` exactly; only the instruction comes from the
 * memory instance. Keep it in sync with packages/core/src/processors/memory/working-memory.ts.
 */
export class WorkingMemoryInstructionCompat implements Processor<'working-memory'> {
  readonly id = 'working-memory';
  readonly name = 'WorkingMemory';

  constructor(private readonly options: WorkingMemoryInstructionCompatOptions) {}

  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const { messageList, requestContext } = args;

    const memoryContext = parseMemoryRequestContext(requestContext);
    const threadId = memoryContext?.thread?.id;
    const resourceId = memoryContext?.resourceId;
    if (!memoryContext || (!threadId && !resourceId)) {
      return messageList;
    }

    const scope = this.options.scope || 'resource';
    const memoryRunState = memoryContext.runState?.();

    let workingMemoryData: string | null = null;
    if (scope === 'thread' && threadId) {
      // The thread was already loaded and ownership-validated during run preparation.
      const thread = memoryRunState?.thread ?? (await this.options.storage.getThreadById({ threadId }));
      const stored = thread?.metadata?.workingMemory;
      workingMemoryData = typeof stored === 'string' && stored ? stored : null;
    } else if (scope === 'resource' && resourceId) {
      const loadWorkingMemory = async () => {
        const resource = await this.options.storage.getResourceById({ resourceId });
        return typeof resource?.workingMemory === 'string' && resource.workingMemory ? resource.workingMemory : null;
      };
      workingMemoryData = memoryRunState
        ? await memoryRunState.load(`working-memory:resource:${resourceId}`, loadWorkingMemory)
        : await loadWorkingMemory();
    }

    const loadTemplate = () =>
      this.options.getWorkingMemoryTemplate({
        memoryConfig: memoryContext.memoryConfig,
      });
    const dynamicTemplate = memoryRunState
      ? await memoryRunState.load('working-memory:template', loadTemplate)
      : await loadTemplate();
    const template: WorkingMemoryTemplate = dynamicTemplate ||
      this.options.template || { format: 'markdown', content: this.options.defaultTemplate };

    // Read-only when configured, or when the agent has no updateWorkingMemory tool (agentManaged: false).
    // With agentManaged: false the app still updates the memory, so the agent must not claim it can't.
    const workingMemoryConfig = memoryContext.memoryConfig?.workingMemory;
    const isConfiguredReadOnly = Boolean(this.options.readOnly || memoryContext.memoryConfig?.readOnly);
    const isAppManaged =
      this.options.agentManaged === false ||
      (typeof workingMemoryConfig === 'object' && workingMemoryConfig.agentManaged === false);

    const instruction = this.options.renderInstruction(
      isConfiguredReadOnly || isAppManaged
        ? { kind: 'read-only', template, data: workingMemoryData, autoUpdated: !isConfiguredReadOnly }
        : { kind: this.options.useVNext ? 'vnext' : 'tool', template, data: workingMemoryData },
    );

    if (instruction) {
      messageList.addSystem(instruction, 'memory');
    }
    return messageList;
  }
}
