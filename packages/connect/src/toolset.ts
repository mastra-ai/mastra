import type { ToolsInput } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { z } from 'zod';

import type { ConnectClientOptions, ProxyRequestOptions } from './client.js';
import { proxyRequest, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';

export interface ProviderToolsOptions {
  /** Connection to use. Falls back to the provider's MASTRA_<PROVIDER>_CONNECTION_ID env var at execute time. */
  connectionId?: string;
  /** Restrict the returned toolset to these tool keys. Unknown names throw immediately. */
  allowTools?: string[];
  client?: ConnectClientOptions;
}

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
