import type { MCPServerEventArgs, MCPServerEventData, MCPServerEventDefinition } from './types';

/**
 * Declares an event type for `MCPServer`'s `events` option. An identity helper: it types `match`
 * and `poll` from `inputSchema` and `payloadSchema`.
 *
 * @example
 * ```typescript
 * const ticketCreated = defineEvent({
 *   description: 'A ticket was created',
 *   inputSchema: z.object({ project: z.string().optional() }),
 *   payloadSchema: z.object({ id: z.string(), project: z.string() }),
 *   match: (args, data) => !args.project || data.project === args.project,
 * });
 * ```
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export function defineEvent<
  TArgs extends MCPServerEventArgs = MCPServerEventArgs,
  TData extends MCPServerEventData = MCPServerEventData,
>(definition: MCPServerEventDefinition<TArgs, TData>): MCPServerEventDefinition<TArgs, TData> {
  return definition;
}
