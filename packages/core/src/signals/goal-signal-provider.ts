import type { InputProcessorOrWorkflow } from '../processors';
import { GoalStateProcessor } from '../tools/builtin/goal-state-processor';

import { SignalProvider } from './signal-provider';

/**
 * Bundles the {@link GoalStateProcessor} behind a single agent registration so
 * the agent's current objective is projected onto the state-signal lane.
 *
 * The objective is held in the thread-scoped `threadState` domain (under
 * `type: 'goal'`) and is set via {@link Agent.setObjective}; this provider only
 * projects it onto the model context. The Agent auto-registers this provider
 * when configured with `goal`, so configuring `goal` alone is enough.
 *
 * Goals require a memory-backed thread (`threadId` + `resourceId`) and a Mastra
 * `storage` instance. Without memory the objective methods no-op.
 *
 * @example
 * ```ts
 * import { Agent } from '@mastra/core/agent';
 * import { GoalSignalProvider } from '@mastra/core/signals';
 *
 * const agent = new Agent({
 *   name: 'worker',
 *   instructions: '...',
 *   model,
 *   memory,
 *   goal: { judge: judgeModel },
 *   signals: [new GoalSignalProvider()],
 * });
 * ```
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export class GoalSignalProvider extends SignalProvider<'goal-signals'> {
  readonly id = 'goal-signals';

  readonly #processor = new GoalStateProcessor();

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this.#processor];
  }
}
