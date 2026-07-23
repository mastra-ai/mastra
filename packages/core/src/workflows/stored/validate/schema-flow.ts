/**
 * Schema-flow analysis: a small type-checker over the workflow graph.
 *
 * Folds an inferred "current schema" through the top-level entries — each
 * step's output feeds the next step's input — and reports a proven mismatch
 * as `incompatible-schema`. Mapping configs are analyzed here (via
 * `mapping-config.ts`) because a mapping's validity and its output schema are
 * inseparable. Unknown schemas degrade to `undefined` and never produce false
 * positives.
 *
 * Unlike the old preflight implementation, state is threaded explicitly:
 * `fold` takes the incoming schema and returns the outgoing one — no
 * closure-mutable `currentSchema` with save/restore tricks.
 */
import type { SerializedSingleStepEntry } from '../../types';
import type { JsonSchema } from '../json-schema-to-zod';
import { analyzeMapConfig } from '../mapping-config';
import { isRecord, schemaCompatibility } from './schema-utils';
import { leafEntryId } from './types';
import type { WorkflowRegistryIndex, WorkflowValidationInput, WorkflowValidationIssue } from './types';

export interface GraphSchemaInference {
  /** Output schema of each id-bearing top-level step (undefined = unknown). */
  stepOutputs: Map<string, JsonSchema | undefined>;
  /** Inferred output of the last entry in the graph (undefined = unknown). */
  finalOutput: JsonSchema | undefined;
  issues: WorkflowValidationIssue[];
}

/** Agents accept `{ prompt }` unless the registry says otherwise. */
const agentInputSchema: JsonSchema = {
  type: 'object',
  properties: { prompt: { type: 'string' } },
  required: ['prompt'],
};

function inputSchemaOf(entry: SerializedSingleStepEntry, index: WorkflowRegistryIndex): JsonSchema | undefined {
  switch (entry.type) {
    case 'agent':
      return index.agents?.[entry.agentId]?.inputSchema ?? agentInputSchema;
    case 'tool':
      return index.tools?.[entry.toolId]?.inputSchema;
    case 'workflow':
      return index.workflows?.[entry.workflowId]?.inputSchema;
    case 'mapping':
    case 'step':
      return undefined;
  }
}

function outputSchemaOf(entry: SerializedSingleStepEntry, index: WorkflowRegistryIndex): JsonSchema | undefined {
  switch (entry.type) {
    case 'agent':
      return entry.outputSchema ?? index.agents?.[entry.agentId]?.outputSchema;
    case 'tool':
      return index.tools?.[entry.toolId]?.outputSchema;
    case 'workflow':
      return index.workflows?.[entry.workflowId]?.outputSchema;
    case 'mapping':
    case 'step':
      return undefined;
  }
}

export function inferGraphSchemas(def: WorkflowValidationInput, index: WorkflowRegistryIndex): GraphSchemaInference {
  const issues: WorkflowValidationIssue[] = [];
  const stepOutputs = new Map<string, JsonSchema | undefined>();

  /** Evaluates one leaf entry: checks its input against `incoming`, returns its output. */
  const evalLeaf = (
    entry: SerializedSingleStepEntry,
    path: string,
    incoming: JsonSchema | undefined,
    container: boolean,
  ): JsonSchema | undefined => {
    if (entry.type === 'mapping') {
      // Container placement is a structural issue; don't analyze the config twice.
      if (container) return undefined;
      const analysis = analyzeMapConfig(entry.mapConfig, {
        path,
        availableOutputs: stepOutputs,
        inputSchema: def.inputSchema,
        requestContextSchema: def.requestContextSchema,
      });
      issues.push(...analysis.issues);
      return analysis.outputSchema;
    }
    if (entry.type === 'step') return undefined;
    if (schemaCompatibility(incoming, inputSchemaOf(entry, index)) === 'incompatible') {
      issues.push({
        code: 'incompatible-schema',
        path,
        message: 'Step input is incompatible with the preceding workflow output.',
      });
    }
    return outputSchemaOf(entry, index);
  };

  let current: JsonSchema | undefined = def.inputSchema;
  def.graph.forEach((entry, entryIndex) => {
    const path = `graph.${entryIndex}`;
    switch (entry.type) {
      case 'step':
      case 'agent':
      case 'tool':
      case 'mapping':
      case 'workflow':
        current = evalLeaf(entry, path, current, false);
        break;
      case 'sleep':
      case 'sleepUntil':
        // Passthrough: sleeping does not reshape the data.
        break;
      case 'parallel':
      case 'conditional': {
        const incoming = current;
        const properties: Record<string, JsonSchema> = {};
        entry.steps.forEach((child, childIndex) => {
          const output = evalLeaf(child, `${path}.steps.${childIndex}`, incoming, true);
          const childId = leafEntryId(child);
          if (output && childId) properties[childId] = output;
        });
        current = {
          type: 'object',
          properties,
          ...(entry.type === 'parallel' ? { required: Object.keys(properties) } : {}),
        };
        break;
      }
      case 'foreach': {
        const incoming = current;
        if (isRecord(incoming) && typeof incoming.type === 'string' && incoming.type !== 'array') {
          issues.push({ code: 'incompatible-schema', path, message: 'Foreach input must be an array.' });
        }
        const items = isRecord(incoming?.items) ? (incoming.items as JsonSchema) : undefined;
        const output = evalLeaf(entry.step, `${path}.step`, items, true);
        current = output ? { type: 'array', items: output } : output;
        break;
      }
      case 'loop': {
        const output = evalLeaf(entry.step, `${path}.step`, current, true);
        if (schemaCompatibility(output, inputSchemaOf(entry.step, index)) === 'incompatible') {
          issues.push({
            code: 'incompatible-schema',
            path: `${path}.step`,
            message: 'Loop step output is incompatible with its input for a subsequent iteration.',
          });
        }
        current = output;
        break;
      }
      default: {
        const _exhaustive: never = entry;
        void _exhaustive;
      }
    }
    // Register the outputs of id-bearing top-level entries so later mappings
    // and templates can reference them. `step` descriptors register too (their
    // schema is unknown, which is fine — unknown never fails a check).
    const id = 'id' in entry && entry.id ? entry.id : entry.type === 'step' ? entry.step.id : undefined;
    if (id) stepOutputs.set(id, current);
  });

  if (schemaCompatibility(current, def.outputSchema) === 'incompatible') {
    issues.push({
      code: 'incompatible-schema',
      path: 'outputSchema',
      message: 'Workflow output schema is incompatible with the final step output.',
    });
  }
  return { stepOutputs, finalOutput: current, issues };
}
