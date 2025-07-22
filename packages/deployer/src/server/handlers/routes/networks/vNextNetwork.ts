import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  getVNextNetworksHandler as getOriginalVNextNetworksHandler,
  getVNextNetworkByIdHandler as getOriginalVNextNetworkByIdHandler,
  generateVNextNetworkHandler as getOriginalGenerateVNextNetworkHandler,
  streamGenerateVNextNetworkHandler as getOriginalStreamGenerateVNextNetworkHandler,
  loopVNextNetworkHandler as getOriginalLoopVNextNetworkHandler,
  loopStreamVNextNetworkHandler as getOriginalLoopStreamVNextNetworkHandler,
} from '@mastra/server/handlers/vNextNetwork';
import type { Context } from 'hono';
import { stream } from 'hono/streaming';

import { handleError } from '../../error';

export async function getVNextNetworksHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');

    const networks = await getOriginalVNextNetworksHandler({
      mastra,
      runtimeContext,
    });

    return c.json(networks);
  } catch (error) {
    return handleError(error, 'Error getting networks');
  }
}

export async function getVNextNetworkByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');

    const network = await getOriginalVNextNetworkByIdHandler({
      mastra,
      networkId,
      runtimeContext,
    });

    return c.json(network);
  } catch (error) {
    return handleError(error, 'Error getting network by ID');
  }
}

export async function generateVNextNetworkHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const networkId = c.req.param('networkId');
    const body = await c.req.json();

    const result = await getOriginalGenerateVNextNetworkHandler({
      mastra,
      runtimeContext,
      networkId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating from network');
  }
}

export async function streamGenerateVNextNetworkHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const networkId = c.req.param('networkId');
    const body = await c.req.json();

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalStreamGenerateVNextNetworkHandler({
            mastra,
            runtimeContext,
            networkId,
            body,
          });

          const reader = result.stream.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          mastra.getLogger().error('Error in network stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in network stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming from network');
  }
}

export async function loopVNextNetworkHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const networkId = c.req.param('networkId');
    const body = await c.req.json();

    const result = await getOriginalLoopVNextNetworkHandler({
      mastra,
      runtimeContext,
      networkId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error looping from network');
  }
}

export async function loopStreamVNextNetworkHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const networkId = c.req.param('networkId');
    const body = await c.req.json();

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalLoopStreamVNextNetworkHandler({
            mastra,
            runtimeContext,
            networkId,
            body,
          });

          const reader = result.stream.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          mastra.getLogger().error('Error in network loop stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in network loop stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming network loop');
  }
}
