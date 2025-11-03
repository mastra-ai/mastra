import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import { generateSystemPromptHandler } from '../../prompt';
import { executeAgentToolHandler, getAgentToolHandler } from '../tools/handlers';
import {
  generateHandler,
  getAgentByIdHandler,
  listAgentsHandler,
  getProvidersHandler,
  setAgentInstructionsHandler,
  streamGenerateHandler,
  updateAgentModelHandler,
  resetAgentModelHandler,
  vNextBodyOptions,
  deprecatedStreamVNextHandler,
  streamUIMessageHandler,
  streamGenerateLegacyHandler,
  generateLegacyHandler,
  reorderAgentModelListHandler,
  updateAgentModelInModelListHandler,
  streamNetworkHandler,
  sharedBodyOptions,
  approveToolCallHandler,
  declineToolCallHandler,
} from './handlers';
import { getListenerHandler, getSpeakersHandler, speakHandler, listenHandler } from './voice';

export function agentsRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.get(
    '/',
    describeRoute({
      description: 'Get all available agents',
      tags: ['agents'],
      responses: {
        200: {
          description: 'List of all agents',
        },
      },
    }),
    listAgentsHandler,
  );

  router.get(
    '/providers',
    describeRoute({
      description: 'Get all available model providers with connection status',
      tags: ['agents'],
      responses: {
        200: {
          description: 'List of model providers with their connection status',
        },
      },
    }),
    getProvidersHandler,
  );

  router.get(
    '/:agentId',
    describeRoute({
      description: 'Get agent by ID',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Agent details',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getAgentByIdHandler,
  );

  router.post(
    '/:agentId/generate-legacy',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate a response from an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
                threadId: { type: 'string' },
                resourceId: { type: 'string', description: 'The resource ID for the conversation' },
                resourceid: {
                  type: 'string',
                  description: 'The resource ID for the conversation (deprecated, use resourceId instead)',
                  deprecated: true,
                },
                runId: { type: 'string' },
                output: { type: 'object' },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the agent execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    generateLegacyHandler,
  );

  router.post(
    '/:agentId/generate',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate a response from an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
                threadId: { type: 'string' },
                resourceId: { type: 'string', description: 'The resource ID for the conversation' },
                resourceid: {
                  type: 'string',
                  description: 'The resource ID for the conversation (deprecated, use resourceId instead)',
                  deprecated: true,
                },
                runId: { type: 'string' },
                structuredOutput: {
                  type: 'object',
                  properties: {
                    schema: { type: 'object', description: 'The schema to use for the structured output' },
                    model: {
                      type: 'string',
                      description: 'Additional model to use for generating the structured output if provided',
                    },
                    instructions: {
                      type: 'string',
                      description:
                        'Custom instructions to provide to the structuring agent. This will override the default instructions.',
                    },
                    errorStrategy: {
                      type: 'string',
                      enum: ['strict', 'warn', 'fallback'],
                      description: 'The error strategy to use for the structured output',
                    },
                    fallbackValue: {
                      type: 'object',
                      description:
                        "The fallback value to use for the structured output when using 'fallback' error strategy",
                    },
                  },
                },
                output: { type: 'object', deprecated: true },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the agent execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    generateHandler,
  );

  router.post(
    '/:agentId/network',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Execute an agent as a Network',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: sharedBodyOptions,
              required: ['messages'],
            },
          },
        },
      },
    }),
    streamNetworkHandler,
  );

  router.post(
    '/:agentId/generate/vnext',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate a response from an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: vNextBodyOptions,
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    generateHandler,
  );

  router.post(
    '/:agentId/stream/vnext',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: '[DEPRECATED] This endpoint is deprecated. Please use /stream instead.',
      tags: ['agents'],
      deprecated: true,
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: vNextBodyOptions,
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    streamGenerateHandler,
  );

  router.post(
    '/:agentId/stream-legacy',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Stream a response from an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
                threadId: { type: 'string' },
                resourceId: { type: 'string', description: 'The resource ID for the conversation' },
                resourceid: {
                  type: 'string',
                  description: 'The resource ID for the conversation (deprecated, use resourceId instead)',
                  deprecated: true,
                },
                runId: { type: 'string' },
                output: { type: 'object' },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the agent execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streamed response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    streamGenerateLegacyHandler,
  );

  router.post(
    '/:agentId/stream',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Stream a response from an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
                threadId: { type: 'string' },
                resourceId: { type: 'string', description: 'The resource ID for the conversation' },
                resourceid: {
                  type: 'string',
                  description: 'The resource ID for the conversation (deprecated, use resourceId instead)',
                  deprecated: true,
                },
                runId: { type: 'string' },
                structuredOutput: {
                  type: 'object',
                  properties: {
                    schema: { type: 'object', description: 'The schema to use for the structured output' },
                    model: {
                      type: 'string',
                      description: 'Additional model to use for generating the structured output if provided',
                    },
                    instructions: {
                      type: 'string',
                      description:
                        'Custom instructions to provide to the structuring agent. This will override the default instructions.',
                    },
                    errorStrategy: {
                      type: 'string',
                      enum: ['strict', 'warn', 'fallback'],
                      description: 'The error strategy to use for the structured output',
                    },
                    fallbackValue: {
                      type: 'object',
                      description:
                        "The fallback value to use for the structured output when using 'fallback' error strategy",
                    },
                  },
                },
                output: { type: 'object', deprecated: true },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the agent execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streamed response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    streamGenerateHandler,
  );

  router.post(
    '/:agentId/streamVNext',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: '[DEPRECATED] This endpoint is deprecated. Please use /stream instead.',
      tags: ['agents'],
      deprecated: true,
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
                runId: { type: 'string' },
                output: { type: 'object' },
                experimental_output: { type: 'object' },
                instructions: { type: 'string' },
                toolsets: { type: 'object' },
                clientTools: { type: 'object' },
                context: {
                  type: 'array',
                  items: { type: 'object' },
                },
                memory: {
                  type: 'object',
                  properties: {
                    threadId: { type: 'string' },
                    resourceId: { type: 'string', description: 'The resource ID for the conversation' },
                  },
                },
                toolChoice: {
                  oneOf: [
                    { type: 'string', enum: ['auto', 'none', 'required'] },
                    { type: 'object', properties: { type: { type: 'string' }, toolName: { type: 'string' } } },
                  ],
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the agent execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        410: {
          description: 'Endpoint deprecated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  message: { type: 'string' },
                  deprecated_endpoint: { type: 'string' },
                  replacement_endpoint: { type: 'string' },
                },
              },
            },
          },
        },
      },
    }),
    deprecatedStreamVNextHandler,
  );

  router.post(
    '/:agentId/stream/vnext/ui',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description:
        '[DEPRECATED] This endpoint is deprecated. Please use the @mastra/ai-sdk package to for uiMessage transformations',
      tags: ['agents'],
      deprecated: true,
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: vNextBodyOptions,
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streamed response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    streamUIMessageHandler,
  );

  router.post(
    '/:agentId/stream/ui',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description:
        '[DEPRECATED] This endpoint is deprecated. Please use the @mastra/ai-sdk package to for uiMessage transformations',
      tags: ['agents'],
      deprecated: true,
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: vNextBodyOptions,
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streamed response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    streamUIMessageHandler,
  );

  router.post(
    '/:agentId/model',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Update the model for an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                modelId: {
                  type: 'string',
                  description: 'The modelId to update the agent to',
                },
                provider: {
                  type: 'string',
                  enum: ['openai', 'anthropic', 'groq', 'xai', 'google'],
                  description: 'The provider of the model to update the agent to',
                },
              },
              required: ['modelId', 'provider'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Model updated successfully',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    updateAgentModelHandler,
  );

  router.post(
    '/:agentId/model/reset',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Reset the agent model to the original model set during construction',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Model reset to original successfully',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    resetAgentModelHandler,
  );

  router.post(
    '/:agentId/models/reorder',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Reorder the models for an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                reorderedModelIds: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
              },
              required: ['reorderedModelIds'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Model list reordered successfully',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    reorderAgentModelListHandler,
  );

  router.post(
    '/:agentId/models/:modelConfigId',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Update the model for an agent in the model list',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'modelConfigId',
          in: 'path',
          required: true,
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
                model: {
                  type: 'object',
                  properties: {
                    modelId: {
                      type: 'string',
                      description: 'The modelId to update the agent to',
                    },
                    provider: {
                      type: 'string',
                      enum: ['openai', 'anthropic', 'groq', 'xai', 'google'],
                      description: 'The provider of the model to update the agent to',
                    },
                  },
                  required: ['modelId', 'provider'],
                },
                maxRetries: {
                  type: 'number',
                  description: 'The maximum number of retries for the model',
                },
                enabled: {
                  type: 'boolean',
                  description: 'Whether the model is enabled',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Model updated successfully',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    updateAgentModelInModelListHandler,
  );

  router.get(
    '/:agentId/speakers',
    async (c, next) => {
      c.header('Deprecation', 'true');
      c.header('Warning', '299 - "This endpoint is deprecated, use /api/agents/:agentId/voice/speakers instead"');
      c.header('Link', '</api/agents/:agentId/voice/speakers>; rel="successor-version"');
      return next();
    },
    describeRoute({
      description: '[DEPRECATED] Use /api/agents/:agentId/voice/speakers instead. Get available speakers for an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of available speakers',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Speaker information depending on the voice provider',
                  properties: {
                    voiceId: { type: 'string' },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getSpeakersHandler,
  );

  router.get(
    '/:agentId/voice/speakers',
    describeRoute({
      description: 'Get available speakers for an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of available speakers',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Speaker information depending on the voice provider',
                  properties: {
                    voiceId: { type: 'string' },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getSpeakersHandler,
  );

  router.post(
    '/:agentId/speak',
    bodyLimit(bodyLimitOptions),
    async (c, next) => {
      c.header('Deprecation', 'true');
      c.header('Warning', '299 - "This endpoint is deprecated, use /api/agents/:agentId/voice/speak instead"');
      c.header('Link', '</api/agents/:agentId/voice/speak>; rel="successor-version"');
      return next();
    },
    describeRoute({
      description:
        "[DEPRECATED] Use /api/agents/:agentId/voice/speak instead. Convert text to speech using the agent's voice provider",
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                text: {
                  type: 'string',
                  description: 'Text to convert to speech',
                },
                options: {
                  type: 'object',
                  description: 'Provider-specific options for speech generation',
                  properties: {
                    speaker: {
                      type: 'string',
                      description: 'Speaker ID to use for speech generation',
                    },
                  },
                  additionalProperties: true,
                },
              },
              required: ['text'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Audio stream',
          content: {
            'audio/mpeg': {
              schema: {
                format: 'binary',
                description: 'Audio stream containing the generated speech',
              },
            },
            'audio/*': {
              schema: {
                format: 'binary',
                description: 'Audio stream depending on the provider',
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    speakHandler,
  );

  router.post(
    '/:agentId/voice/speak',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: "Convert text to speech using the agent's voice provider",
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                input: {
                  type: 'string',
                  description: 'Text to convert to speech',
                },
                options: {
                  type: 'object',
                  description: 'Provider-specific options for speech generation',
                  properties: {
                    speaker: {
                      type: 'string',
                      description: 'Speaker ID to use for speech generation',
                    },
                    options: {
                      type: 'object',
                      description: 'Provider-specific options for speech generation',
                      additionalProperties: true,
                    },
                  },
                  additionalProperties: true,
                },
              },
              required: ['text'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Audio stream',
          content: {
            'audio/mpeg': {
              schema: {
                format: 'binary',
                description: 'Audio stream containing the generated speech',
              },
            },
            'audio/*': {
              schema: {
                format: 'binary',
                description: 'Audio stream depending on the provider',
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    speakHandler,
  );

  router.get(
    '/:agentId/voice/listener',
    describeRoute({
      description: 'Get available listener for an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Checks if listener is available for the agent',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Listener information depending on the voice provider',
                properties: {
                  enabled: { type: 'boolean' },
                },
                additionalProperties: true,
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getListenerHandler,
  );

  router.post(
    '/:agentId/listen',
    bodyLimit({
      ...bodyLimitOptions,
      maxSize: 10 * 1024 * 1024, // 10 MB for audio files
    }),
    async (c, next) => {
      c.header('Deprecation', 'true');
      c.header('Warning', '299 - "This endpoint is deprecated, use /api/agents/:agentId/voice/listen instead"');
      c.header('Link', '</api/agents/:agentId/voice/listen>; rel="successor-version"');
      return next();
    },
    describeRoute({
      description:
        "[DEPRECATED] Use /api/agents/:agentId/voice/listen instead. Convert speech to text using the agent's voice provider. Additional provider-specific options can be passed as query parameters.",
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'audio/mpeg': {
            schema: {
              format: 'binary',
              description:
                'Audio data stream to transcribe (supports various formats depending on provider like mp3, wav, webm, flac)',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Transcription result',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'Transcribed text',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    listenHandler,
  );

  router.post(
    '/:agentId/voice/listen',
    bodyLimit({
      ...bodyLimitOptions,
      maxSize: 10 * 1024 * 1024, // 10 MB for audio files
    }),
    describeRoute({
      description:
        "Convert speech to text using the agent's voice provider. Additional provider-specific options can be passed as query parameters.",
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['audio'],
              properties: {
                audio: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'Audio data stream to transcribe (supports various formats depending on provider like mp3, wav, webm, flac)',
                },
                options: {
                  type: 'object',
                  description: 'Provider-specific options for speech-to-text',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Transcription result',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'Transcribed text',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    listenHandler,
  );

  router.get(
    '/:agentId/tools/:toolId',
    describeRoute({
      description: 'Get agent tool by ID',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'toolId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Tool details',
        },
        404: {
          description: 'Tool or agent not found',
        },
      },
    }),
    getAgentToolHandler,
  );

  router.post(
    '/:agentId/tools/:toolId/execute',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Execute a tool through an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'toolId',
          in: 'path',
          required: true,
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
                data: { type: 'object' },
                requestContext: { type: 'object' },
              },
              required: ['data'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tool execution result',
        },
        404: {
          description: 'Tool or agent not found',
        },
      },
    }),
    executeAgentToolHandler,
  );

  router.post(
    '/:agentId/approve-tool-call',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Approve a tool call in human-in-the-loop workflow',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                runId: { type: 'string', description: 'The run ID for the execution' },
                toolCallId: { type: 'string', description: 'The tool call ID for the execution' },
                requestContext: { type: 'object', description: 'Request Context for the execution' },
                format: { type: 'string', enum: ['aisdk', 'mastra'], description: 'Output format' },
              },
              required: ['runId', 'toolCallId'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tool call approved and execution resumed',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    approveToolCallHandler,
  );

  router.post(
    '/:agentId/decline-tool-call',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Decline a tool call in human-in-the-loop workflow',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                runId: { type: 'string', description: 'The run ID for the execution' },
                toolCallId: { type: 'string', description: 'The tool call ID for the execution' },
                requestContext: { type: 'object', description: 'Request Context for the execution' },
                format: { type: 'string', enum: ['aisdk', 'mastra'], description: 'Output format' },
              },
              required: ['runId', 'toolCallId'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tool call declined and execution resumed',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    declineToolCallHandler,
  );

  return router;
}

export function agentsRouterDev(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.post(
    '/:agentId/instructions',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: "Update an agent's instructions",
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
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
                instructions: {
                  type: 'string',
                  description: 'New instructions for the agent',
                },
              },
              required: ['instructions'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Instructions updated successfully',
        },
        403: {
          description: 'Not allowed in non-playground environment',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    setAgentInstructionsHandler,
  );

  router.post(
    '/:agentId/instructions/enhance',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate an improved system prompt from instructions',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the agent whose model will be used for prompt generation',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                instructions: {
                  type: 'string',
                  description: 'Instructions to generate a system prompt from',
                },
                comment: {
                  type: 'string',
                  description: 'Optional comment for the enhanced prompt',
                },
              },
              required: ['instructions'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated system prompt and analysis',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  explanation: {
                    type: 'string',
                    description: 'Detailed analysis of the instructions',
                  },
                  new_prompt: {
                    type: 'string',
                    description: 'The enhanced system prompt',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Missing or invalid request parameters',
        },
        404: {
          description: 'Agent not found',
        },
        500: {
          description: 'Internal server error or model response parsing error',
        },
      },
    }),
    generateSystemPromptHandler,
  );

  return router;
}
