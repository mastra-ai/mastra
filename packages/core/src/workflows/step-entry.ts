import type { ReadableStream } from 'node:stream/web';
import { z } from 'zod';
import { TripWire } from '../agent/trip-wire';
import type { Mastra } from '../mastra';
import { resolveObservabilityContext } from '../observability';
import { toStandardSchema } from '../schema';
import type { ChunkType } from '../stream/types';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import type { Step } from './step';
import { forwardAgentStreamChunk } from './stream-utils';
import type { AgentStepEntry, MappingStepEntry, SingleStepEntry, ToolStepEntry } from './types';
import type { Workflow } from './workflow';

/**
 * Accessors for the {@link SingleStepEntry} union.
 *
 * This module is the single place allowed to pattern-match the union's shape.
 * Everything else (both engines, handlers, utils) should go through these
 * helpers so that adding a new variant means changing exactly one file.
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

// ---------------------------------------------------------------------------
// Mapping templates
// ---------------------------------------------------------------------------

/** Walks a dotted path on an object. `''` or `'.'` returns the root unchanged. */
function traverseMappingPath(root: unknown, path: string, errorLabel: string): unknown {
  if (path === '' || path === '.') return root;
  const parts = path.split('.');
  let value: any = root;
  for (const part of parts) {
    if (typeof value === 'object' && value !== null) {
      value = value[part];
    } else {
      throw new Error(`Invalid path ${path} in ${errorLabel}`);
    }
  }
  return value;
}

const TEMPLATE_PLACEHOLDER = /\$\{([^}]*)\}/g;

const TEMPLATE_NAMESPACES = ['inputData', 'initData', 'state', 'requestContext', 'stepResults'] as const;
type TemplateScope = (typeof TEMPLATE_NAMESPACES)[number];

/** Common error-message prefix so every template diagnostic points at the exact placeholder. */
function describeBadPlaceholder(template: string, idx: number, rawExpr: string): string {
  return `Template placeholder #${idx} (\${${rawExpr}}) in '${template}'`;
}

/** Split a placeholder body `scope.path.with.dots` into its leading scope and the dotted remainder. */
function parseTemplatePlaceholder(rawExpr: string): { scope: string; rest: string } {
  const dot = rawExpr.indexOf('.');
  return {
    scope: dot === -1 ? rawExpr : rawExpr.slice(0, dot),
    rest: dot === -1 ? '' : rawExpr.slice(dot + 1),
  };
}

/**
 * Validates a `{ template }` source's syntax at workflow-definition time.
 * Throws if any placeholder is empty, whitespace-padded, references an unknown
 * namespace, or is a malformed `stepResults.<stepId>` / `stepResults.<stepId>.<path>` shape.
 *
 * Run-time concerns (does the step actually exist, does the path resolve, is
 * the value a primitive) stay in {@link resolveTemplate}.
 */
export function validateTemplate(template: string): void {
  let idx = 0;
  for (const match of template.matchAll(TEMPLATE_PLACEHOLDER)) {
    idx++;
    const rawExpr = match[1] ?? '';
    if (rawExpr.length === 0 || rawExpr !== rawExpr.trim()) {
      throw new Error(
        `${describeBadPlaceholder(template, idx, rawExpr)} has empty or whitespace-padded contents. ` +
          `Use \${<scope>.<path>} with no surrounding whitespace.`,
      );
    }
    const { scope, rest } = parseTemplatePlaceholder(rawExpr);
    if (scope === 'stepResults') {
      const innerDot = rest.indexOf('.');
      const stepId = innerDot === -1 ? rest : rest.slice(0, innerDot);
      if (!stepId) {
        throw new Error(
          `${describeBadPlaceholder(template, idx, rawExpr)} must be of the form \${stepResults.<stepId>} or \${stepResults.<stepId>.<path>}.`,
        );
      }
      continue;
    }
    if (scope === 'requestContext') {
      if (!rest) {
        throw new Error(
          `${describeBadPlaceholder(template, idx, rawExpr)} requires a request-context key — use \${requestContext.<key>}.`,
        );
      }
      continue;
    }
    if ((TEMPLATE_NAMESPACES as readonly string[]).includes(scope)) continue;
    throw new Error(
      `${describeBadPlaceholder(template, idx, rawExpr)} references unknown namespace "${scope}". ` +
        `Use one of: ${TEMPLATE_NAMESPACES.join(', ')}.`,
    );
  }
}

/**
 * Coerces a resolved placeholder value to a string. Primitives are stringified
 * the normal way; objects and arrays are JSON-encoded so downstream agents can
 * consume complex step outputs (e.g. `foreach(agent)` returns `{ text }[]`)
 * directly in a template. `null`/`undefined` render as empty. If JSON encoding
 * fails (circular references, BigInt, etc.), throws with a hint pointing at
 * the offending placeholder.
 */
function stringifyTemplateValue(v: unknown, template: string, idx: number, rawExpr: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch (err) {
      throw new Error(
        `${describeBadPlaceholder(template, idx, rawExpr)} resolved to a value that could not be JSON-stringified ` +
          `(${(err as Error).message}). Drill into a primitive path (e.g. \${${rawExpr}.someField}) or reshape the value in a preceding step.`,
      );
    }
  }
  return String(v);
}

/**
 * Resolves `${<scope>.<path>}` placeholders against the implicit namespaces
 * available in a step's execute context. See the `.map()` overload signature
 * for the full list of accepted scopes (`inputData`, `initData`, `state`,
 * `requestContext`, `stepResults.<stepId>`).
 */
function resolveTemplate(template: string, ctx: any): string {
  let idx = 0;
  return template.replace(TEMPLATE_PLACEHOLDER, (_match, rawExpr: string) => {
    idx++;
    return resolveTemplatePlaceholder(rawExpr, template, idx, ctx);
  });
}

function resolveTemplatePlaceholder(rawExpr: string, template: string, idx: number, ctx: any): string {
  // validateTemplate(template) is called at definition time so we know the
  // raw expr is well-formed (non-empty, no surrounding whitespace, known
  // scope). Runtime only cares about path-resolution + value coercion.
  const { scope, rest } = parseTemplatePlaceholder(rawExpr);
  const label = describeBadPlaceholder(template, idx, rawExpr);
  switch (scope as TemplateScope) {
    case 'inputData':
      return stringifyTemplateValue(traverseMappingPath(ctx.inputData, rest, label), template, idx, rawExpr);
    case 'initData':
      return stringifyTemplateValue(traverseMappingPath(ctx.getInitData(), rest, label), template, idx, rawExpr);
    case 'state':
      return stringifyTemplateValue(traverseMappingPath(ctx.state, rest, label), template, idx, rawExpr);
    case 'requestContext':
      return stringifyTemplateValue(ctx.requestContext.get(rest), template, idx, rawExpr);
    case 'stepResults': {
      const innerDot = rest.indexOf('.');
      const stepId = innerDot === -1 ? rest : rest.slice(0, innerDot);
      const subPath = innerDot === -1 ? '' : rest.slice(innerDot + 1);
      const stepResult = ctx.getStepResult(stepId);
      if (stepResult === null) {
        throw new Error(
          `${label} references stepResults.${stepId} but step "${stepId}" has no successful output ` +
            `(not run yet, not registered, or failed).`,
        );
      }
      return stringifyTemplateValue(traverseMappingPath(stepResult, subPath, label), template, idx, rawExpr);
    }
    default:
      // validateTemplate guarantees this branch is unreachable for well-formed
      // workflows; this is a safety net for templates that bypassed validation
      // (e.g. constructed programmatically and pushed into stepFlow).
      throw new Error(
        `${label} references unknown namespace "${scope}". Use one of: ${TEMPLATE_NAMESPACES.join(', ')}.`,
      );
  }
}

// ---------------------------------------------------------------------------
// Per-kind executors
// ---------------------------------------------------------------------------

/**
 * Runs a declarative `agent` entry: resolves the agent (inline handle, else the
 * Mastra registry), streams the prompt through it, forwards stream chunks, and
 * returns either the structured output or `{ text }`.
 *
 * `ctx` is the step execute context (the same object a plain step's `execute`
 * receives). `mastra` defaults to `ctx.mastra` when omitted.
 */
export async function runAgentEntry(entry: AgentStepEntry, ctx: any, mastra?: Mastra): Promise<unknown> {
  const registry = mastra ?? (ctx?.mastra as Mastra | undefined);
  const agent = entry.agent ?? registry?.getAgentById(entry.agentId);
  if (!agent) {
    throw new Error(
      `Agent '${entry.agentId}' not found for workflow step '${entry.id}'. Register the agent on the Mastra instance or pass the agent instance directly.`,
    );
  }

  // `retries` / `scorers` / `metadata` are step-level concerns handled by the
  // engine (see getEntryRetries); everything else is passed to the agent run.
  const { retries: _retries, scorers: _scorers, metadata: _metadata, ...agentOptions } = (entry.options ?? {}) as any;

  const {
    inputData,
    runId,
    [PUBSUB_SYMBOL]: pubsub,
    [STREAM_FORMAT_SYMBOL]: streamFormat,
    requestContext,
    abortSignal,
    abort,
    writer,
    ...rest
  } = ctx;
  const observabilityContext = resolveObservabilityContext(rest);
  let streamPromise = {} as {
    promise: Promise<string>;
    resolve: (value: string) => void;
    reject: (reason?: any) => void;
  };

  streamPromise.promise = new Promise((resolve, reject) => {
    streamPromise.resolve = resolve;
    streamPromise.reject = reject;
  });

  // Track structured output result
  let structuredResult: any = null;

  const toolData = {
    name: agent.name,
    args: inputData,
  };

  let stream: ReadableStream<any>;

  const handleFinish = (result: any) => {
    const resultWithObject = result as typeof result & { object?: unknown };
    if (agentOptions?.structuredOutput?.schema && resultWithObject.object) {
      structuredResult = resultWithObject.object;
    }
    streamPromise.resolve(result.text);
    void agentOptions?.onFinish?.(result);
  };

  if (
    (await agent.getModel({ requestContext })).specificationVersion === 'v1' &&
    typeof agent.streamLegacy === 'function'
  ) {
    const { fullStream } = await agent.streamLegacy((inputData as { prompt: string }).prompt, {
      ...agentOptions,
      requestContext,
      ...observabilityContext,
      onFinish: handleFinish,
      abortSignal,
    });
    stream = fullStream as any;
  } else {
    const modelOutput = await agent.stream((inputData as { prompt: string }).prompt, {
      ...agentOptions,
      requestContext,
      ...observabilityContext,
      onFinish: handleFinish,
      abortSignal,
    });

    // handleFinish (the agent's onFinish) is the sole source of truth for the
    // final text — the success side of .text is intentionally a no-op.
    // `modelOutput.text` can resolve with '' if a downstream output-processor
    // throws inside the base output's try/catch (see output.ts:970-973,978-981)
    // and it fires BEFORE handleFinish, so racing here would poison
    // streamPromise. Only the rejection channel below is wired up so genuine
    // stream errors still propagate.
    void modelOutput.text.then(
      () => {},
      (err: unknown) => streamPromise.reject(err),
    );
    stream = modelOutput.fullStream as ReadableStream<ChunkType>;
  }

  let tripwireChunk: any = null;

  if (streamFormat === 'legacy') {
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: { type: 'tool-call-streaming-start', ...(toolData ?? {}) },
    });
    for await (const chunk of stream) {
      if (chunk.type === 'tripwire') {
        tripwireChunk = chunk;
        break;
      }
      if (chunk.type === 'text-delta') {
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'tool-call-delta', ...(toolData ?? {}), argsTextDelta: chunk.textDelta },
        });
      }
    }
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: { type: 'tool-call-streaming-finish', ...(toolData ?? {}) },
    });
  } else {
    for await (const chunk of stream) {
      await forwardAgentStreamChunk({ writer, chunk });
      if (chunk.type === 'tripwire') {
        tripwireChunk = chunk;
        break;
      }
    }
  }

  // If a tripwire was detected, throw TripWire to abort the workflow step
  if (tripwireChunk) {
    throw new TripWire(
      tripwireChunk.payload?.reason || 'Agent tripwire triggered',
      {
        retry: tripwireChunk.payload?.retry,
        metadata: tripwireChunk.payload?.metadata,
      },
      tripwireChunk.payload?.processorId,
    );
  }

  if (abortSignal.aborted) {
    return abort();
  }

  // Return structured output if available, otherwise default text
  if (structuredResult !== null) {
    return structuredResult;
  }
  return {
    text: await streamPromise.promise,
  };
}

/**
 * Runs a declarative `tool` entry: resolves the tool (inline handle, else the
 * Mastra registry) and executes it with the step context mapped into the tool
 * execution context.
 */
export async function runToolEntry(entry: ToolStepEntry, ctx: any, mastra?: Mastra): Promise<unknown> {
  const registry = mastra ?? (ctx?.mastra as Mastra | undefined);
  const tool = entry.tool ?? registry?.getTool(entry.toolId);
  if (!tool) {
    throw new Error(
      `Tool '${entry.toolId}' not found for workflow step '${entry.id}'. Pass the tool instance directly.`,
    );
  }

  const {
    inputData,
    mastra: ctxMastra,
    requestContext,
    suspend,
    resumeData,
    runId,
    workflowId,
    state,
    setState,
    abortSignal,
    ...rest
  } = ctx;
  const observabilityContext = resolveObservabilityContext(rest);
  const toolContext = {
    mastra: ctxMastra,
    requestContext,
    ...observabilityContext,
    abortSignal,
    resumeData,
    workflow: {
      runId,
      suspend,
      resumeData,
      workflowId,
      state,
      setState,
    },
  };

  return tool.execute(inputData, toolContext);
}

/**
 * Runs a declarative `mapping` entry. Function configs are invoked directly;
 * object configs are interpreted key-by-key (`value` / `fn` / `template` /
 * `requestContextPath` / `step`+`path` / `initData`+`path`).
 */
export async function runMappingEntry(entry: MappingStepEntry, ctx: any): Promise<unknown> {
  const { mapConfig } = entry;
  if (typeof mapConfig === 'function') {
    return mapConfig(ctx);
  }

  const { getStepResult, getInitData, requestContext } = ctx;

  const result: Record<string, any> = {};
  for (const [key, mapping] of Object.entries(mapConfig)) {
    const m: any = mapping;

    if (m.value !== undefined) {
      result[key] = m.value;
      continue;
    }

    if (m.fn !== undefined) {
      result[key] = await m.fn(ctx);
      continue;
    }

    if (typeof m.template === 'string') {
      result[key] = resolveTemplate(m.template, ctx);
      continue;
    }

    if (m.requestContextPath) {
      result[key] = requestContext.get(m.requestContextPath);
      continue;
    }

    const stepResult = m.initData
      ? getInitData()
      : getStepResult(
          Array.isArray(m.step)
            ? m.step.find((s: any) => {
                const stepRes = getStepResult(s);
                if (typeof stepRes === 'object' && stepRes !== null) {
                  return Object.keys(stepRes).length > 0;
                }
                return stepRes;
              })
            : m.step,
        );

    result[key] = traverseMappingPath(stepResult, m.path, `step ${m?.step?.id ?? 'initData'}`);
  }
  return result;
}
