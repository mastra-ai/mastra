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
import { createWorkflow } from './create';
import type { SerializedSingleStepEntry, SerializedStepFlowEntry, SingleStepEntry, StepFlowEntry } from './types';
import { createStep, mapVariable } from './workflow';

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
      return {
        type: 'foreach',
        step: stepDescriptor(entry.step),
        opts: { concurrency: entry.opts.concurrency },
      };
    case 'conditional':
      throw new Error(`Conditional steps cannot be stored: requires the Phase-2 predicate DSL.`);
    case 'loop':
      throw new Error(`Loop step "${entry.step.id}" cannot be stored: requires the Phase-2 predicate DSL.`);
    default: {
      const _exhaustive: never = entry;
      throw new Error(`Unknown step entry type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function serializeSingleEntry(entry: SingleStepEntry): SerializedSingleStepEntry {
  if (entry.type === 'agent') {
    return { type: 'agent', id: entry.id, agentId: entry.agentId, description: entry.agent?.description };
  }
  if (entry.type === 'tool') {
    return { type: 'tool', id: entry.id, toolId: entry.toolId, description: entry.tool?.description };
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

export async function rehydrateWorkflow(def: StoredWorkflowGraph, mastra: Mastra): Promise<RehydratedWorkflow> {
  const inputSchema = jsonSchemaToZod(def.inputSchema);
  const outputSchema = jsonSchemaToZod(def.outputSchema);
  const stateSchema = def.stateSchema ? jsonSchemaToZod(def.stateSchema) : undefined;
  const requestContextSchema = def.requestContextSchema ? jsonSchemaToZod(def.requestContextSchema) : undefined;

  const wf = createWorkflow({
    id: def.id,
    description: def.description,
    inputSchema: inputSchema as any,
    outputSchema: outputSchema as any,
    stateSchema: stateSchema as any,
    requestContextSchema: requestContextSchema as any,
  });

  for (const entry of def.graph) {
    applyGraphEntry(wf, entry, mastra);
  }
  const built: any = wf.commit();
  return { workflow: built };
}

function applyGraphEntry(wf: any, entry: SerializedStepFlowEntry, mastra: Mastra): void {
  switch (entry.type) {
    case 'agent':
      assertAgentExists(mastra, entry.agentId);
      wf.agent(entry.agentId, { id: entry.id });
      return;
    case 'tool':
      assertToolExists(mastra, entry.toolId);
      wf.tool(entry.toolId, { id: entry.id });
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
      wf.parallel(entry.steps.map(s => resolveSingle(s, mastra)));
      return;
    case 'foreach':
      wf.foreach(resolveStepDescriptor(entry.step, mastra), { concurrency: entry.opts.concurrency });
      return;
    case 'step':
      wf.then(resolveStepDescriptor(entry.step, mastra));
      return;
    case 'conditional':
    case 'loop':
      throw new Error(`Cannot rehydrate ${entry.type} step: requires the Phase-2 predicate DSL.`);
    default: {
      const _exhaustive: never = entry;
      throw new Error(`Unknown stored step type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function resolveSingle(entry: SerializedSingleStepEntry, mastra: Mastra): any {
  switch (entry.type) {
    case 'agent': {
      assertAgentExists(mastra, entry.agentId);
      // Wrap in createStep so `.parallel()` sees the __agentRef discriminator
      // and re-emits a `type: 'agent'` entry when re-serialized. A raw agent
      // instance falls through to the generic `type: 'step'` branch and the
      // round-trip loses the declarative shape.
      return createStep(mastra.getAgentById(entry.agentId));
    }
    case 'tool': {
      assertToolExists(mastra, entry.toolId);
      // Same reason as above — the tool must be wrapped so `.parallel()` can
      // recognize the __toolRef discriminator.
      return createStep(mastra.getTool(entry.toolId) as any);
    }
    case 'step':
      return resolveStepDescriptor(entry.step, mastra);
    case 'mapping':
      throw new Error(`mapping entries cannot appear inside .parallel(); they must be top-level.`);
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
export function jsonSchemaToZod(schema: JsonSchema): z.ZodTypeAny {
  return walk(schema);
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

function walk(schema: JsonSchema): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') return z.any();

  for (const key of UNSUPPORTED_SCHEMA_KEYS) {
    if (key in schema) {
      throw new Error(
        `Stored workflow schema uses unsupported JSON Schema keyword "${key}". ` +
          `This converter only supports the static subset that Zod round-trips through ` +
          `standardSchemaToJSONSchema (object, array, string, number, integer, boolean, null, enum). ` +
          `Simplify the schema or extend jsonSchemaToZod to cover this keyword.`,
      );
    }
  }

  let out: z.ZodTypeAny;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    out = z.enum(schema.enum.map(String) as [string, ...string[]]);
  } else if (Array.isArray(schema.type)) {
    out = z.union(schema.type.map((t: string) => walk({ ...schema, type: t })) as any);
  } else {
    switch (schema.type) {
      case 'object': {
        const shape: Record<string, z.ZodTypeAny> = {};
        const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
        for (const [key, child] of Object.entries(schema.properties ?? {})) {
          const childSchema = walk(child as JsonSchema);
          shape[key] = required.has(key) ? childSchema : childSchema.optional();
        }
        out = z.object(shape);
        if (schema.additionalProperties === true) out = (out as any).passthrough();
        break;
      }
      case 'array':
        out = z.array(walk(schema.items ?? {}));
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
