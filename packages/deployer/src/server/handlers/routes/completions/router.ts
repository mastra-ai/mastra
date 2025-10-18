/**
 * Router for OpenAI-compatible completions API
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { BodyLimitOptions } from '../../../types';
import { completionsHandler, completionsStreamHandler } from './handlers';

export function completionsRouter(bodyLimitOptions: BodyLimitOptions) {
    const router = new Hono();

    router.post(
        '/completions',
        bodyLimit(bodyLimitOptions),
        async (c: Context) => {
            const body = await c.req.json();

            // Route to streaming or non-streaming handler
            if (body.stream === true) {
                return completionsStreamHandler(c);
            }

            return completionsHandler(c);
        },
    );

    return router;
}

