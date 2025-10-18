/**
 * Handlers for OpenAI-compatible completions API
 */

import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
    completionsHandler as serverCompletionsHandler,
} from '@mastra/server/handlers/completions';
import type { Context } from 'hono';
import { handleError } from '../../error';
import type { CompletionsRequest } from './types';

/**
 * Non-streaming completions handler (Hono wrapper)
 */
export async function completionsHandler(c: Context): Promise<Response> {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');

    try {
        const body: CompletionsRequest = await c.req.json();

        const result = await serverCompletionsHandler({
            mastra,
            runtimeContext,
            body,
            abortSignal: c.req.raw.signal,
        });

        return c.json(result);
    } catch (error: any) {
        return handleError(error, 'Error in completions handler');
    }
}

/**
 * Streaming completions handler (Hono wrapper)
 */
export async function completionsStreamHandler(c: Context): Promise<Response> {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');

    try {
        const body: CompletionsRequest = await c.req.json();

        // TODO: Implement streaming - for now return not implemented
        return c.json(
            {
                error: {
                    message: 'Streaming not yet implemented',
                    type: 'server_error',
                },
            },
            501,
        );
    } catch (error: any) {
        return handleError(error, 'Error in streaming completions handler');
    }
}

