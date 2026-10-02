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

import type { PrepareStepFunction } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from './agent-browser';

type MastraTool = ReturnType<typeof createTool>;

/**
 * Alias for Mastra's `prepareStep` function type. Re-exported so consumers of
 * `@mastra/agent-browser` don't have to reach into `@mastra/core` just to
 * reference the type.
 */
export type WebMcpPrepareStepFn = PrepareStepFunction;

export interface WebMcpPrepareStepConfig {
  mode: 'auto' | 'manual';
  prefix: string;
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

/**
 * Build the single `prepareStep` function that AgentBrowser hands users.
 * The function is stateful: it owns its own URL / attached-set memos so
 * repeat steps on the same page produce the same tool bytes.
 */
export function buildWebMcpPrepareStep(browser: AgentBrowser, config: WebMcpPrepareStepConfig): WebMcpPrepareStepFn {
  let cachedUrl: string | null = null;
  let cachedTools: Record<string, MastraTool> | null = null;
  let cachedAttachedKey: string | null = null;

  return async function webMcpPrepareStep(args) {
    const baseTools = (args.tools ?? {}) as Record<string, unknown>;

    const url = await safeGetUrl(browser, config.threadId);
    if (url == null) return undefined;

    let pageTools: Record<string, MastraTool>;

    if (config.mode === 'auto') {
      if (cachedTools == null || cachedUrl !== url) {
        cachedUrl = url;
        cachedTools = await fetchAllPageTools(browser, config);
      }
      pageTools = cachedTools;
    } else {
      // manual mode — only the tools the agent attached via the discover tool
      const attached = browser.getAttachedWebMcpTools(config.threadId);
      const attachedKey = `${url}\u0000${attached.map(t => t.id).join('\u0000')}`;
      if (cachedTools == null || cachedUrl !== url || cachedAttachedKey !== attachedKey) {
        cachedUrl = url;
        cachedAttachedKey = attachedKey;
        cachedTools = buildToolsFromAttached(browser, attached, config.threadId);
      }
      pageTools = cachedTools;
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

async function fetchAllPageTools(
  browser: AgentBrowser,
  config: WebMcpPrepareStepConfig,
): Promise<Record<string, MastraTool>> {
  const listed = await browser.listWebMcpTools(config.threadId);
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
      threadId: config.threadId,
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
      const result = await browser.callWebMcpTool({ toolName: rawName, args: input }, threadId);
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
