import { ErrorCategory, ErrorDomain, getErrorFromUnknown, MastraError } from '@mastra/core/error';
import { getProviderConfig, PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';
import {
  listAgentsHandler as getOriginalListAgentsHandler,
  getAgentByIdHandler as getOriginalAgentByIdHandler,
  generateHandler as getOriginalGenerateHandler,
  streamGenerateHandler as getOriginalStreamGenerateHandler,
  updateAgentModelHandler as getOriginalUpdateAgentModelHandler,
  resetAgentModelHandler as getOriginalResetAgentModelHandler,
  streamUIMessageHandler as getOriginalStreamUIMessageHandler,
  generateLegacyHandler as getOriginalGenerateLegacyHandler,
  streamGenerateLegacyHandler as getOriginalStreamGenerateLegacyHandler,
  reorderAgentModelListHandler as getOriginalReorderAgentModelListHandler,
  updateAgentModelInModelListHandler as getOriginalUpdateAgentModelInModelListHandler,
  streamNetworkHandler as getOriginalStreamNetworkHandler,
  approveToolCallHandler as getOriginalApproveToolCallHandler,
  declineToolCallHandler as getOriginalDeclineToolCallHandler,
  getAgentFromSystem as getOriginalGetAgentFromSystem,
} from '@mastra/server/handlers/agents';
import type { Context } from 'hono';

import { stream } from 'hono/streaming';
import { handleError } from '../../error';

export const sharedBodyOptions: any = {
  messages: {
    type: 'array',
    items: { type: 'object' },
  },
  runId: { type: 'string' },
  memory: {
    type: 'object',
    properties: {
      thread: { type: 'string' },
      resource: { type: 'string', description: 'The resource ID for the conversation' },
      options: { type: 'object', description: 'Memory configuration options' },
    },
    description: 'Memory options for the conversation',
  },
  modelSettings: {
    type: 'object',
    properties: {
      maxTokens: { type: 'number', description: 'Maximum number of tokens to generate' },
      temperature: { type: 'number', minimum: 0, maximum: 1, description: 'Temperature setting for randomness (0-1)' },
      topP: { type: 'number', minimum: 0, maximum: 1, description: 'Nucleus sampling (0-1)' },
      topK: { type: 'number', description: 'Only sample from the top K options for each subsequent token' },
      presencePenalty: { type: 'number', minimum: -1, maximum: 1, description: 'Presence penalty (-1 to 1)' },
      frequencyPenalty: { type: 'number', minimum: -1, maximum: 1, description: 'Frequency penalty (-1 to 1)' },
      stopSequences: { type: 'array', items: { type: 'string' }, description: 'Stop sequences for text generation' },
      seed: { type: 'number', description: 'Seed for deterministic results' },
      maxRetries: { type: 'number', description: 'Maximum number of retries' },
      headers: { type: 'object', description: 'Additional HTTP headers' },
    },
    description: 'Model settings for generation',
  },
};

// @TODO: TYPED OPTIONS
export const vNextBodyOptions: any = {
  threadId: { type: 'string' },
  resourceId: { type: 'string', description: 'The resource ID for the conversation' },
  output: { type: 'object' },
  instructions: { type: 'string', description: "Optional instructions to override the agent's default instructions" },
  context: {
    type: 'array',
    items: { type: 'object' },
    description: 'Additional context messages to include',
  },
  savePerStep: { type: 'boolean', description: 'Whether to save messages incrementally on step finish' },
  toolChoice: {
    oneOf: [
      { type: 'string', enum: ['auto', 'none', 'required'] },
      { type: 'object', properties: { type: { type: 'string' }, toolName: { type: 'string' } } },
    ],
    description: 'Controls how tools are selected during generation',
  },
  format: { type: 'string', enum: ['mastra', 'aisdk'], description: 'Response format' },
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
  ...sharedBodyOptions,
};

// Agent handlers
export async function listAgentsHandler(c: Context) {
  const serializedAgents = await getOriginalListAgentsHandler({
    mastra: c.get('mastra'),
    requestContext: c.get('requestContext'),
  });

  return c.json(serializedAgents);
}

export async function getProvidersHandler(c: Context) {
  try {
    const providers = [];

    // Check each provider in the registry
    for (const [providerId, config] of Object.entries(PROVIDER_REGISTRY as Record<string, ProviderConfig>)) {
      const hasApiKey = !!(typeof config.apiKeyEnvVar === `string`
        ? process.env[config.apiKeyEnvVar]
        : Array.isArray(config.apiKeyEnvVar)
          ? config.apiKeyEnvVar.every((k: string) => !!process.env[k])
          : false);

      const providerConfig = getProviderConfig(providerId);

      providers.push({
        id: providerId,
        name: config.name,
        envVar: config.apiKeyEnvVar,
        connected: hasApiKey,
        models: [...config.models], // Convert readonly array to mutable
        docUrl: providerConfig?.docUrl || null,
      });
    }

    return c.json({ providers });
  } catch (error) {
    return handleError(error, 'Error getting providers');
  }
}

export async function getAgentByIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const requestContext: RequestContext = c.get('requestContext');
  const isPlayground = c.req.header('x-mastra-dev-playground') === 'true';

  const result = await getOriginalAgentByIdHandler({
    mastra,
    agentId,
    requestContext,
    isPlayground,
  });

  return c.json(result);
}

export async function generateLegacyHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext: RequestContext = c.get('requestContext');
    const body = await c.req.json();

    const result = await getOriginalGenerateLegacyHandler({
      mastra,
      agentId,
      requestContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function generateHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext: RequestContext = c.get('requestContext');
    const body = await c.req.json();

    const result = await getOriginalGenerateHandler({
      mastra,
      agentId,
      requestContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function streamGenerateLegacyHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext: RequestContext = c.get('requestContext');
    const body = await c.req.json();

    const streamResponse = await getOriginalStreamGenerateLegacyHandler({
      mastra,
      agentId,
      requestContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}

export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  const mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const requestContext: RequestContext = c.get('requestContext');
  const body = await c.req.json();
  const logger = mastra.getLogger();

  let streamResponse;
  try {
    streamResponse = await getOriginalStreamGenerateHandler({
      mastra,
      agentId,
      requestContext,
      body,
      abortSignal: c.req.raw.signal,
    });
  } catch (err) {
    return handleError(err, 'Error streaming from agent');
  }

  c.header('Transfer-Encoding', 'chunked');

  return stream(
    c,
    async stream => {
      try {
        const reader = streamResponse.fullStream.getReader();

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        let chunkResult;
        while ((chunkResult = await reader.read()) && !chunkResult.done) {
          await stream.write(`data: ${JSON.stringify(chunkResult.value)}\n\n`);
        }

        await stream.write('data: [DONE]\n\n');
      } catch (err) {
        logger.error('Error in stream generate: ' + ((err as Error)?.message ?? 'Unknown error'));

        const errorChunk: ChunkType = {
          type: 'error',
          from: ChunkFrom.AGENT,
          runId: body.runId || 'unknown',
          payload: {
            error: getErrorFromUnknown(err, { fallbackMessage: 'Unknown error in stream generate' }),
          },
        };

        await stream.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
      }

      await stream.close();
    },
    async err => {
      logger.error('Error in watch stream: ' + err?.message);
    },
  );
}

export async function approveToolCallHandler(c: Context): Promise<Response | undefined> {
  const mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const requestContext: RequestContext = c.get('requestContext');
  const body = await c.req.json();
  const logger = mastra.getLogger();

  let streamResponse;
  try {
    streamResponse = await getOriginalApproveToolCallHandler({
      mastra,
      requestContext,
      agentId,
      body,
      abortSignal: c.req.raw.signal,
    });
  } catch (err) {
    return handleError(err, 'Error approving tool call');
  }

  c.header('Transfer-Encoding', 'chunked');

  return stream(
    c,
    async stream => {
      try {
        const reader = streamResponse.fullStream.getReader();

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        let chunkResult;
        while ((chunkResult = await reader.read()) && !chunkResult.done) {
          await stream.write(`data: ${JSON.stringify(chunkResult.value)}\n\n`);
        }

        await stream.write('data: [DONE]\n\n');
      } catch (err) {
        logger.error('Error in approve tool call: ' + ((err as Error)?.message ?? 'Unknown error'));

        const errorChunk: ChunkType = {
          type: 'error',
          from: ChunkFrom.AGENT,
          runId: body.runId || 'unknown',
          payload: {
            error:
              err instanceof Error
                ? {
                    message: err.message,
                    name: err.name,
                    stack: err.stack,
                  }
                : String(err),
          },
        };

        await stream.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
      }

      await stream.close();
    },
    async err => {
      logger.error('Error in watch stream: ' + err?.message);
    },
  );
}

export async function declineToolCallHandler(c: Context): Promise<Response | undefined> {
  const mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const requestContext: RequestContext = c.get('requestContext');
  const body = await c.req.json();
  const logger = mastra.getLogger();

  let streamResponse;
  try {
    streamResponse = await getOriginalDeclineToolCallHandler({
      mastra,
      requestContext,
      agentId,
      body,
      abortSignal: c.req.raw.signal,
    });
  } catch (err) {
    return handleError(err, 'Error declining tool call');
  }

  c.header('Transfer-Encoding', 'chunked');

  return stream(
    c,
    async stream => {
      try {
        const reader = streamResponse.fullStream.getReader();

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        let chunkResult;
        while ((chunkResult = await reader.read()) && !chunkResult.done) {
          await stream.write(`data: ${JSON.stringify(chunkResult.value)}\n\n`);
        }

        await stream.write('data: [DONE]\n\n');
      } catch (err) {
        logger.error('Error in decline tool call: ' + ((err as Error)?.message ?? 'Unknown error'));

        const errorChunk: ChunkType = {
          type: 'error',
          from: ChunkFrom.AGENT,
          runId: body.runId || 'unknown',
          payload: {
            error:
              err instanceof Error
                ? {
                    message: err.message,
                    name: err.name,
                    stack: err.stack,
                  }
                : String(err),
          },
        };

        await stream.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
      }

      await stream.close();
    },
    async err => {
      logger.error('Error in watch stream: ' + err?.message);
    },
  );
}

export async function streamNetworkHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const requestContext: RequestContext = c.get('requestContext');
  const body = await c.req.json();
  const logger = mastra.getLogger();

  // Validate agent exists and has memory before starting stream
  const agent = await getOriginalGetAgentFromSystem({ mastra, agentId });

  // Check if agent has memory configured before starting the stream
  const memory = await agent.getMemory({ requestContext });

  if (!memory) {
    return handleError(
      new MastraError({
        id: 'AGENT_NETWORK_MEMORY_REQUIRED',
        domain: ErrorDomain.AGENT_NETWORK,
        category: ErrorCategory.USER,
        text: 'Memory is required for the agent network to function properly. Please configure memory for the agent.',
        details: {
          status: 400,
        },
      }),
      'Memory required for agent network',
    );
  }

  let streamResponse;
  try {
    streamResponse = await getOriginalStreamNetworkHandler({
      mastra,
      agentId,
      requestContext,
      body,
      // abortSignal: c.req.raw.signal,
    });
  } catch (err) {
    return handleError(err, 'Error streaming from agent in network mode');
  }

  c.header('Transfer-Encoding', 'chunked');

  return stream(
    c,
    async stream => {
      try {
        const reader = streamResponse.getReader();

        stream.onAbort(() => {
          void reader.cancel('request aborted');
        });

        let chunkResult;
        while ((chunkResult = await reader.read()) && !chunkResult.done) {
          await stream.write(`data: ${JSON.stringify(chunkResult.value)}\n\n`);
        }

        await stream.write('data: [DONE]\n\n');
      } catch (err) {
        logger.error('Error in streamNetwork generate: ' + ((err as Error)?.message ?? 'Unknown error'));

        const errorChunk: ChunkType = {
          type: 'error',
          from: ChunkFrom.AGENT,
          runId: body.runId || 'unknown',
          payload: {
            error:
              err instanceof Error
                ? {
                    message: err.message,
                    name: err.name,
                    stack: err.stack,
                  }
                : String(err),
          },
        };

        await stream.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
      }

      await stream.close();
    },
    async err => {
      logger.error('Error in watch stream: ' + err?.message);
    },
  );
}

export async function streamUIMessageHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const requestContext: RequestContext = c.get('requestContext');
    const body = await c.req.json();

    const streamResponse = await getOriginalStreamUIMessageHandler({
      mastra,
      agentId,
      requestContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'Error streaming ui message from agent');
  }
}

export async function setAgentInstructionsHandler(c: Context) {
  try {
    // Check if this is a playground request
    const isPlayground = c.get('playground') === true;
    if (!isPlayground) {
      return c.json({ error: 'This API is only available in the playground environment' }, 403);
    }

    const agentId = c.req.param('agentId');
    const { instructions } = await c.req.json();

    if (!agentId || !instructions) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const mastra: Mastra = c.get('mastra');
    const agent = await getOriginalGetAgentFromSystem({ mastra, agentId });

    agent.__updateInstructions(instructions);

    return c.json(
      {
        instructions,
      },
      200,
    );
  } catch (error) {
    return handleError(error, 'Error setting agent instructions');
  }
}

export async function updateAgentModelHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const body = await c.req.json();

    const result = await getOriginalUpdateAgentModelHandler({
      mastra,
      agentId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error updating agent model');
  }
}

export async function resetAgentModelHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');

    const result = await getOriginalResetAgentModelHandler({
      mastra,
      agentId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resetting agent model');
  }
}

export async function deprecatedStreamVNextHandler(c: Context) {
  return c.json(
    {
      error: 'This endpoint is deprecated',
      message: 'The /stream/vnext endpoint has been deprecated. Please use an alternative streaming endpoint.',
      deprecated_endpoint: '/api/agents/:agentId/stream/vnext',
      replacement_endpoint: '/api/agents/:agentId/stream',
    },
    410, // 410 Gone status code for deprecated endpoints
  );
}

export async function updateAgentModelInModelListHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const modelConfigId = c.req.param('modelConfigId');
    const body = await c.req.json();

    const result = await getOriginalUpdateAgentModelInModelListHandler({
      mastra,
      agentId,
      body,
      modelConfigId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error updating agent model in model list');
  }
}

export async function reorderAgentModelListHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const body = await c.req.json();

    const result = await getOriginalReorderAgentModelListHandler({
      mastra,
      agentId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error reordering agent model list');
  }
}
