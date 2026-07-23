/**
 * Live → Storable half of the workflow round-trip: walk a live `stepFlow`
 * (runtime references, closures) and emit the JSON-safe storable form
 * (ids + serialized mapping configs, no closures).
 *
 * The static subset that round-trips:
 *  - agent / tool by id
 *  - mapping with `value`, `step`, `initData`, `requestContextPath`, `template`,
 *    `state` sources (no `fn` source — closures don't round-trip)
 *  - sleep / sleepUntil with literal duration/date
 *  - parallel (inner entries must themselves be static)
 *  - foreach with literal concurrency
 *  - conditional / loop with declarative predicates (closure predicates throw)
 *  - generic `.then(step)` falls back to a minimal step descriptor — usable
 *    only when the step's id resolves on the live Mastra at load time
 *
 * Anything outside the subset throws at `toStorableGraph` time: silent loss
 * would ship broken workflows unnoticed.
 */
import { standardSchemaToJSONSchema, toStandardSchema } from '../schema';
import type {
  SerializedSingleStepEntry,
  SerializedStepFlowEntry,
  SerializedStepOptions,
  SingleStepEntry,
  StepFlowEntry,
} from './types';
import { getSingleStepEntryId } from './utils';

/**
 * Walk a live `stepFlow` and emit a JSON-safe `SerializedStepFlowEntry[]` with
 * full (un-truncated) mapping configs and all step/agent/tool references stored
 * as ids. Throws on entries that can't round-trip (closures, closure predicates).
 */
export function toStorableGraph(stepFlow: StepFlowEntry[]): SerializedStepFlowEntry[] {
  return stepFlow.map(entry => serializeEntry(entry));
}

function serializeEntry(entry: StepFlowEntry): SerializedStepFlowEntry {
  switch (entry.type) {
    case 'step':
    case 'agent':
    case 'tool':
    case 'mapping':
      return serializeSingleEntry(entry);
    case 'sleep':
      if (typeof entry.duration !== 'number') {
        throw new Error(`Sleep step "${entry.id}" cannot be stored: dynamic duration (function) is not supported.`);
      }
      return { type: 'sleep', id: entry.id, duration: entry.duration };
    case 'sleepUntil':
      if (!(entry.date instanceof Date)) {
        throw new Error(`SleepUntil step "${entry.id}" cannot be stored: dynamic date (function) is not supported.`);
      }
      return { type: 'sleepUntil', id: entry.id, date: entry.date };
    case 'parallel':
      return { type: 'parallel', steps: entry.steps.map(s => serializeSingleEntry(s)) };
    case 'foreach':
      if (entry.step.type === 'mapping') {
        throw new Error(
          `Foreach step cannot iterate a mapping: mappings project data, they don't execute per item. Use an agent, tool, or plain step as the foreach body.`,
        );
      }
      return {
        type: 'foreach',
        step: serializeSingleEntry(entry.step),
        opts:
          typeof entry.opts.concurrency === 'function'
            ? { fn: entry.opts.concurrency.toString() }
            : { concurrency: entry.opts.concurrency },
      };
    case 'conditional': {
      const predicates = entry.predicates;
      if (!predicates || predicates.some(p => !p || typeof p !== 'object')) {
        throw new Error(
          `Conditional (branch) step cannot be stored: closure predicates do not round-trip. Use the declarative form ({ predicate: {...} }) for each branch.`,
        );
      }
      return {
        type: 'conditional',
        steps: entry.steps.map(s => serializeSingleEntry(s)),
        serializedConditions: entry.serializedConditions,
        predicates,
      };
    }
    case 'loop': {
      const predicate = entry.predicate;
      if (!predicate || typeof predicate !== 'object') {
        throw new Error(
          `Loop step "${getSingleStepEntryId(entry.step)}" cannot be stored: closure predicates do not round-trip. Use the declarative form ({ predicate: {...} }).`,
        );
      }
      return {
        type: 'loop',
        step: serializeSingleEntry(entry.step),
        serializedCondition: entry.serializedCondition,
        loopType: entry.loopType,
        predicate,
      };
    }
    default: {
      const _exhaustive: never = entry;
      throw new Error(`Unknown step entry type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function serializeSingleEntry(entry: SingleStepEntry): SerializedSingleStepEntry {
  if (entry.type === 'agent') {
    const options = pickSerializableStepOptions(entry.options, entry.id, 'agent');
    const outputSchema = extractStructuredOutputJsonSchema(entry.options, entry.id);
    return {
      type: 'agent',
      id: entry.id,
      agentId: entry.agentId,
      description: entry.agent?.description,
      ...(outputSchema ? { outputSchema } : {}),
      ...(options ? { options } : {}),
    };
  }
  if (entry.type === 'tool') {
    const options = pickSerializableStepOptions(entry.options, entry.id, 'tool');
    return {
      type: 'tool',
      id: entry.id,
      toolId: entry.toolId,
      description: entry.tool?.description,
      ...(options ? { options } : {}),
    };
  }
  if (entry.type === 'mapping') {
    if (typeof entry.mapConfig === 'function') {
      throw new Error(
        `Mapping step "${entry.id}" cannot be stored: the function form does not round-trip. Use the declarative form (template / step / initData / value).`,
      );
    }
    const serialized: Record<string, any> = {};
    for (const [key, mapping] of Object.entries(entry.mapConfig as Record<string, any>)) {
      const m: any = mapping;
      if (m.fn !== undefined) {
        throw new Error(`Mapping step "${entry.id}" key "${key}" cannot be stored: source is a function.`);
      }
      if (m.value !== undefined) {
        serialized[key] = { value: m.value };
      } else if (m.requestContextPath) {
        serialized[key] = { requestContextPath: m.requestContextPath };
      } else if (typeof m.template === 'string') {
        serialized[key] = { template: m.template };
      } else if (m.initData) {
        serialized[key] = { initData: m.initData?.id, path: m.path };
      } else if (m.step) {
        serialized[key] = {
          step: Array.isArray(m.step) ? m.step.map((s: any) => s?.id) : m.step?.id,
          path: m.path,
        };
      } else {
        serialized[key] = m;
      }
    }
    return { type: 'mapping', id: entry.id, mapConfig: JSON.stringify(serialized) };
  }
  // A nested Workflow reached the generic `.then(step)` fallback (its
  // component discriminator is 'WORKFLOW'). Emit a declarative `workflow`
  // entry so the rehydrator can rebuild it by id. Inline the nested graph
  // when present so Studio/API consumers can expand it (same role the old
  // `type:'step' + component:'WORKFLOW'` shape played).
  if ((entry.step as any)?.component === 'WORKFLOW') {
    // Prefer the public getter (serializedStepGraph); fall back to the
    // protected/legacy serializedStepFlow field.
    const nestedFlow =
      ((entry.step as any).serializedStepGraph as SerializedStepFlowEntry[] | undefined) ??
      ((entry.step as any).serializedStepFlow as SerializedStepFlowEntry[] | undefined);
    return {
      type: 'workflow',
      id: (entry.step as any).id,
      workflowId: (entry.step as any).id,
      ...((entry.step as any).description ? { description: (entry.step as any).description } : {}),
      ...(nestedFlow ? { serializedStepFlow: nestedFlow } : {}),
    };
  }
  // generic `.then(step)` — descriptor only; rehydration looks the step up
  // by id on the live Mastra instance.
  return { type: 'step', step: stepDescriptor(entry.step) };
}

function stepDescriptor(step: any) {
  return {
    id: step.id,
    description: step.description,
    metadata: step.metadata,
    component: step.component,
    canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
  };
}

/**
 * Pull the JSON-safe fields (`retries`, `metadata`) out of the options bag
 * carried on a live agent/tool `SingleStepEntry`. Closure-valued fields must
 * hard-crash here rather than silently vanish through storage.
 */
function pickSerializableStepOptions(
  options: any,
  entryId: string,
  kind: 'agent' | 'tool',
): SerializedStepOptions | undefined {
  if (!options || typeof options !== 'object') return undefined;

  // Closure-valued options don't round-trip. Fail loudly at serialize time so
  // the workflow author immediately learns their step won't persist rather
  // than discovering it in production when the callback silently no-ops.
  const forbidden: Array<{ key: string; hint: string }> = [
    { key: 'onFinish', hint: 'callback closure' },
    { key: 'onChunk', hint: 'callback closure' },
    { key: 'onError', hint: 'callback closure' },
    { key: 'onStepFinish', hint: 'callback closure' },
    { key: 'onAbort', hint: 'callback closure' },
    { key: 'toolChoice', hint: 'may be a function' },
  ];
  for (const { key, hint } of forbidden) {
    if (typeof options[key] === 'function') {
      throw new Error(
        `${kind === 'agent' ? 'Agent' : 'Tool'} step "${entryId}" cannot be stored: option "${key}" is a ${hint} that does not round-trip. Remove it or move that logic outside the persisted workflow.`,
      );
    }
  }
  if (typeof options.scorers === 'function') {
    throw new Error(
      `${kind === 'agent' ? 'Agent' : 'Tool'} step "${entryId}" cannot be stored: "scorers" is a function; only the static array form round-trips.`,
    );
  }

  const out: SerializedStepOptions = {};
  if (typeof options.retries === 'number') out.retries = options.retries;
  if (options.metadata && typeof options.metadata === 'object') {
    out.metadata = options.metadata as Record<string, any>;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * If the agent-step options carry `structuredOutput.schema`, that schema IS
 * the step's output shape (see `createStepFromAgent`). Emit it as JSON Schema
 * so rehydration can wire the same structured output back in.
 */
function extractStructuredOutputJsonSchema(options: any, entryId: string): Record<string, any> | undefined {
  const raw = options?.structuredOutput?.schema;
  if (raw === undefined || raw === null) return undefined;
  try {
    // `.agent()`'s typed overload requires a StandardSchemaWithJSON, but the
    // any-form accepts a raw Zod schema. Normalize either shape here so the
    // storage form is consistent.
    const standard = toStandardSchema(raw);
    return standardSchemaToJSONSchema(standard) as Record<string, any>;
  } catch (e) {
    throw new Error(
      `Agent step "${entryId}" cannot be stored: structuredOutput.schema is not convertible to JSON Schema (${(e as Error).message}).`,
    );
  }
}
