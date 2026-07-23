/**
 * Storable → Runnable half of the workflow round-trip: rebuild a runnable
 * `Workflow` from the stored JSON form. References to agents/tools/workflows
 * are resolved against the live Mastra instance; throws if a reference is
 * missing — better to surface the failure at load time than at run time.
 */
import type { Mastra } from '../mastra';
import { createWorkflow } from './create';
import type { JsonSchema, JsonSchemaToZodOptions } from './json-schema-to-zod';
import { jsonSchemaToZod } from './json-schema-to-zod';
import { derivePredicateLabel } from './predicate';
import type { Step } from './step';
import type {
  SerializedSingleStepEntry,
  SerializedStepFlowEntry,
  SerializedStepOptions,
  SingleStepEntry,
  StepFlowEntry,
} from './types';
import { getSingleStepEntryId } from './utils';
import { mapVariable, predicateToCondition } from './workflow';

/** JSON shape persisted to WorkflowDefinitionsStorage. */
export interface StoredWorkflowGraph {
  id: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  stateSchema?: JsonSchema;
  requestContextSchema?: JsonSchema;
  graph: SerializedStepFlowEntry[];
}

/**
 * Wrapper so the return value isn't recognized as a thenable by `await`.
 * `Workflow` carries a `.then(step)` builder method — returning one directly
 * from an `async` function (or any `await`-ed call) makes the runtime call
 * that builder method as a Promise resolver and the call hangs forever.
 * Always destructure: `const { workflow } = await rehydrateWorkflow(...)`.
 */
export interface RehydratedWorkflow {
  workflow: any;
}

/**
 * Options controlling how `rehydrateWorkflow` handles unsupported JSON Schema
 * keywords. Forwarded to `jsonSchemaToZod` for every schema on the definition
 * (top-level + per-step `agent.outputSchema`). See `JsonSchemaToZodOptions`.
 */
export type RehydrateWorkflowOptions = JsonSchemaToZodOptions;

export async function rehydrateWorkflow(
  def: StoredWorkflowGraph,
  mastra: Mastra,
  opts?: RehydrateWorkflowOptions,
): Promise<RehydratedWorkflow> {
  const inputSchema = jsonSchemaToZod(def.inputSchema, opts);
  const outputSchema = jsonSchemaToZod(def.outputSchema, opts);
  const stateSchema = def.stateSchema ? jsonSchemaToZod(def.stateSchema, opts) : undefined;
  const requestContextSchema = def.requestContextSchema ? jsonSchemaToZod(def.requestContextSchema, opts) : undefined;

  const wf = createWorkflow({
    id: def.id,
    description: def.description,
    inputSchema: inputSchema as any,
    outputSchema: outputSchema as any,
    stateSchema: stateSchema as any,
    requestContextSchema: requestContextSchema as any,
  });

  for (const entry of def.graph) {
    applyGraphEntry(wf, entry, mastra, opts);
  }
  const built: any = wf.commit();
  built.origin = 'stored';
  return { workflow: built };
}

function applyGraphEntry(
  wf: any,
  entry: SerializedStepFlowEntry,
  mastra: Mastra,
  schemaOpts?: JsonSchemaToZodOptions,
): void {
  switch (entry.type) {
    case 'agent':
    case 'tool':
      wf.__pushStepFlowEntry(rehydrateSingleEntry(entry, mastra, schemaOpts), entry);
      return;
    case 'mapping': {
      const cfg = parseMapConfig(entry.mapConfig, entry.id);
      const live = rehydrateMapConfig(cfg, mastra);
      wf.map(live, { id: entry.id });
      return;
    }
    case 'sleep': {
      if (typeof entry.duration !== 'number') {
        throw new Error(`Stored sleep "${entry.id}" missing literal duration.`);
      }
      // Push directly (not wf.sleep()) so the stored step id survives the
      // round-trip — the builder generates a fresh random id per call.
      const live: StepFlowEntry = { type: 'sleep', id: entry.id, duration: entry.duration };
      wf.__pushStepFlowEntry(live, live);
      return;
    }
    case 'sleepUntil': {
      if (!(entry.date instanceof Date) && typeof entry.date !== 'string') {
        throw new Error(`Stored sleepUntil "${entry.id}" missing literal date.`);
      }
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const live: StepFlowEntry = { type: 'sleepUntil', id: entry.id, date };
      wf.__pushStepFlowEntry(live, { type: 'sleepUntil', id: entry.id, date });
      return;
    }
    case 'parallel': {
      const live: StepFlowEntry = {
        type: 'parallel',
        steps: entry.steps.map(s => rehydrateSingleEntry(s, mastra, schemaOpts)),
      };
      wf.__pushStepFlowEntry(live, entry);
      return;
    }
    case 'foreach': {
      if (entry.step.type === 'mapping') {
        throw new Error(
          `Foreach step cannot iterate a mapping: mappings project data, they don't execute per item. Use an agent, tool, or plain step as the foreach body.`,
        );
      }
      const live: StepFlowEntry = {
        type: 'foreach',
        step: rehydrateSingleEntry(entry.step, mastra, schemaOpts),
        opts: { concurrency: entry.opts?.concurrency ?? 1 },
      };
      wf.__pushStepFlowEntry(live, entry);
      return;
    }
    case 'step': {
      const live = rehydrateSingleEntry(entry, mastra, schemaOpts);
      wf.__pushStepFlowEntry(live, entry);
      return;
    }
    case 'workflow': {
      const nested = assertWorkflowExists(mastra, entry.workflowId);
      wf.then(nested);
      return;
    }
    case 'conditional': {
      const predicates = entry.predicates;
      if (!predicates || predicates.length !== entry.steps.length || predicates.some(p => !p)) {
        throw new Error(
          `Cannot rehydrate conditional step: missing or mismatched predicates. Only declarative predicate branches round-trip.`,
        );
      }
      const steps = entry.steps.map(s => rehydrateSingleEntry(s, mastra, schemaOpts));
      // Wire graphs may omit the Studio-facing condition labels; derive them
      // from the predicates (same convention as the fluent builder).
      const serializedConditions =
        entry.serializedConditions ??
        steps.map((s, i) => ({ id: `${getSingleStepEntryId(s)}-condition`, fn: derivePredicateLabel(predicates[i]!) }));
      const live: StepFlowEntry = {
        type: 'conditional',
        steps,
        conditions: predicates.map(p => predicateToCondition(p!)),
        serializedConditions,
        predicates,
      };
      wf.__pushStepFlowEntry(live, { ...entry, serializedConditions });
      return;
    }
    case 'loop': {
      const { predicate, loopType } = entry;
      if (!predicate || (loopType !== 'dowhile' && loopType !== 'dountil')) {
        throw new Error(
          `Cannot rehydrate loop step: missing declarative predicate or loopType. Only declarative predicate loops round-trip.`,
        );
      }
      const step = rehydrateSingleEntry(entry.step, mastra, schemaOpts);
      const serializedCondition = entry.serializedCondition ?? {
        id: `${getSingleStepEntryId(step)}-condition`,
        fn: derivePredicateLabel(predicate),
      };
      const live: StepFlowEntry = {
        type: 'loop',
        step,
        condition: predicateToCondition(predicate),
        loopType,
        serializedCondition,
        predicate,
      };
      wf.__pushStepFlowEntry(live, { ...entry, serializedCondition });
      return;
    }
    default: {
      const _exhaustive: never = entry;
      throw new Error(`Unknown stored step type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Reconstruct the options bag `.agent()` accepts from a serialized entry.
 * Restores `structuredOutput.schema` from `outputSchema` (JSON Schema → Zod)
 * and merges in `retries` / `metadata`. Returns `undefined` when nothing to
 * restore so `.agent(agentId)` stays a clean call.
 */
function rebuildAgentOptions(
  entry: {
    outputSchema?: Record<string, any>;
    options?: SerializedStepOptions;
  },
  schemaOpts?: JsonSchemaToZodOptions,
): Record<string, any> | undefined {
  const opts: Record<string, any> = {};
  if (entry.outputSchema) {
    opts.structuredOutput = { schema: jsonSchemaToZod(entry.outputSchema, schemaOpts) };
  }
  if (entry.options?.retries !== undefined) opts.retries = entry.options.retries;
  if (entry.options?.metadata !== undefined) opts.metadata = entry.options.metadata;
  return Object.keys(opts).length > 0 ? opts : undefined;
}

function rebuildToolOptions(entry: { options?: SerializedStepOptions }): Record<string, any> | undefined {
  const opts: Record<string, any> = {};
  if (entry.options?.retries !== undefined) opts.retries = entry.options.retries;
  if (entry.options?.metadata !== undefined) opts.metadata = entry.options.metadata;
  return Object.keys(opts).length > 0 ? opts : undefined;
}

/**
 * Build the live `SingleStepEntry` for a stored entry. Declarative agent/tool
 * entries stay declarative — both engines interpret them per-kind at
 * execution time (`runAgentEntry` / `runToolEntry`) — so no fake `Step`
 * wrapper is needed and the stored `id` / `outputSchema` / `retries` /
 * `metadata` round-trip losslessly in every position (top-level, parallel,
 * branch, foreach and loop bodies).
 *
 * `step` descriptors resolve agent-then-tool by id against the live Mastra
 * instance; `workflow` entries resolve the registered instance. Both become
 * plain `{ type: 'step' }` entries, same as the fluent builder emits.
 */
function rehydrateSingleEntry(
  entry: SerializedSingleStepEntry,
  mastra: Mastra,
  schemaOpts?: JsonSchemaToZodOptions,
): SingleStepEntry {
  switch (entry.type) {
    case 'agent': {
      const agent = tryGetAgentById(mastra, entry.agentId);
      if (!agent) {
        throw new Error(
          `Stored workflow references agent "${entry.agentId}" which is not registered on this Mastra instance.`,
        );
      }
      return {
        type: 'agent',
        id: entry.id,
        agentId: entry.agentId,
        agent,
        options: rebuildAgentOptions(entry, schemaOpts),
      };
    }
    case 'tool': {
      const tool = mastra.getTool?.(entry.toolId);
      if (!tool) {
        throw new Error(
          `Stored workflow references tool "${entry.toolId}" which is not registered on this Mastra instance.`,
        );
      }
      return { type: 'tool', id: entry.id, toolId: entry.toolId, tool, options: rebuildToolOptions(entry) };
    }
    case 'step': {
      const { id } = entry.step;
      const resolved = tryGetAgentById(mastra, id) ?? mastra.getTool?.(id);
      if (!resolved) {
        throw new Error(
          `Stored workflow references step "${id}" which is not registered as an agent or tool on this Mastra instance.`,
        );
      }
      return { type: 'step', step: resolved as unknown as Step };
    }
    case 'workflow':
      return { type: 'step', step: assertWorkflowExists(mastra, entry.workflowId) as unknown as Step };
    case 'mapping':
      throw new Error(
        `mapping entries cannot appear inside .parallel(), .branch(), or .foreach(); they must be top-level.`,
      );
  }
}

function parseMapConfig(raw: string, stepId: string): Record<string, any> {
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch (e) {
    throw new Error(`Stored mapping step "${stepId}" has invalid JSON mapConfig: ${(e as Error).message}`);
  }
}

/**
 * Walk a parsed (id-only) mapping config and turn step/initData id strings back
 * into live references. The result is the object shape that `.map()` accepts.
 */
function rehydrateMapConfig(cfg: Record<string, any>, mastra: Mastra): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, source] of Object.entries(cfg)) {
    if (!source || typeof source !== 'object') {
      out[key] = source;
      continue;
    }
    if ('template' in source) {
      out[key] = { template: source.template };
    } else if ('value' in source) {
      out[key] = { value: source.value };
    } else if ('requestContextPath' in source) {
      out[key] = { requestContextPath: source.requestContextPath };
    } else if ('initData' in source && typeof source.initData === 'string') {
      const wf = mastra.getWorkflow?.(source.initData);
      if (!wf) {
        throw new Error(`Mapping references unknown workflow init-data "${source.initData}".`);
      }
      out[key] = mapVariable({ initData: wf as any, path: source.path });
    } else if ('step' in source) {
      const stepRef = Array.isArray(source.step)
        ? source.step.map((id: string) => resolveStepReferenceById(id, mastra))
        : resolveStepReferenceById(source.step, mastra);
      out[key] = mapVariable({ step: stepRef as any, path: source.path });
    } else {
      out[key] = source;
    }
  }
  return out;
}

function resolveStepReferenceById(id: string, mastra: Mastra): any {
  const agent = tryGetAgentById(mastra, id);
  if (agent) return agent;
  const tool = mastra.getTool?.(id);
  if (tool) return tool;
  // A mapping's `step:` source must point to a real step that ran earlier in
  // the graph. If neither an agent nor a tool with this id is registered,
  // rehydration is broken: don't paper over it with a synthetic {id} that
  // would silently drop mapping wiring and only fail deep inside execution.
  throw new Error(
    `Stored workflow mapping references step "${id}" which is not registered as an agent or tool on this Mastra instance.`,
  );
}

/**
 * Mastra.getAgentById throws when the id isn't registered; every by-id
 * resolution path in this file wants a nullable "does it exist?" answer so it
 * can fall through to a tool lookup or a targeted error. Swallow the not-found
 * throw and return undefined.
 */
function tryGetAgentById(mastra: Mastra, id: string): any | undefined {
  if (!id || typeof mastra.getAgentById !== 'function') return undefined;
  try {
    return mastra.getAgentById(id);
  } catch {
    return undefined;
  }
}

function tryGetWorkflowById(mastra: Mastra, id: string): any | undefined {
  if (!id || typeof (mastra as any).getWorkflow !== 'function') return undefined;
  try {
    return (mastra as any).getWorkflow(id);
  } catch {
    return undefined;
  }
}

function assertWorkflowExists(mastra: Mastra, workflowId: string): any {
  const wf = tryGetWorkflowById(mastra, workflowId);
  if (!wf) {
    throw new Error(
      `Stored workflow references nested workflow "${workflowId}" which is not registered on this Mastra instance.`,
    );
  }
  return wf;
}
