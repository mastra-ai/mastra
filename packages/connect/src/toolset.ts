import type { ToolsInput } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { z } from 'zod';

import type { ConnectClientOptions, ProxyRequestOptions } from './client.js';
import { proxyRequest, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';

interface ProviderToolsOptionsBase {
  /**
   * Connection to use. `connect()` always supplies one (resolving the
   * registration's env var itself); direct `create<Provider>Tools` callers
   * must pass it or tool calls fail with `missing_connection_id`.
   */
  connectionId?: string;
  client?: ConnectClientOptions;
}

/**
 * `allowTools` and `disallowTools` are mutually exclusive: pass one or the
 * other, never both. The XOR shape enforces that at compile time on object
 * literals, and `applyToolFilter` re-checks at runtime so loosely typed
 * callers still get a clear error instead of silent surprising behavior.
 */
export type ProviderToolsOptions = ProviderToolsOptionsBase &
  (
    | {
        /** Restrict the returned toolset to these tool keys. Unknown names throw immediately. */
        allowTools?: string[];
        disallowTools?: never;
      }
    | {
        allowTools?: never;
        /** Remove these tool keys from the returned toolset. Unknown names throw immediately. */
        disallowTools?: string[];
      }
  );

/** Resolves a connection id lazily at execute time: option → env var → typed error naming the env var. */
export function resolveConnectionId(envVar: string, connectionId?: string): string {
  const resolved = connectionId?.trim() || process.env[envVar]?.trim();
  if (!resolved) {
    throw new MastraConnectError('missing_connection_id', `Missing connection id: set ${envVar} or pass connectionId.`);
  }
  return resolved;
}

export interface ProxyToolConfig<TIn, TOut> {
  id: string;
  description: string;
  inputSchema: z.ZodType<TIn>;
  outputSchema: z.ZodType<TOut>;
  /** Builds the proxy request for a parsed input. */
  request: (input: TIn) => ProxyRequestOptions;
  /** Shapes the provider's raw JSON into the output schema's shape. */
  transform: (raw: unknown, input: TIn) => TOut;
}

export interface ProxyToolContext {
  envVar: string;
  options?: ProviderToolsOptions;
}

/**
 * Wraps `createTool` so the tool executes through the platform connection
 * proxy. Connection id and client config resolve lazily inside execute, so
 * building tools without env vars set never throws.
 */
export function defineProxyTool<TIn, TOut>(context: ProxyToolContext, config: ProxyToolConfig<TIn, TOut>) {
  return createTool({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: async input => {
      const connectionId = resolveConnectionId(context.envVar, context.options?.connectionId);
      const client = resolveClient(context.options?.client);
      const raw = await proxyRequest(client, connectionId, config.request(input));
      return config.transform(raw, input);
    },
  });
}

/**
 * Filters a toolset by tool key. Throws at build time on unknown names so
 * typos in access-limiting config surface immediately.
 */
export function applyAllowTools<T extends ToolsInput>(tools: T, allowTools?: string[]): ToolsInput {
  if (!allowTools) return tools;
  const known = Object.keys(tools);
  const unknown = allowTools.filter(name => !known.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown tool name(s) in allowTools: ${unknown.join(', ')}. Known tools: ${known.join(', ')}.`);
  }
  const filtered: ToolsInput = {};
  for (const name of allowTools) {
    filtered[name] = tools[name]!;
  }
  return filtered;
}

/**
 * Removes tool keys from a toolset. Throws at build time on unknown names so
 * typos in access-limiting config surface immediately instead of silently
 * removing nothing.
 */
export function applyDisallowTools<T extends ToolsInput>(tools: T, disallowTools?: string[]): ToolsInput {
  if (!disallowTools || disallowTools.length === 0) return tools;
  const known = Object.keys(tools);
  const unknown = disallowTools.filter(name => !known.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown tool name(s) in disallowTools: ${unknown.join(', ')}. Known tools: ${known.join(', ')}.`);
  }
  const remove = new Set(disallowTools);
  const filtered: ToolsInput = {};
  for (const name of known) {
    if (remove.has(name)) continue;
    filtered[name] = tools[name]!;
  }
  return filtered;
}

/**
 * Applies whichever of `allowTools` or `disallowTools` was configured on a
 * provider. Rejects at build time when both are set so a caller who bypasses
 * the XOR type still gets a clear error rather than surprising behavior.
 */
export function applyToolFilter<T extends ToolsInput>(
  tools: T,
  filter: { allowTools?: string[]; disallowTools?: string[] },
): ToolsInput {
  const hasAllow = filter.allowTools !== undefined;
  const hasDisallow = filter.disallowTools !== undefined && filter.disallowTools.length > 0;
  if (hasAllow && hasDisallow) {
    throw new MastraConnectError(
      'invalid_options',
      'allowTools and disallowTools are mutually exclusive; set at most one.',
    );
  }
  if (hasAllow) return applyAllowTools(tools, filter.allowTools);
  if (hasDisallow) return applyDisallowTools(tools, filter.disallowTools);
  return tools;
}
