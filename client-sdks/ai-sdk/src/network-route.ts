import type { AgentExecutionOptions } from '@mastra/core/agent';
import { registerApiRoute } from '@mastra/core/server';
import type { OutputSchema } from '@mastra/core/stream';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { toAISdkV5Stream } from './convert-streams';

export type NetworkRouteOptions<OUTPUT extends OutputSchema = undefined> =
  | { path: `${string}:agentId${string}`; agent?: never; defaultOptions?: AgentExecutionOptions<OUTPUT, 'aisdk'> }
  | { path: string; agent: string; defaultOptions?: AgentExecutionOptions<OUTPUT, 'aisdk'> };

export function networkRoute<OUTPUT extends OutputSchema = undefined>({
  path = '/network/:agentId',
  agent,
  defaultOptions,
}: NetworkRouteOptions<OUTPUT>): ReturnType<typeof registerApiRoute> {
  if (!agent && !path.includes('/:agentId')) {
    throw new Error('Path must include :agentId to route to the correct agent or pass the agent explicitly');
  }

  return registerApiRoute(path, {
    method: 'POST',
    openapi: {
      summary: 'Execute an agent network and stream AI SDK events',
      description: 'Routes a request to an agent network and streams UIMessage chunks in AI SDK format',
      tags: ['ai-sdk'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          description: 'The ID of the routing agent to execute as a network',
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                messages: { type: 'array', items: { type: 'object' } },
                requestContext: { type: 'object', additionalProperties: true },
                runId: { type: 'string' },
                maxSteps: { type: 'number' },
                threadId: { type: 'string' },
                resourceId: { type: 'string' },
                modelSettings: { type: 'object', additionalProperties: true },
                tools: { type: 'array', items: { type: 'object' } },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Streaming AI SDK UIMessage event stream for the agent network',
          content: { 'text/plain': { schema: { type: 'string', description: 'SSE stream' } } },
        },
        '404': {
          description: 'Agent not found',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { error: { type: 'string' } } },
            },
          },
        },
      },
    },
    handler: async c => {
      const { messages, ...rest } = await c.req.json();
      const mastra = c.get('mastra');

      let agentToUse: string | undefined = agent;
      if (!agent) {
        const agentId = c.req.param('agentId');
        agentToUse = agentId;
      }

      if (c.req.param('agentId') && agent) {
        mastra
          .getLogger()
          ?.warn(
            `Fixed agent ID was set together with an agentId path parameter. This can lead to unexpected behavior.`,
          );
      }

      if (!agentToUse) {
        throw new Error('Agent ID is required');
      }

      const agentObj = mastra.getAgent(agentToUse);
      if (!agentObj) {
        throw new Error(`Agent ${agentToUse} not found`);
      }

      const result = await agentObj.network(messages, {
        ...defaultOptions,
        ...rest,
      });

      const uiMessageStream = createUIMessageStream({
        execute: async ({ writer }) => {
          for await (const part of toAISdkV5Stream(result, { from: 'network' })) {
            writer.write(part);
          }
        },
      });

      return createUIMessageStreamResponse({ stream: uiMessageStream });
    },
  });
}
