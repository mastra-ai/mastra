import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  getAgentsHandler as getOriginalAgentsHandler,
  getAgentByIdHandler as getOriginalAgentByIdHandler,
  getEvalsByAgentIdHandler as getOriginalEvalsByAgentIdHandler,
  getLiveEvalsByAgentIdHandler as getOriginalLiveEvalsByAgentIdHandler,
  generateHandler as getOriginalGenerateHandler,
  streamGenerateHandler as getOriginalStreamGenerateHandler,
  streamVNextGenerateHandler as getOriginalStreamVNextGenerateHandler,
  updateAgentModelHandler as getOriginalUpdateAgentModelHandler,
  generateVNextHandler as getOriginalVNextGenerateHandler,
  streamVNextUIMessageHandler as getOriginalStreamVNextUIMessageHandler,
  generateLegacyHandler as getOriginalGenerateLegacyHandler,
  streamGenerateLegacyHandler as getOriginalStreamGenerateLegacyHandler,
} from '@mastra/server/handlers/agents';
import type { Context } from 'hono';

import { stream } from 'hono/streaming';
import { handleError } from '../../error';
import { AllowedProviderKeys } from '../../utils';

// @TODO: TYPED OPTIONS
export const vNextBodyOptions: any = {
  messages: {
    type: 'array',
    items: { type: 'object' },
  },
  threadId: { type: 'string' },
  resourceId: { type: 'string', description: 'The resource ID for the conversation' },
  runId: { type: 'string' },
  output: { type: 'object' },
  instructions: { type: 'string', description: "Optional instructions to override the agent's default instructions" },
  context: {
    type: 'array',
    items: { type: 'object' },
    description: 'Additional context messages to include',
  },
  memory: {
    type: 'object',
    properties: {
      threadId: { type: 'string' },
      resourceId: { type: 'string', description: 'The resource ID for the conversation' },
      options: { type: 'object', description: 'Memory configuration options' },
    },
    description: 'Memory options for the conversation',
  },
  savePerStep: { type: 'boolean', description: 'Whether to save messages incrementally on step finish' },
  format: { type: 'string', enum: ['mastra', 'aisdk'], description: 'Response format' },
  toolChoice: {
    oneOf: [
      { type: 'string', enum: ['auto', 'none', 'required'] },
      { type: 'object', properties: { type: { type: 'string' }, toolName: { type: 'string' } } },
    ],
    description: 'Controls how tools are selected during generation',
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

// Agent handlers
export async function getAgentsHandler(c: Context) {
  const serializedAgents = await getOriginalAgentsHandler({
    mastra: c.get('mastra'),
    runtimeContext: c.get('runtimeContext'),
  });

  return c.json(serializedAgents);
}

export async function getAgentByIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const runtimeContext: RuntimeContext = c.get('runtimeContext');
  const isPlayground = c.req.header('x-mastra-dev-playground') === 'true';

  const result = await getOriginalAgentByIdHandler({
    mastra,
    agentId,
    runtimeContext,
    isPlayground,
  });

  return c.json(result);
}

export async function getEvalsByAgentIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const runtimeContext: RuntimeContext = c.get('runtimeContext');

  const result = await getOriginalEvalsByAgentIdHandler({
    mastra,
    agentId,
    runtimeContext,
  });

  return c.json(result);
}

export async function getLiveEvalsByAgentIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const runtimeContext: RuntimeContext = c.get('runtimeContext');

  const result = await getOriginalLiveEvalsByAgentIdHandler({
    mastra,
    agentId,
    runtimeContext,
  });

  return c.json(result);
}

export async function generateLegacyHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();

    const result = await getOriginalGenerateLegacyHandler({
      mastra,
      agentId,
      runtimeContext,
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
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();

    const result = await getOriginalGenerateHandler({
      mastra,
      agentId,
      runtimeContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from agent');
  }
}

export async function generateVNextHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();

    const result = await getOriginalVNextGenerateHandler({
      mastra,
      agentId,
      runtimeContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating vnext from agent');
  }
}

export async function streamGenerateLegacyHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();

    const streamResponse = await getOriginalStreamGenerateLegacyHandler({
      mastra,
      agentId,
      runtimeContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}

export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();

    const streamResponse = await getOriginalStreamGenerateHandler({
      mastra,
      agentId,
      runtimeContext,
      body,
      abortSignal: c.req.raw.signal,
    });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}

export async function streamVNextGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();
    const logger = mastra.getLogger();

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const streamResponse = await getOriginalStreamVNextGenerateHandler({
            mastra,
            agentId,
            runtimeContext,
            body,
            abortSignal: c.req.raw.signal,
          });

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
          logger.error('Error in streamVNext generate: ' + ((err as Error)?.message ?? 'Unknown error'));
        }

        await stream.close();
      },
      async err => {
        logger.error('Error in watch stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming from agent');
  }
}

export async function streamVNextUIMessageHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra = c.get('mastra');
    const agentId = c.req.param('agentId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const body = await c.req.json();

    const streamResponse = await getOriginalStreamVNextUIMessageHandler({
      mastra,
      agentId,
      runtimeContext,
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
    const agent = mastra.getAgent(agentId);
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

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

export async function deprecatedStreamVNextHandler(c: Context) {
  return c.json(
    {
      error: 'This endpoint is deprecated',
      message: 'The /streamVNext endpoint has been deprecated. Please use an alternative streaming endpoint.',
      deprecated_endpoint: '/api/agents/:agentId/streamVNext',
      replacement_endpoint: '/api/agents/:agentId/stream/vnext',
    },
    410, // 410 Gone status code for deprecated endpoints
  );
}

export async function getModelProvidersHandler(c: Context) {
  const isPlayground = c.get('playground') === true;
  if (!isPlayground) {
    return c.json({ error: 'This API is only available in the playground environment' }, 403);
  }
  const envVars = process.env;
  const providers = Object.entries(AllowedProviderKeys);
  const envKeys = Object.keys(envVars);
  const availableProviders = providers.filter(([_, value]) => envKeys.includes(value) && !!envVars[value]);
  const availableProvidersNames = availableProviders.map(([key]) => key);
  return c.json(availableProvidersNames);
}
