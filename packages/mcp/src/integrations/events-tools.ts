import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { z } from 'zod/v4';
import type { MCPClient } from '../client/configuration';
import type { MCPEventsSignalProvider } from './events-signals';

function decodeArguments(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {}
  return undefined;
}

const targetSchema = z.object({
  server: z.string().min(1).describe('Name of the MCP server, as configured on the client'),
  event: z.string().min(1).describe('Event type name, from mcp_events_list'),
  // A JSON string rather than a record: OpenAI strict mode forces every object node to
  // `additionalProperties: false`, which would only ever let the model send `{}`.
  arguments: z
    .string()
    .refine(value => decodeArguments(value) !== undefined, 'arguments must be a JSON object')
    .optional()
    .describe(
      'Subscription arguments as a JSON-encoded object matching the event\'s inputSchema, for example {"project":"A"}. Omit if the event takes none.',
    ),
});

type ToolError = { isError: true; content: string };

const NO_MEMORY: ToolError = {
  isError: true,
  content: 'MCP event subscriptions require agent memory (a threadId and resourceId) so events have a thread to go to.',
};

function threadOf(context: ToolExecutionContext | undefined) {
  const threadId = context?.agent?.threadId;
  const resourceId = context?.agent?.resourceId;
  return threadId && resourceId ? { threadId, resourceId } : undefined;
}

function errorResult(error: unknown): ToolError {
  return { isError: true, content: error instanceof Error ? error.message : String(error) };
}

/** Builds the model-facing MCP Events tools for a provider. */
export function createMCPEventsTools({
  provider,
  client,
  servers,
}: {
  provider: MCPEventsSignalProvider;
  client: Pick<MCPClient, 'events'>;
  servers?: string[];
}) {
  const notAllowed = (server: string): ToolError | undefined =>
    servers && !servers.includes(server)
      ? { isError: true, content: `MCP server "${server}" is not enabled for event tools.` }
      : undefined;

  return {
    mcp_events_list: createTool({
      id: 'mcp_events_list',
      description:
        'List the event types an MCP server offers. Each has a name, a description, its delivery modes and an inputSchema for subscription arguments.',
      inputSchema: z.object({ server: targetSchema.shape.server }),
      execute: async ({ server }) => {
        const denied = notAllowed(server);
        if (denied) return denied;
        try {
          const descriptors = await client.events.list(server);
          return {
            events: descriptors.map(({ name, description, delivery, inputSchema }) => ({
              name,
              description,
              delivery,
              inputSchema,
            })),
          };
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
    mcp_events_subscribe: createTool({
      id: 'mcp_events_subscribe',
      description:
        'Subscribe this conversation to an MCP server event. Occurrences arrive later as notifications in this thread.',
      inputSchema: targetSchema,
      execute: async ({ server, event, arguments: args }, context) => {
        const denied = notAllowed(server);
        if (denied) return denied;
        const thread = threadOf(context);
        if (!thread) return NO_MEMORY;
        try {
          const subscription = await provider.subscribeThread(thread, {
            server,
            event,
            args: args === undefined ? undefined : decodeArguments(args),
          });
          return { subscribed: true, key: subscription.externalResourceId };
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
    mcp_events_unsubscribe: createTool({
      id: 'mcp_events_unsubscribe',
      description: 'Stop delivering an MCP server event to this conversation. Use the same server, event and arguments.',
      inputSchema: targetSchema,
      execute: async ({ server, event, arguments: args }, context) => {
        const denied = notAllowed(server);
        if (denied) return denied;
        const thread = threadOf(context);
        if (!thread) return NO_MEMORY;
        try {
          return {
            unsubscribed: await provider.unsubscribeThread(thread, {
              server,
              event,
              args: args === undefined ? undefined : decodeArguments(args),
            }),
          };
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  };
}
