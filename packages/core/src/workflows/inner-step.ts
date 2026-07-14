import type { Mastra } from '../mastra';
import type { Step } from './step';
import type { SingleStepEntry } from './types';
import { getSingleStepEntryId } from './utils';
import { createStepFromAgent, createStepFromTool } from './workflow';

/**
 * Identity of the inner step of a `foreach` or `loop` entry.
 *
 * Both `foreach.step` and `loop.step` are typed as {@link SingleStepEntry}. Only
 * the `{ type: 'step' }` variant nests a live `Step` at `.step`; the declarative
 * variants (`agent` / `tool` / `mapping`) carry their id directly on the outer
 * entry. This helper collapses that difference so callers can key `stepResults`
 * (and equivalent maps) off a single stable id regardless of variant.
 */
export function getInnerStepId(inner: SingleStepEntry): string {
  return getSingleStepEntryId(inner);
}

/**
 * Materialize a runnable {@link Step} from a `foreach` / `loop` inner
 * {@link SingleStepEntry}.
 *
 * - `type: 'step'` — return the wrapped live step as-is.
 * - `type: 'agent'` — prefer the inline `agent` handle, otherwise resolve via
 *   `mastra.getAgentById(agentId)`, then wrap through `createStepFromAgent` so
 *   the step preserves the entry's `id` and any declared `options`
 *   (`structuredOutput`, `retries`, `metadata`).
 * - `type: 'tool'` — same shape, via `createStepFromTool`.
 * - `type: 'mapping'` — throws: `mapping` cannot be an inner step for `foreach`
 *   or `loop` (mirrors the guards already applied at the builder / rehydration
 *   boundary).
 */
export function materializeInnerStep(inner: SingleStepEntry | Step, mastra?: Mastra): Step {
  // Legacy shape: raw live Step (no discriminating `type` field). Test callers
  // and older external code may still pass a Step directly.
  if (!('type' in inner)) {
    return inner as Step;
  }
  if (inner.type === 'step') {
    return inner.step;
  }
  if (inner.type === 'agent') {
    if (!mastra) {
      throw new Error(`materializeInnerStep requires a Mastra instance for agent entries (id: ${inner.id})`);
    }
    const agent = inner.agent ?? mastra.getAgentById(inner.agentId);
    return { ...createStepFromAgent(agent, inner.options), id: inner.id } as Step;
  }
  if (inner.type === 'tool') {
    if (!mastra) {
      throw new Error(`materializeInnerStep requires a Mastra instance for tool entries (id: ${inner.id})`);
    }
    const tool = inner.tool ?? mastra.getTool(inner.toolId);
    return { ...createStepFromTool(tool, inner.options), id: inner.id } as Step;
  }
  throw new Error(
    `mapping steps cannot be used as an inner step for foreach() / loop() (id: ${(inner as { id?: string }).id ?? 'unknown'})`,
  );
}
