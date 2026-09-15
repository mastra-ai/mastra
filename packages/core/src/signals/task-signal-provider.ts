import type { InputProcessorOrWorkflow } from '../processors';
import { TaskStateProcessor } from '../tools/builtin/task-state-processor';
import { taskCheckTool, taskCompleteTool, taskUpdateTool, taskWriteTool } from '../tools/builtin/task-tools';

import { SignalProvider } from './signal-provider';

/**
 * Bundles the built-in task tools and the {@link TaskStateProcessor} behind a
 * single agent registration.
 *
 * The task list is held in the thread-scoped `tasks` storage domain (the
 * TaskStore) and projected onto the agent state-signal lane by
 * `TaskStateProcessor`. Wiring task tracking by hand means registering all four
 * task tools **and** the processor, and keeping them in sync — forget the
 * processor and the tools work for a single turn but silently lose the list
 * across turns. This provider wires both together so that cannot happen.
 *
 * Task tracking requires a memory-backed thread (`threadId` + `resourceId`) and
 * a Mastra `storage` instance (the `tasks` domain is always wired in-memory by
 * default). Without memory the tools no-op and report that task tracking
 * requires agent memory.
 *
 * @example
 * ```ts
 * import { Agent } from '@mastra/core/agent';
 * import { TaskSignalProvider } from '@mastra/core/signals';
 *
 * const agent = new Agent({
 *   name: 'coder',
 *   instructions: '...',
 *   model,
 *   memory,
 *   signals: [new TaskSignalProvider()],
 * });
 * ```
 *
 * The Agent automatically merges the tools into its toolset and registers the
 * processor on its input-processor chain (which propagates the Mastra instance
 * so the processor can resolve the TaskStore).
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export class TaskSignalProvider extends SignalProvider<'task-signals'> {
  readonly id = 'task-signals';

  readonly #processor = new TaskStateProcessor();

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this.#processor];
  }

  getTools() {
    return {
      task_write: taskWriteTool,
      task_update: taskUpdateTool,
      task_complete: taskCompleteTool,
      task_check: taskCheckTool,
    };
  }
}
