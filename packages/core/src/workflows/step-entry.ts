import { z } from 'zod';
import type { Mastra } from '../mastra';
import { toStandardSchema } from '../schema';
import type { Step } from './step';
import type { SingleStepEntry } from './types';
import type { Workflow } from './workflow';

/**
 * Accessors for the {@link SingleStepEntry} union.
 *
 * This module is the single place allowed to pattern-match the union's shape.
 * Everything else (both engines, handlers, utils) should go through these
 * helpers so that adding a new variant means changing exactly one file.
 *
 * Union *shape* questions (id, retries, schemas, …) live here; how each
 * declarative kind is *interpreted* at run time lives in `./entry-executors`.
 */

/**
 * The id of a single step-like entry. Plain `step` entries key off the wrapped
 * step's id; declarative variants (agent / tool / mapping) carry their own `id`.
 */
export function getEntryId(entry: SingleStepEntry): string {
  return entry.type === 'step' ? entry.step.id : entry.id;
}

/**
 * The effective retry count for an entry, falling back to the provided
 * workflow-level default when the entry doesn't declare its own.
 *
 * - `step` — the step's own `retries`
 * - `agent` / `tool` — the declarative `options.retries`
 * - `mapping` — never declares retries; always the fallback
 */
export function getEntryRetries(entry: SingleStepEntry, fallback?: number): number | undefined {
  switch (entry.type) {
    case 'step':
      return entry.step.retries ?? fallback;
    case 'agent':
    case 'tool':
      return entry.options?.retries ?? fallback;
    case 'mapping':
      return fallback;
  }
}

/**
 * The `component` discriminator of the entry, if any. Only plain `step`
 * entries can carry one (notably `'WORKFLOW'` for nested workflows);
 * declarative variants have none.
 */
export function getEntryComponent(entry: SingleStepEntry): string | undefined {
  return entry.type === 'step' ? (entry.step as { component?: string }).component : undefined;
}

/**
 * Probes an entry for a nested workflow. Only the `type: 'step'` variant can
 * wrap a live `Workflow` (identified by its `component === 'WORKFLOW'`
 * discriminator from MastraBase); declarative variants never nest one.
 */
export function getEntryWorkflow(entry: SingleStepEntry): Workflow | null {
  if (entry.type !== 'step') {
    return null;
  }
  const step = entry.step as unknown as { component?: string };
  if (step && typeof step === 'object' && step.component === 'WORKFLOW') {
    return entry.step as unknown as Workflow;
  }
  return null;
}

/**
 * The human-readable description of the entry, if any. Declarative variants
 * don't carry a live description (agent descriptions live on the agent itself).
 */
export function getEntryDescription(entry: SingleStepEntry): string | undefined {
  return entry.type === 'step' ? entry.step.description : undefined;
}

/**
 * The validation schemas of an entry, used by the engines to validate step
 * input / suspend / resume data without materializing a live Step.
 *
 * - `step` — the step's own schemas
 * - `agent` — the fixed `{ prompt: string }` input contract (mirrors `createStepFromAgent`)
 * - `tool` — the resolved tool's schemas
 * - `mapping` — none (mappings accept and return anything)
 *
 * Never throws: when a tool can't be resolved the schemas are simply empty and
 * the run path surfaces the actionable not-found error.
 */
export function getEntrySchemas(
  entry: SingleStepEntry,
  mastra?: Mastra,
): Partial<Pick<Step<string, any, any>, 'inputSchema' | 'resumeSchema' | 'suspendSchema'>> {
  switch (entry.type) {
    case 'step':
      return {
        inputSchema: entry.step.inputSchema,
        resumeSchema: entry.step.resumeSchema,
        suspendSchema: entry.step.suspendSchema,
      };
    case 'agent':
      return { inputSchema: toStandardSchema(z.object({ prompt: z.string() })) };
    case 'tool': {
      let tool: { inputSchema?: any; resumeSchema?: any; suspendSchema?: any } | undefined;
      try {
        tool = entry.tool ?? mastra?.getTool(entry.toolId);
      } catch {
        tool = undefined;
      }
      return tool
        ? { inputSchema: tool.inputSchema, resumeSchema: tool.resumeSchema, suspendSchema: tool.suspendSchema }
        : {};
    }
    case 'mapping':
      return {};
  }
}
