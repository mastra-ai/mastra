/**
 * Round-trip a workflow between its in-process form (live `stepFlow` with
 * runtime references) and a JSON-safe storable form (ids + serialized mapping
 * configs, no closures). Used by the workflow-builder pipeline:
 *
 *   build → toStorableGraph(stepFlow) → persist → rehydrateWorkflow → addWorkflow
 *
 * The static subset that round-trips:
 *  - agent / tool by id
 *  - mapping with `value`, `step`, `initData`, `requestContextPath`, `template`,
 *    `state` sources (no `fn` source — closures don't round-trip)
 *  - sleep / sleepUntil with literal duration/date
 *  - parallel (inner entries must themselves be static)
 *  - foreach with literal concurrency
 *  - generic `.then(step)` falls back to a minimal step descriptor — usable
 *    only when the step's id resolves on the live Mastra at load time
 *
 * Out of scope (would need a predicate DSL): conditional / loop / dynamic
 * mapping `fn`. These throw at `toStorableGraph` time.
 */
import { z } from 'zod';
import type { Mastra } from '../mastra';
import { standardSchemaToJSONSchema, toStandardSchema } from '../schema';
import { createWorkflow } from './create';
import type {
  SerializedSingleStepEntry,
  SerializedStepFlowEntry,
  SerializedStepOptions,
  SingleStepEntry,
  StepFlowEntry,
} from './types';
import { getSingleStepEntryId } from './utils';
import { createStep, createStepFromAgent, createStepFromTool, mapVariable } from './workflow';

// ============================================================================
// JSON shape persisted to WorkflowDefinitionsStorage
// ============================================================================

/**
 * Minimal JSON-Schema shape we accept. Intentionally untyped on the value side
 * — different JSON Schema producers emit slightly different shapes and the
 * inline converter below just inspects the fields it cares about.
 */
export type JsonSchema = Record<string, any>;

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

// ============================================================================
// Live → Storable
// ============================================================================

/**
 * Walk a live `stepFlow` and emit a JSON-safe `SerializedStepFlowEntry[]` with
 * full (un-truncated) mapping configs and all step/agent/tool references stored
 * as ids. Throws on entries that can't round-trip (closures, conditional/loop).
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
      const predicates = (entry as any).predicates as Array<unknown> | undefined;
      if (!predicates || predicates.some(p => !p || typeof p !== 'object')) {
        throw new Error(
          `Conditional (branch) step cannot be stored: closure predicates do not round-trip. Use the declarative form ({ predicate: {...} }) for each branch.`,
        );
      }
      return {
        type: 'conditional',
        steps: entry.steps.map(s => serializeSingleEntry(s)),
        predicates: predicates as any,
      } as any;
    }
    case 'loop': {
      const predicate = (entry as any).predicate as unknown | undefined;
      if (!predicate || typeof predicate !== 'object') {
        throw new Error(
          `Loop step "${getSingleStepEntryId(entry.step)}" cannot be stored: closure predicates do not round-trip. Use the declarative form ({ predicate: {...} }).`,
        );
      }
      return {
        type: 'loop',
        step: serializeSingleEntry(entry.step),
        loopType: entry.loopType,
        predicate: predicate as any,
      } as any;
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

// ============================================================================
// Storable → Runnable
// ============================================================================

/**
 * Rebuild a runnable `Workflow` from a stored JSON definition. References to
 * agents/tools are resolved against the live Mastra instance via the by-id
 * forms of `.agent()` / `.tool()`. Throws if the referenced agent/tool is
 * missing — better to surface the failure at load time than at run time.
 */
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
      assertAgentExists(mastra, entry.agentId);
      wf.agent(entry.agentId, rebuildAgentOptions(entry, schemaOpts), { id: entry.id });
      return;
    case 'tool':
      assertToolExists(mastra, entry.toolId);
      wf.tool(entry.toolId, rebuildToolOptions(entry), { id: entry.id });
      return;
    case 'mapping': {
      const cfg = parseMapConfig(entry.mapConfig, entry.id);
      const live = rehydrateMapConfig(cfg, mastra);
      wf.map(live, { id: entry.id });
      return;
    }
    case 'sleep':
      if (typeof entry.duration !== 'number') {
        throw new Error(`Stored sleep "${entry.id}" missing literal duration.`);
      }
      wf.sleep(entry.duration);
      return;
    case 'sleepUntil':
      if (!(entry.date instanceof Date) && typeof entry.date !== 'string') {
        throw new Error(`Stored sleepUntil "${entry.id}" missing literal date.`);
      }
      wf.sleepUntil(entry.date instanceof Date ? entry.date : new Date(entry.date as string));
      return;
    case 'parallel':
      wf.parallel(entry.steps.map(s => resolveSingle(s, mastra, schemaOpts)));
      return;
    case 'foreach': {
      const inner = resolveForeachInner(entry.step, mastra, schemaOpts);
      const opts = entry.opts?.concurrency !== undefined ? { concurrency: entry.opts.concurrency } : undefined;
      wf.foreach(inner, opts);
      return;
    }
    case 'step':
      wf.then(resolveStepDescriptor(entry.step, mastra));
      return;
    case 'workflow': {
      const nested = assertWorkflowExists(mastra, entry.workflowId);
      wf.then(nested);
      return;
    }
    case 'conditional': {
      const predicates = (entry as any).predicates as Array<unknown> | undefined;
      if (!predicates || predicates.length !== entry.steps.length) {
        throw new Error(
          `Cannot rehydrate conditional step: missing or mismatched predicates. Only declarative predicate branches round-trip.`,
        );
      }
      const branches = entry.steps.map((s, i) => [
        { predicate: predicates[i] as any },
        resolveSingle(s, mastra, schemaOpts),
      ]);
      wf.branch(branches);
      return;
    }
    case 'loop': {
      const predicate = (entry as any).predicate as unknown | undefined;
      const loopType = (entry as any).loopType as 'dowhile' | 'dountil' | undefined;
      if (!predicate || (loopType !== 'dowhile' && loopType !== 'dountil')) {
        throw new Error(
          `Cannot rehydrate loop step: missing declarative predicate or loopType. Only declarative predicate loops round-trip.`,
        );
      }
      const inner = resolveSingle(entry.step as any, mastra, schemaOpts);
      if (loopType === 'dowhile') {
        wf.dowhile(inner, { predicate: predicate as any });
      } else {
        wf.dountil(inner, { predicate: predicate as any });
      }
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

function resolveSingle(entry: SerializedSingleStepEntry, mastra: Mastra, _schemaOpts?: JsonSchemaToZodOptions): any {
  switch (entry.type) {
    case 'agent': {
      assertAgentExists(mastra, entry.agentId);
      // Wrap in createStep so `.parallel()` / `.foreach()` sees the __agentRef
      // discriminator and re-emits a `type: 'agent'` entry when re-serialized.
      // A raw agent instance falls through to the generic `type: 'step'` branch
      // and the round-trip loses the declarative shape.
      //
      // Note: `entry.outputSchema` is intentionally NOT rebuilt here.
      // `.parallel()`/`.branch()` inner steps produced this way currently
      // execute the agent with its default output shape; per-step structured
      // output for parallel/branch inner steps is a separate open item.
      return createStep(mastra.getAgentById(entry.agentId));
    }
    case 'tool': {
      assertToolExists(mastra, entry.toolId);
      // Same reason as above — the tool must be wrapped so `.parallel()` /
      // `.foreach()` can recognize the __toolRef discriminator.
      return createStep(mastra.getTool(entry.toolId) as any);
    }
    case 'step':
      return resolveStepDescriptor(entry.step, mastra);
    case 'workflow':
      return assertWorkflowExists(mastra, entry.workflowId);
    case 'mapping':
      throw new Error(`mapping entries cannot appear inside .parallel() or .foreach(); they must be top-level.`);
  }
}

/**
 * Build a runnable `Step` for a `.foreach()` inner from its serialized entry.
 * Preserves the stored `id` (which may differ from the underlying agent/tool id)
 * and restores `structuredOutput` / `retries` / `metadata` on the step so
 * per-iteration execution honors them.
 */
function resolveForeachInner(
  entry: SerializedSingleStepEntry,
  mastra: Mastra,
  schemaOpts?: JsonSchemaToZodOptions,
): any {
  switch (entry.type) {
    case 'agent': {
      assertAgentExists(mastra, entry.agentId);
      const agent = mastra.getAgentById(entry.agentId);
      const options = rebuildAgentOptions(entry, schemaOpts);
      const base = createStepFromAgent(agent as any, options as any);
      return { ...base, id: entry.id, __agentOptions: options };
    }
    case 'tool': {
      assertToolExists(mastra, entry.toolId);
      const tool = mastra.getTool(entry.toolId);
      const options = rebuildToolOptions(entry);
      const base = createStepFromTool(tool as any, options as any);
      return { ...base, id: entry.id, __toolOptions: options };
    }
    case 'step':
      return resolveStepDescriptor(entry.step, mastra);
    case 'workflow':
      return assertWorkflowExists(mastra, entry.workflowId);
    case 'mapping':
      throw new Error(
        `Foreach step cannot iterate a mapping: mappings project data, they don't execute per item. Use an agent, tool, or plain step as the foreach body.`,
      );
  }
}

function resolveStepDescriptor(desc: { id: string }, mastra: Mastra): any {
  const agent = tryGetAgentById(mastra, desc.id);
  if (agent) return agent;
  const tool = mastra.getTool?.(desc.id);
  if (tool) return tool;
  throw new Error(
    `Stored workflow references step "${desc.id}" which is not registered as an agent or tool on this Mastra instance.`,
  );
}

function parseMapConfig(raw: string, stepId: string): Record<string, any> {
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch (e) {
    throw new Error(`Stored mapping step "${stepId}" has invalid JSON mapConfig: ${(e as Error).message}`);
  }
}

/**
 * Rebuild the object shape that `.map()` accepts. Step sources remain workflow-local
 * step IDs because mapping execution resolves them from the run's step results.
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
      out[key] = mapVariable({ step: source.step as any, path: source.path });
    } else {
      out[key] = source;
    }
  }
  return out;
}

function assertAgentExists(mastra: Mastra, agentId: string): void {
  if (!tryGetAgentById(mastra, agentId)) {
    throw new Error(`Stored workflow references agent "${agentId}" which is not registered on this Mastra instance.`);
  }
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

function assertToolExists(mastra: Mastra, toolId: string): void {
  if (!mastra.getTool?.(toolId)) {
    throw new Error(`Stored workflow references tool "${toolId}" which is not registered on this Mastra instance.`);
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

// ============================================================================
// Minimal JSON-Schema → Zod converter
// ============================================================================

/**
 * Inline converter sufficient for the static subset Zod typically emits when
 * round-tripped through `standardSchemaToJSONSchema`. Handles:
 *
 *  - `object` with `properties` + `required`
 *  - `string` / `number` / `integer` / `boolean` / `null`
 *  - `array` with `items`
 *  - `enum`
 *  - `description` (propagated via `.describe`)
 *
 * For more exotic schemas (unions, intersections, recursive refs) swap in
 * `json-schema-to-zod` from npm. Kept inline to avoid pulling a dependency
 * for the MVP demo.
 */
/**
 * Options controlling how `jsonSchemaToZod` handles JSON Schema keywords the
 * MVP converter doesn't support.
 *
 * - `throw` (default): hard-crash with a targeted error. Correct for the save
 *   path — the author is right there and can simplify the schema.
 * - `warn`: emit a warning via `onUnsupported` (if provided) and fall back to
 *   `z.any()` for the unsupported subtree. Correct for the boot-time load
 *   path — one bad pre-existing row must not take down startup for every
 *   other workflow.
 */
export interface JsonSchemaToZodOptions {
  onUnsupportedSchema?: 'throw' | 'warn';
  onUnsupported?: (message: string) => void;
}

export function jsonSchemaToZod(schema: JsonSchema, opts?: JsonSchemaToZodOptions): z.ZodTypeAny {
  return walk(schema, opts ?? {});
}

// JSON Schema keywords that this MVP converter does not support. If a stored
// workflow's inputSchema/outputSchema uses any of these, silently converting
// to z.any() would strip the constraint at rehydration and let bad data flow
// through at execution — hard-crash instead so the corruption surfaces at
// load time.
const UNSUPPORTED_SCHEMA_KEYS = [
  'oneOf',
  'anyOf',
  'allOf',
  'not',
  '$ref',
  'patternProperties',
  'discriminator',
] as const;

function walk(schema: JsonSchema, opts: JsonSchemaToZodOptions): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') return z.any();

  for (const key of UNSUPPORTED_SCHEMA_KEYS) {
    if (key in schema) {
      const message =
        `Stored workflow schema uses unsupported JSON Schema keyword "${key}". ` +
        `This converter only supports the static subset that Zod round-trips through ` +
        `standardSchemaToJSONSchema (object, array, string, number, integer, boolean, null, enum). ` +
        `Simplify the schema or extend jsonSchemaToZod to cover this keyword.`;
      if (opts.onUnsupportedSchema === 'warn') {
        opts.onUnsupported?.(message);
        return z.any();
      }
      throw new Error(message);
    }
  }

  let out: z.ZodTypeAny;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    out = z.enum(schema.enum.map(String) as [string, ...string[]]);
  } else if (Array.isArray(schema.type)) {
    const options = schema.type.map((t: string) => walk({ ...schema, type: t }, opts));
    // z.union requires a tuple of at least two members; guard shorter arrays.
    if (options.length === 1) {
      out = options[0]!;
    } else {
      out = z.union(options as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    }
  } else {
    switch (schema.type) {
      case 'object': {
        const shape: Record<string, z.ZodTypeAny> = {};
        const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
        for (const [key, child] of Object.entries(schema.properties ?? {})) {
          const childSchema = walk(child as JsonSchema, opts);
          shape[key] = required.has(key) ? childSchema : childSchema.optional();
        }
        const obj = z.object(shape);
        out = schema.additionalProperties === true ? obj.passthrough() : obj;
        break;
      }
      case 'array':
        out = z.array(walk(schema.items ?? {}, opts));
        break;
      case 'string':
        out = z.string();
        break;
      case 'number':
        out = z.number();
        break;
      case 'integer':
        out = z.number().int();
        break;
      case 'boolean':
        out = z.boolean();
        break;
      case 'null':
        out = z.null();
        break;
      case undefined:
        // No `type` and no enum/typed-array — schema is just a description
        // or annotation wrapper; permit z.any() for these.
        out = z.any();
        break;
      default:
        throw new Error(
          `Stored workflow schema uses unsupported JSON Schema type "${String(schema.type)}". ` +
            `This converter only supports object, array, string, number, integer, boolean, null, and enum.`,
        );
    }
  }

  if (typeof schema.description === 'string' && schema.description.length > 0) {
    out = out.describe(schema.description);
  }
  return out;
}

/**
 * Result of a `validateStorableJsonSchema` call.
 * `unsupported` lists every offending keyword usage as `<jsonPointer>: <keyword>`
 * so callers can log or surface a targeted message per offense.
 */
export type StorableJsonSchemaValidation = { ok: true } | { ok: false; unsupported: string[] };

/**
 * Non-throwing companion to `jsonSchemaToZod`. Walks a JSON Schema and reports
 * every unsupported-keyword usage without converting. Use this at write time
 * (e.g. inside `Mastra.addStoredWorkflow`) to surface a warning before the
 * schema is persisted — the row will still fail to rehydrate on the next boot
 * (`jsonSchemaToZod` throws), so this is a heads-up, not a guarantee.
 *
 * Callers decide whether to warn, reject, or ignore. This function never
 * throws for any input shape.
 */
export function validateStorableJsonSchema(schema: JsonSchema | undefined): StorableJsonSchemaValidation {
  if (!schema || typeof schema !== 'object') return { ok: true };
  const unsupported: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    for (const key of UNSUPPORTED_SCHEMA_KEYS) {
      if (key in n) unsupported.push(`${path || '#'}: ${key}`);
    }
    if (n.properties && typeof n.properties === 'object') {
      for (const [prop, child] of Object.entries(n.properties as Record<string, unknown>)) {
        visit(child, `${path}/properties/${prop}`);
      }
    }
    if (n.items) {
      if (Array.isArray(n.items)) {
        n.items.forEach((child, i) => visit(child, `${path}/items/${i}`));
      } else {
        visit(n.items, `${path}/items`);
      }
    }
    if (n.additionalProperties && typeof n.additionalProperties === 'object') {
      visit(n.additionalProperties, `${path}/additionalProperties`);
    }
  };
  visit(schema, '');
  return unsupported.length === 0 ? { ok: true } : { ok: false, unsupported };
}
