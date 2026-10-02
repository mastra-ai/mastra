/**
 * Mid-turn tool discovery for WebMCP.
 *
 * The AgentBrowser `browser_webmcp` meta-tool exposes WebMCP tools behind a
 * `list` / `call` interface because the agent's toolset is frozen at the
 * start of each `generate`/`stream` call — tools discovered mid-run can't
 * be surfaced as first-class tools without extending the toolset per step.
 *
 * Mastra core already supports per-step toolset replacement via
 * `prepareStep` (returning `{ tools }` adds/replaces tools for the next
 * model call). This module converts page WebMCP tools into first-class
 * Mastra tools and plugs them into `prepareStep` so the agent can call
 * `page_add_to_cart(...)` directly instead of going through the meta-tool.
 *
 * Caching: Anthropic/OpenAI prompt caches are prefix-based and the tool
 * list is part of the prefix hash. Any change to the tool list invalidates
 * the cache from that point onward. We memoize by (threadId, url) inside a
 * single `createWebMcpPrepareStep` instance so repeat steps on the same
 * page emit the same tool bytes.
 */

import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from './agent-browser';

/** The Mastra tool type we emit — matches `createTool`'s return type. */
type MastraTool = ReturnType<typeof createTool>;

/** Options shared by `getPageWebMcpTools` and `createWebMcpPrepareStep`. */
export interface WebMcpToolOptions {
  /**
   * Thread to look up. Omit to use the AgentBrowser's current thread.
   * Pass explicitly for concurrent runs on different threads.
   */
  threadId?: string;
  /**
   * Prefix applied to each page tool id to avoid collisions with the base
   * `browser_*` tools and user tools. Defaults to `page_`. Set to the empty
   * string to disable prefixing (collisions will drop the page tool).
   */
  prefix?: string;
}

/** Options for the `prepareStep` wrapper. */
export interface CreateWebMcpPrepareStepOptions extends WebMcpToolOptions {
  /**
   * An existing `prepareStep` to chain. It runs first and its return is
   * merged with the page-tool addition — the merged `tools` include both
   * what the user's `prepareStep` produced and the page tools.
   */
  passthrough?: WebMcpPrepareStepFn;
}

/**
 * Minimal shape of a Mastra `prepareStep` function. Mirrors the public
 * contract (returning `{ tools }` adds/replaces tools for the next step)
 * without pulling in internal core types.
 */
export type WebMcpPrepareStepFn = (
  args: WebMcpPrepareStepArgs,
) => Promise<WebMcpPrepareStepResult | undefined | void> | WebMcpPrepareStepResult | undefined | void;

export interface WebMcpPrepareStepArgs {
  stepNumber: number;
  tools?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WebMcpPrepareStepResult {
  tools?: Record<string, unknown>;
  [key: string]: unknown;
}

const DEFAULT_PREFIX = 'page_';
const SANITIZE_PATTERN = /[^A-Za-z0-9_-]/g;
const TRIM_UNDERSCORE_PATTERN = /^_+|_+$/g;

/**
 * Fetch the WebMCP tools currently exposed by the active page, wrapped as
 * first-class Mastra tools. Each returned tool's `execute` forwards the
 * call back through `browser.callWebMcpTool(...)`.
 *
 * Returns an empty record if WebMCP is disabled, no page is open, the
 * page's origin is not in `allowedOrigins`, or the page has no tools.
 * Tool ids are sorted so the output is deterministic for cache stability.
 */
export async function getPageWebMcpTools(
  browser: AgentBrowser,
  opts: WebMcpToolOptions = {},
): Promise<Record<string, MastraTool>> {
  const prefix = opts.prefix ?? DEFAULT_PREFIX;
  const listed = await browser.listWebMcpTools(opts.threadId);
  if (!('success' in listed) || listed.success !== true) {
    return {};
  }
  const out: Record<string, MastraTool> = {};
  const sorted = [...listed.tools].sort((a, b) => a.name.localeCompare(b.name));
  for (const pageTool of sorted) {
    const sanitized = sanitizeToolName(pageTool.name);
    if (!sanitized) continue;
    const id = `${prefix}${sanitized}`;
    if (Object.prototype.hasOwnProperty.call(out, id)) {
      // Two page tool names collapsed to the same sanitized id. Keep the
      // first (deterministic by sort order) and skip the rest.
      continue;
    }
    out[id] = createTool({
      id,
      description:
        pageTool.description ?? `WebMCP tool "${pageTool.name}" from ${listed.origin} (source: ${pageTool.source}).`,
      inputSchema: normalizeInputSchema(pageTool.inputSchema),
      execute: async input => {
        const result = await browser.callWebMcpTool({ toolName: pageTool.name, args: input }, opts.threadId);
        if (!('success' in result) || result.success !== true) {
          const err = result as { message?: string; hint?: string };
          throw new Error(err.message ?? `WebMCP tool "${pageTool.name}" failed`);
        }
        return result.result;
      },
    });
  }
  return out;
}

/**
 * Build a `prepareStep` function that adds page WebMCP tools to the
 * step's toolset. Each returned function instance holds its own
 * `(threadId, url)` memo so repeat steps on the same page produce the
 * same tool bytes (minimizes prompt-cache churn).
 *
 * Example:
 * ```ts
 * await agent.generate(input, {
 *   prepareStep: browser.createWebMcpPrepareStep(),
 * });
 * ```
 */
export function createWebMcpPrepareStep(
  browser: AgentBrowser,
  opts: CreateWebMcpPrepareStepOptions = {},
): WebMcpPrepareStepFn {
  let cachedUrl: string | null = null;
  let cachedTools: Record<string, MastraTool> | null = null;

  return async function webMcpPrepareStep(args) {
    const passthroughResult = opts.passthrough ? await opts.passthrough(args) : undefined;
    const baseTools = (passthroughResult?.tools ?? args.tools ?? {}) as Record<string, unknown>;

    const url = await getCurrentUrl(browser, opts.threadId);
    if (url == null) {
      // No page open or WebMCP disabled; nothing to add. Pass through.
      return passthroughResult ?? undefined;
    }

    if (cachedTools == null || cachedUrl !== url) {
      cachedUrl = url;
      cachedTools = await getPageWebMcpTools(browser, opts);
    }

    if (Object.keys(cachedTools).length === 0) {
      return passthroughResult ?? undefined;
    }

    const merged: Record<string, unknown> = { ...baseTools };
    for (const [id, tool] of Object.entries(cachedTools)) {
      if (Object.prototype.hasOwnProperty.call(merged, id)) {
        // Base tool wins on collision — the browser's standard tools and
        // user tools must not be shadowed by a page.
        continue;
      }
      merged[id] = tool;
    }

    return {
      ...(passthroughResult ?? {}),
      tools: merged,
    };
  };
}

async function getCurrentUrl(browser: AgentBrowser, threadId: string | undefined): Promise<string | null> {
  try {
    return await browser.getCurrentUrl(threadId);
  } catch {
    return null;
  }
}

function sanitizeToolName(name: string): string {
  return name.replace(SANITIZE_PATTERN, '_').replace(TRIM_UNDERSCORE_PATTERN, '');
}

/**
 * Normalize a page-declared input schema into a shape `createTool` accepts.
 * Pages are supposed to send JSON Schema (type: 'object', properties, ...)
 * but we tolerate missing/non-object schemas by substituting an empty
 * object schema so the tool still works.
 */
function normalizeInputSchema(schema: unknown): { type: 'object'; properties: Record<string, never> } {
  if (schema != null && typeof schema === 'object' && (schema as { type?: unknown }).type === 'object') {
    return schema as { type: 'object'; properties: Record<string, never> };
  }
  return { type: 'object', properties: {} };
}
