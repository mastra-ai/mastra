/**
 * Pure save-time validation of stored workflow definitions. No Mastra access:
 * callers pass registered ids in as plain sets, keeping every check
 * unit-testable and the Mastra class down to thin orchestration.
 *
 * Save-path is strict (the author is right there and can fix the definition);
 * boot-time load is intentionally lenient so one bad pre-existing row can't
 * take down startup for every other workflow.
 */
import type { SerializedStepFlowEntry } from '../types';
import { forEachSingleStepEntry } from './graph';
import { validateStorableJsonSchema } from './json-schema-to-zod';
import type { StoredWorkflowGraph } from './rehydrate';

/**
 * Walk a stored workflow definition and throw a targeted error if any JSON
 * Schema uses a keyword `jsonSchemaToZod` cannot convert
 * (oneOf/anyOf/allOf/not/$ref/patternProperties/discriminator). Covers the
 * four top-level schemas plus each `agent.outputSchema` reachable through
 * `parallel`/`foreach`/`conditional`/`loop`.
 */
export function validateStoredWorkflowSchemas(def: StoredWorkflowGraph): void {
  const offenses: string[] = [];
  const check = (schema: Record<string, unknown> | undefined, label: string): void => {
    const result = validateStorableJsonSchema(schema);
    if (result.ok) return;
    offenses.push(`${label}: ${result.unsupported.join(', ')}`);
  };
  check(def.inputSchema, 'inputSchema');
  check(def.outputSchema, 'outputSchema');
  if (def.stateSchema) check(def.stateSchema, 'stateSchema');
  if (def.requestContextSchema) check(def.requestContextSchema, 'requestContextSchema');
  forEachSingleStepEntry(def.graph, entry => {
    if (entry.type === 'agent' && entry.outputSchema) {
      check(entry.outputSchema, `step "${entry.id}" outputSchema`);
    }
  });
  if (offenses.length > 0) {
    throw new Error(
      `addStoredWorkflow refused: stored workflow "${def.id}" uses JSON Schema keyword(s) jsonSchemaToZod cannot convert. Simplify the schema (or extend the converter) before saving.\n- ${offenses.join('\n- ')}`,
    );
  }
}

/**
 * The registered ids `validateStoredWorkflowRefs` resolves references
 * against. Plain data — the caller (Mastra) flattens its registries into
 * sets so the validation itself stays pure.
 */
export interface StoredWorkflowRefRegistries {
  /** Registered agent keys + agent ids. */
  agentIds: ReadonlySet<string>;
  /** Registered tool keys + tool ids. */
  toolIds: ReadonlySet<string>;
  /** Registered workflow keys. */
  workflowIds: ReadonlySet<string>;
}

/**
 * Walk a stored workflow graph and verify every referenced agent/tool/workflow
 * id exists in the correct registry. Throws with an actionable message listing
 * every offending id when references are unregistered or mis-classified.
 */
export function validateStoredWorkflowRefs(def: StoredWorkflowGraph, registries: StoredWorkflowRefRegistries): void {
  const agents: Array<{ stepId: string; agentId: string }> = [];
  const tools: Array<{ stepId: string; toolId: string }> = [];
  const workflows: Array<{ stepId: string; workflowId: string }> = [];
  forEachSingleStepEntry(def.graph, entry => {
    switch (entry.type) {
      case 'agent':
        agents.push({ stepId: entry.id, agentId: entry.agentId });
        return;
      case 'tool':
        tools.push({ stepId: entry.id, toolId: entry.toolId });
        return;
      case 'workflow':
        if (entry.id !== entry.workflowId) {
          throw new Error(
            `Nested workflow step id "${entry.id}" must match workflowId "${entry.workflowId}". Use "${entry.workflowId}" for both fields.`,
          );
        }
        workflows.push({ stepId: entry.id, workflowId: entry.workflowId });
        return;
      default:
        return;
    }
  });

  const errors: string[] = [];
  for (const ref of agents) {
    if (registries.agentIds.has(ref.agentId)) continue;
    if (registries.toolIds.has(ref.agentId)) {
      errors.push(
        `Step "${ref.stepId}" declares { type: "agent", agentId: "${ref.agentId}" } but "${ref.agentId}" is a registered TOOL, not an agent. Change this entry to { type: "tool", toolId: "${ref.agentId}" }.`,
      );
    } else {
      errors.push(`Step "${ref.stepId}" declares agentId "${ref.agentId}" which is not a registered agent.`);
    }
  }
  for (const ref of tools) {
    if (registries.toolIds.has(ref.toolId)) continue;
    if (registries.agentIds.has(ref.toolId)) {
      errors.push(
        `Step "${ref.stepId}" declares { type: "tool", toolId: "${ref.toolId}" } but "${ref.toolId}" is a registered AGENT, not a tool. Change this entry to { type: "agent", agentId: "${ref.toolId}" }.`,
      );
    } else {
      errors.push(`Step "${ref.stepId}" declares toolId "${ref.toolId}" which is not a registered tool.`);
    }
  }
  for (const ref of workflows) {
    if (ref.workflowId === def.id) {
      errors.push(
        `Step "${ref.stepId}" declares { type: "workflow", workflowId: "${ref.workflowId}" } which refers to itself. Nested workflow cycles are not allowed.`,
      );
      continue;
    }
    if (registries.workflowIds.has(ref.workflowId)) continue;
    errors.push(`Step "${ref.stepId}" declares workflowId "${ref.workflowId}" which is not a registered workflow.`);
  }
  if (errors.length > 0) {
    throw new Error(
      `addStoredWorkflow refused: ${errors.length} unresolved reference(s) in the graph.\n- ${errors.join('\n- ')}`,
    );
  }
}

/**
 * Collect the ids of every nested workflow referenced by a stored graph.
 * Used by boot-time loading to hydrate stored definitions in dependency order.
 */
export function collectNestedWorkflowIds(graph: readonly SerializedStepFlowEntry[]): Set<string> {
  const out = new Set<string>();
  forEachSingleStepEntry(graph, entry => {
    if (entry.type === 'workflow') out.add(entry.workflowId);
  });
  return out;
}
