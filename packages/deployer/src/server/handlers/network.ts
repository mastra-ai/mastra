import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  getNetworksHandler as getOriginalNetworksHandler,
  getNetworkByIdHandler as getOriginalNetworkByIdHandler,
  generateHandler as getOriginalGenerateHandler,
  streamGenerateHandler as getOriginalStreamGenerateHandler,
} from '@mastra/server/handlers/network';
import type { Context } from 'hono';

import { handleError } from './error';

export async function getNetworksHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');

    const networks = await getOriginalNetworksHandler({
      mastra,
      runtimeContext,
    });

    return c.json(networks);
  } catch (error) {
    return handleError(error, 'Error getting networks');
  }
}

export async function getNetworkByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');

    const network = await getOriginalNetworkByIdHandler({
      mastra,
      networkId,
      runtimeContext,
    });

    return c.json(network);
  } catch (error) {
    return handleError(error, 'Error getting network by ID');
  }
}

export async function generateHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const networkId = c.req.param('networkId');
    const body = await c.req.json();

    const result = await getOriginalGenerateHandler({
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

export async function streamGenerateHandler(c: Context): Promise<Response | undefined> {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const networkId = c.req.param('networkId');
    const body = await c.req.json();

    const streamResponse = await getOriginalStreamGenerateHandler({
      mastra,
      runtimeContext,
      networkId,
      body,
    });

    return streamResponse;
  } catch (error) {
    return handleError(error, 'Error streaming from network');
  }
}
