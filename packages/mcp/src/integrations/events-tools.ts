import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { z } from 'zod/v4';
import type { MCPClient } from '../client/configuration';
import type { MCPEventsSignalProvider } from './events-signals';

const targetSchema = z.object({
  server: z.string().min(1).describe('Name of the MCP server, as configured on the client'),
  event: z.string().min(1).describe('Event type name, from mcp_events_list'),
  arguments: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Subscription arguments matching the event's inputSchema"),
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
          const subscription = await provider.subscribeThread(thread, { server, event, args });
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
          return { unsubscribed: await provider.unsubscribeThread(thread, { server, event, args }) };
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  };
}
