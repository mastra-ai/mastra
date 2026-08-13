import type { SerializedSingleStepEntry } from '../../types';
import type { JsonSchema } from '../json-schema-to-zod';
import { schemaCompatibility } from './schema-utils';
import { leafEntryId } from './types';
import type {
  WorkflowRegistryIndex,
  WorkflowValidationInput,
  WorkflowValidationIssue,
  WorkflowValidationRepairAction,
  WorkflowValidationRepairSource,
} from './types';

function inputSchemaOf(entry: SerializedSingleStepEntry, index: WorkflowRegistryIndex): JsonSchema | undefined {
  switch (entry.type) {
    case 'agent':
      return (
        index.agents?.[entry.agentId]?.inputSchema ?? {
          type: 'object',
          properties: { prompt: { type: 'string' } },
          required: ['prompt'],
        }
      );
    case 'tool':
      return index.tools?.[entry.toolId]?.inputSchema;
    case 'workflow':
      return index.workflows?.[entry.workflowId]?.inputSchema;
    case 'mapping':
    case 'step':
      return undefined;
  }
}

function entryAtPath(def: WorkflowValidationInput, path: string): SerializedSingleStepEntry | undefined {
  const match = /^graph\.(\d+)(?:\.(steps)\.(\d+)|\.(step))?/.exec(path);
  if (!match) return undefined;
  const entry = def.graph[Number(match[1])];
  if (!entry) return undefined;
  if (match[2] === 'steps' && (entry.type === 'parallel' || entry.type === 'conditional')) {
    return entry.steps[Number(match[3])];
  }
  if (match[4] === 'step' && (entry.type === 'foreach' || entry.type === 'loop')) return entry.step;
  if (
    entry.type === 'agent' ||
    entry.type === 'tool' ||
    entry.type === 'workflow' ||
    entry.type === 'mapping' ||
    entry.type === 'step'
  ) {
    return entry;
  }
  return undefined;
}

function precedingSourceIds(def: WorkflowValidationInput, targetIndex: number): string[] {
  const ids: string[] = [];
  def.graph.slice(0, targetIndex).forEach(entry => {
    if (entry.type === 'parallel' || entry.type === 'conditional') {
      entry.steps.forEach(child => {
        const childId = leafEntryId(child);
        if (childId) ids.push(childId);
      });
    } else if (entry.type === 'foreach' || entry.type === 'loop') {
      const childId = leafEntryId(entry.step);
      if (childId) ids.push(childId);
    }
    // Container entries (parallel/conditional/foreach/loop) never produce a
    // result keyed by their own id — only their executed children do. Advertising
    // the container id here previously sent authors toward mappings that pass
    // draft validation and then fail at run time.
    if (entry.type === 'parallel' || entry.type === 'conditional' || entry.type === 'foreach' || entry.type === 'loop')
      return;
    const id = 'id' in entry && entry.id ? entry.id : entry.type === 'step' ? entry.step.id : undefined;
    if (id) ids.push(id);
  });
  return ids;
}

function legalSources(
  def: WorkflowValidationInput,
  targetIndex: number,
  expectedSchema: JsonSchema | undefined,
  stepOutputs: Map<string, JsonSchema | undefined>,
): WorkflowValidationRepairSource[] {
  const sources: WorkflowValidationRepairSource[] = [
    {
      source: { initData: true, path: '' },
      schema: def.inputSchema,
      compatibility: schemaCompatibility(def.inputSchema, expectedSchema),
    },
    ...precedingSourceIds(def, targetIndex).map(stepId => {
      const schema = stepOutputs.get(stepId);
      return {
        source: { step: stepId, path: '' } as const,
        ...(schema ? { schema } : {}),
        compatibility: schemaCompatibility(schema, expectedSchema),
      };
    }),
  ];
  return sources.filter(source => source.compatibility !== 'incompatible');
}

export function addWorkflowValidationRepairActions(
  def: WorkflowValidationInput,
  index: WorkflowRegistryIndex,
  issues: WorkflowValidationIssue[],
  stepOutputs: Map<string, JsonSchema | undefined>,
  entryInputs: Map<string, JsonSchema | undefined>,
  finalOutput: JsonSchema | undefined,
): WorkflowValidationIssue[] {
  return issues.map(issue => {
    const graphMatch = /^graph\.(\d+)/.exec(issue.path);
    const targetIndex = graphMatch ? Number(graphMatch[1]) : def.graph.length;
    const entry = entryAtPath(def, issue.path);
    const entryId = entry ? leafEntryId(entry) : undefined;
    let repair: WorkflowValidationRepairAction | undefined;

    if (issue.code === 'incompatible-schema') {
      // A foreach consumes a RAW ARRAY of its child's input, so the useful
      // "expected" shape is the iterable — not the child input, and definitely
      // not the workflow output schema the container path used to fall back to.
      const containerEntry = graphMatch ? def.graph[targetIndex] : undefined;
      const foreachChildInput =
        containerEntry?.type === 'foreach' ? inputSchemaOf(containerEntry.step, index) : undefined;
      const expectedSchema =
        containerEntry?.type === 'foreach'
          ? ({ type: 'array', ...(foreachChildInput ? { items: foreachChildInput } : {}) } as JsonSchema)
          : entry
            ? inputSchemaOf(entry, index)
            : def.outputSchema;
      const actualSchema =
        issue.path === 'outputSchema'
          ? finalOutput
          : (entryInputs.get(issue.path) ?? (targetIndex === 0 ? def.inputSchema : undefined));
      repair = {
        issueCode: issue.code,
        path: issue.path,
        ...(entryId ? { entryId } : {}),
        ...(expectedSchema ? { expectedSchema } : {}),
        ...(actualSchema ? { actualSchema } : {}),
        legalSources: legalSources(def, targetIndex, expectedSchema, stepOutputs),
        // A foreach consumes a raw array, and mappings always emit an object —
        // inserting a mapping can never satisfy it. Advertise fixing the
        // upstream producer (or the foreach body) instead.
        operation:
          containerEntry?.type === 'foreach'
            ? 'update-workflow-step'
            : issue.path === 'outputSchema'
              ? 'insert-workflow-mapping-after'
              : 'insert-workflow-mapping-before',
        arguments: entryId ? { targetStepId: entryId } : { targetPath: issue.path },
        blocksCheckpoint: false,
        blocksFinalize: true,
      };
    } else if (issue.code === 'invalid-map-config' || issue.code === 'invalid-map-reference') {
      const destinationField = /\.mapConfig\.([^\.]+)/.exec(issue.path)?.[1];
      repair = {
        issueCode: issue.code,
        path: issue.path,
        ...(entryId ? { entryId } : {}),
        ...(destinationField ? { destinationField } : {}),
        legalSources: legalSources(def, targetIndex, undefined, stepOutputs),
        operation: 'set-workflow-mapping-source',
        arguments: {
          ...(entryId ? { mappingStepId: entryId } : {}),
          ...(destinationField ? { field: destinationField } : {}),
        },
        blocksCheckpoint: false,
        blocksFinalize: true,
      };
    } else if (issue.code === 'invalid-predicate-reference') {
      repair = {
        issueCode: issue.code,
        path: issue.path,
        ...(entryId ? { childId: entryId } : {}),
        operation: 'set-workflow-predicate',
        arguments: { predicatePath: issue.path },
        blocksCheckpoint: false,
        blocksFinalize: true,
      };
    } else if (issue.code === 'missing-reference') {
      repair = {
        issueCode: issue.code,
        path: issue.path,
        ...(entryId ? { entryId } : {}),
        operation: 'update-workflow-step',
        arguments: entryId ? { stepId: entryId } : { targetPath: issue.path },
        blocksCheckpoint: false,
        blocksFinalize: true,
      };
    } else if (issue.code === 'invalid-map-placement') {
      repair = {
        issueCode: issue.code,
        path: issue.path,
        ...(entryId ? { childId: entryId } : {}),
        operation: 'remove-workflow-step',
        arguments: entryId ? { stepId: entryId } : { targetPath: issue.path },
        blocksCheckpoint: false,
        blocksFinalize: true,
      };
    }

    return repair ? { ...issue, repair } : issue;
  });
}
