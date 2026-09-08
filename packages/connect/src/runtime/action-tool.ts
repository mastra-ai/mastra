/**
 * Wraps a vendored Nango `createAction` exec body as a Mastra tool.
 *
 * Generated provider modules import `defineActionTool` and pass the same
 * fields their upstream `createAction({...})` call had — description, input
 * schema, output schema, exec function. This module resolves the platform
 * connection lazily at execute time and hands the exec body a `nango` shim
 * that routes every request through `/v2/proxy`.
 */
import { createTool } from '@mastra/core/tools';
import type { z } from 'zod';

import { resolveClient } from '../client.js';
import type { ProviderToolsOptions } from '../toolset.js';
import { resolveConnectionId } from '../toolset.js';
import { createNangoContext, type NangoContext } from './nango-shim.js';

export interface ActionToolConfig<TIn, TOut> {
  id: string;
  description: string;
  inputSchema: z.ZodType<TIn>;
  outputSchema: z.ZodType<TOut>;
  /** Verbatim exec body from the upstream template, retyped against the shim's NangoContext. */
  exec: (nango: NangoContext, input: TIn) => Promise<TOut>;
}

export interface ActionToolContext {
  envVar: string;
  options?: ProviderToolsOptions;
}

export function defineActionTool<TIn, TOut>(context: ActionToolContext, config: ActionToolConfig<TIn, TOut>) {
  return createTool({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: async input => {
      const connectionId = resolveConnectionId(context.envVar, context.options?.connectionId);
      const client = resolveClient(context.options?.client);
      const nango = createNangoContext({ client, connectionId });
      return config.exec(nango, input);
    },
  });
}
