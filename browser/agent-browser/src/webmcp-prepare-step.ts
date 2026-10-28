/**
 * Mid-turn tool discovery for WebMCP.
 *
 * Mastra's agent toolset is fixed when `generate`/`stream` is invoked, but
 * core supports per-step toolset extension via `prepareStep` — returning
 * `{ tools }` adds or replaces tools for the next model call. This module
 * builds that `prepareStep` for AgentBrowser so page WebMCP tools surface
 * as first-class tools (`page_<tool>`) rather than through the
 * `browser_webmcp` meta-tool.
 *
 * Two discovery modes (`WebmcpToolDiscovery` on the config):
 *   - `auto`:   merge every tool the current page exposes, every step
 *   - `manual`: merge only the tools the agent attached via the
 *               `browser_webmcp_discover` tool
 *
 * Caching: Anthropic/OpenAI prompt caches are prefix-based and the tool
 * list is part of the prefix hash. Any change to the tool list invalidates
 * the cache from that point. We memoize by (threadId, url) for `auto` and
 * by (threadId, attached set) for `manual` so repeat steps on the same
 * page emit the same tool bytes.
 */

import { DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type { ProcessInputStepArgs, ProcessInputStepResult, Processor } from '@mastra/core/processors';
import { MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from './agent-browser';

type MastraTool = ReturnType<typeof createTool>;

/**
 * The per-step hook that surfaces page WebMCP tools. Structurally identical
 * to core's `PrepareStepFunction`, so `browser.prepareStep` can also be
 * passed directly as a `prepareStep` option when composing manually.
 */
export type WebMcpPrepareStepFn = (args: ProcessInputStepArgs) => Promise<ProcessInputStepResult | undefined | void>;

/** Processor id for the WebMCP per-step hook, used for deduplication. */
export const WEBMCP_PREPARE_STEP_PROCESSOR_ID = 'browser-webmcp-prepare-step';

/**
 * Input processor that runs the WebMCP prepare-step hook on every step of a
 * `generate`/`stream` loop. AgentBrowser returns it from
 * `getInputProcessors()`, which the Agent already auto-wires for
 * `new Agent({ browser })` — so page tools surface with zero extra core
 * surface. It runs before the user's own `prepareStep` (core appends that as
 * the final input-step processor), so a user hook sees the merged toolset
 * and can override anything.
 */
export class WebMcpPrepareStepProcessor implements Processor<typeof WEBMCP_PREPARE_STEP_PROCESSOR_ID> {
  readonly id = WEBMCP_PREPARE_STEP_PROCESSOR_ID;
  readonly name = 'WebMCP Prepare Step Processor';

  constructor(private readonly prepareStep: WebMcpPrepareStepFn) {}

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined | void> {
    return this.prepareStep(args);
  }
}

export interface WebMcpPrepareStepConfig {
  mode: 'auto' | 'manual';
  prefix: string;
  /**
   * Fallback thread id used when the step args don't carry one via
   * `requestContext[MASTRA_THREAD_ID_KEY]`. Set this when you build the
   * prepare-step outside an agent run; agent-driven runs should leave it
   * unset so each step uses its own thread id.
   */
  threadId?: string;
}

const SANITIZE_PATTERN = /[^A-Za-z0-9_-]/g;
const TRIM_UNDERSCORE_PATTERN = /^_+|_+$/g;

export interface AttachedPageTool {
  /** Page-declared raw name (as the WebMCP bridge reports it). */
  rawName: string;
  /** Prefixed, sanitized id surfaced to the model. */
  id: string;
  description: string;
  inputSchema: unknown;
}

export interface PerThreadCache {
  url: string | null;
  tools: Record<string, MastraTool> | null;
  attachedKey: string | null;
}

/**
 * Build the single `prepareStep` function that AgentBrowser hands users.
 * The function is stateful: it reads from an externally-owned per-thread
 * memo (URL and attached-set) so repeat steps on the same page produce the
 * same tool bytes, concurrent runs on different threads don't share tool
 * lists, and AgentBrowser can evict a thread's entry on
 * `closeThreadSession` (otherwise the map would grow for the process
 * lifetime).
 */
export function buildWebMcpPrepareStep(
  browser: AgentBrowser,
  config: WebMcpPrepareStepConfig,
  caches: Map<string, PerThreadCache>,
): WebMcpPrepareStepFn {
  const cacheKeyFor = (threadId: string | undefined) => threadId ?? '__default__';

  return async function webMcpPrepareStep(args) {
    const baseTools = (args.tools ?? {}) as Record<string, unknown>;

    // Prefer the step's own thread id over any fallback captured when the
    // prepare-step was built. In an agent run each step carries its own
    // `requestContext`, so this is what keeps concurrent runs isolated.
    const threadId = resolveThreadId(args, config.threadId);
    const cacheKey = cacheKeyFor(threadId);
    let cache = caches.get(cacheKey);
    if (!cache) {
      cache = { url: null, tools: null, attachedKey: null };
      caches.set(cacheKey, cache);
    }

    const url = await safeGetUrl(browser, threadId);
    if (url == null) return undefined;

    let pageTools: Record<string, MastraTool>;

    if (config.mode === 'auto') {
      if (cache.tools == null || cache.url !== url) {
        cache.url = url;
        cache.tools = await fetchAllPageTools(browser, config, threadId);
      }
      pageTools = cache.tools;
    } else {
      // manual mode — only the tools the agent attached via the discover tool.
      // If the attached set was recorded against a different URL, drop it so
      // stale tools from the previous page don't survive onto a new one
      // (symmetric with auto mode, where the fresh page.list() replaces the
      // toolset). We compare the attach-time URL — not the previous step's
      // URL — so an attach that lands between navigation and the next step
      // is preserved. The agent re-attaches by calling
      // `browser_webmcp_discover` on the new page.
      const attachOrigin = browser.getAttachedWebMcpToolsOrigin(threadId);
      if (attachOrigin != null && attachOrigin !== url) {
        browser.clearAttachedWebMcpTools(threadId);
      }
      const attached = browser.getAttachedWebMcpTools(threadId);
      const attachedKey = `${url}\u0000${attached.map(t => t.id).join('\u0000')}`;
      if (cache.tools == null || cache.url !== url || cache.attachedKey !== attachedKey) {
        cache.url = url;
        cache.attachedKey = attachedKey;
        cache.tools = buildToolsFromAttached(browser, attached, threadId);
      }
      pageTools = cache.tools;
    }

    if (Object.keys(pageTools).length === 0) return undefined;

    const merged: Record<string, unknown> = { ...baseTools };
    for (const [id, tool] of Object.entries(pageTools)) {
      // Base tools win on collision — don't let a page shadow browser_* tools.
      if (Object.prototype.hasOwnProperty.call(merged, id)) continue;
      merged[id] = tool;
    }

    return { tools: merged };
  };
}

/**
 * Pull the effective thread id for this step out of the agent's
 * `requestContext`. Each `generate`/`stream` call carries its own context,
 * so this is how we keep concurrent runs on the same browser isolated.
 * Falls back to the config value for callers that drive `prepareStep`
 * outside an agent run.
 */
function resolveThreadId(
  args: { requestContext?: { get: (key: string) => unknown } },
  fallback: string | undefined,
): string | undefined {
  const fromContext = args.requestContext?.get(MASTRA_THREAD_ID_KEY);
  if (typeof fromContext === 'string' && fromContext.length > 0) return fromContext;
  return fallback;
}

async function fetchAllPageTools(
  browser: AgentBrowser,
  config: WebMcpPrepareStepConfig,
  threadId: string | undefined,
): Promise<Record<string, MastraTool>> {
  const listed = await browser.listWebMcpTools(threadId);
  if (!('success' in listed) || listed.success !== true) return {};
  const sorted = [...listed.tools].sort((a, b) => a.name.localeCompare(b.name));
  const out: Record<string, MastraTool> = {};
  for (const tool of sorted) {
    const id = toolIdFor(tool.name, config.prefix);
    if (!id || Object.prototype.hasOwnProperty.call(out, id)) continue;
    out[id] = makePageTool({
      id,
      rawName: tool.name,
      description: tool.description ?? `WebMCP tool "${tool.name}" from ${listed.origin} (source: ${tool.source}).`,
      inputSchema: tool.inputSchema,
      browser,
      threadId,
    });
  }
  return out;
}

function buildToolsFromAttached(
  browser: AgentBrowser,
  attached: AttachedPageTool[],
  threadId: string | undefined,
): Record<string, MastraTool> {
  const sorted = [...attached].sort((a, b) => a.id.localeCompare(b.id));
  const out: Record<string, MastraTool> = {};
  for (const tool of sorted) {
    if (Object.prototype.hasOwnProperty.call(out, tool.id)) continue;
    out[tool.id] = makePageTool({
      id: tool.id,
      rawName: tool.rawName,
      description: tool.description,
      inputSchema: tool.inputSchema,
      browser,
      threadId,
    });
  }
  return out;
}

function makePageTool(opts: {
  id: string;
  rawName: string;
  description: string;
  inputSchema: unknown;
  browser: AgentBrowser;
  threadId: string | undefined;
}): MastraTool {
  const { id, rawName, description, inputSchema, browser, threadId } = opts;
  return createTool({
    id,
    description,
    inputSchema: normalizeInputSchema(inputSchema),
    execute: async input => {
      // The thread id is baked into this closure at prepare-step time (either
      // from the step's requestContext in an agent run, or from the config's
      // fallback). If neither is available we fall through to the stable
      // DEFAULT_THREAD_ID sentinel rather than letting callWebMcpTool resolve
      // via the mutable `getCurrentThread()` state — that mutable fallback
      // could target another concurrent thread's browser if the user drives
      // `prepareStep` outside an agent run while another run is in flight.
      const resolvedThreadId = threadId ?? DEFAULT_THREAD_ID;
      const result = await browser.callWebMcpTool({ toolName: rawName, args: input }, resolvedThreadId);
      if (!('success' in result) || result.success !== true) {
        const err = result as { message?: string };
        throw new Error(err.message ?? `WebMCP tool "${rawName}" failed`);
      }
      return result.result;
    },
  });
}

/**
 * Compute the prefixed, sanitized id for a given raw page-tool name.
 * Returns `null` if the sanitized form is empty.
 */
export function toolIdFor(rawName: string, prefix: string): string | null {
  const sanitized = rawName.replace(SANITIZE_PATTERN, '_').replace(TRIM_UNDERSCORE_PATTERN, '');
  if (!sanitized) return null;
  return `${prefix}${sanitized}`;
}

async function safeGetUrl(browser: AgentBrowser, threadId: string | undefined): Promise<string | null> {
  try {
    return await browser.getCurrentUrl(threadId);
  } catch {
    return null;
  }
}

/**
 * Normalize a page-declared input schema into a shape `createTool` accepts.
 * Falls back to an empty object schema when the page omits it or sends
 * something non-object-shaped.
 */
function normalizeInputSchema(schema: unknown): { type: 'object'; properties: Record<string, never> } {
  if (schema != null && typeof schema === 'object' && (schema as { type?: unknown }).type === 'object') {
    return schema as { type: 'object'; properties: Record<string, never> };
  }
  return { type: 'object', properties: {} };
}
