import type { AgentExecutionOptions } from '@mastra/core/agent';
import { registerApiRoute } from '@mastra/core/server';
import type { OutputSchema } from '@mastra/core/stream';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod/v3';
import type { ZodAny } from 'zod/v4';

export type chatRouteOptions<
  OUTPUT extends OutputSchema | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchema | ZodAny | JSONSchema7 | undefined = undefined,
> = {
  defaultOptions?: AgentExecutionOptions<OUTPUT, STRUCTURED_OUTPUT, 'aisdk'>;
} & (
  | {
      path: `${string}:agentId${string}`;
      agent?: never;
    }
  | {
      path: string;
      agent: string;
    }
);

export function chatRoute<
  OUTPUT extends OutputSchema | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchema | ZodAny | JSONSchema7 | undefined = undefined,
>({
  path = '/chat/:agentId',
  agent,
  defaultOptions,
}: chatRouteOptions<OUTPUT, STRUCTURED_OUTPUT>): ReturnType<typeof registerApiRoute> {
  if (!agent && !path.includes('/:agentId')) {
    throw new Error('Path must include :agentId to route to the correct agent or pass the agent explicitly');
  }

  return registerApiRoute(path, {
    method: 'POST',
    openapi: {
      summary: 'Chat with an agent',
      description: 'Send messages to an agent and stream the response in the AI SDK format',
      tags: ['ai-sdk'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          description: 'The ID of the agent to chat with',
          schema: {
            type: 'string',
          },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  description: 'Array of messages in the conversation',
                  items: {
                    type: 'object',
                    properties: {
                      role: {
                        type: 'string',
                        enum: ['user', 'assistant', 'system'],
                        description: 'The role of the message sender',
                      },
                      content: {
                        type: 'string',
                        description: 'The content of the message',
                      },
                    },
                    required: ['role', 'content'],
                  },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Streaming response from the agent',
          content: {
            'text/plain': {
              schema: {
                type: 'string',
                description: 'Server-sent events stream containing the agent response',
              },
            },
          },
        },
        '400': {
          description: 'Bad request - invalid input',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        '404': {
          description: 'Agent not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                  },
                },
              },
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

      const result = await agentObj.streamVNext<any, any, 'aisdk'>(messages, {
        ...defaultOptions,
        ...rest,
        format: 'aisdk',
      });

      return result.toUIMessageStreamResponse();
    },
  });
}
