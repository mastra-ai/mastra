import { randomUUID } from 'crypto';
import type { Mastra } from '@mastra/core';
import type { TaskSendParams, TaskQueryParams, TaskIdParams } from '@mastra/core/a2a';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  getAgentCardByIdHandler as getOriginalAgentCardByIdHandler,
  getAgentExecutionHandler as getOriginalAgentExecutionHandler,
} from '@mastra/server/handlers/a2a';

import type { Context } from 'hono';
import { stream } from 'hono/streaming';

export async function getAgentCardByIdHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const runtimeContext: RuntimeContext = c.get('runtimeContext');

  const result = await getOriginalAgentCardByIdHandler({
    mastra,
    agentId,
    runtimeContext,
  });

  return c.json(result);
}

export async function getAgentExecutionHandler(c: Context) {
  const mastra: Mastra = c.get('mastra');
  const agentId = c.req.param('agentId');
  const runtimeContext: RuntimeContext = c.get('runtimeContext');
  const logger = mastra.getLogger();
  const body = await c.req.json();

  // Validate the method is one of the allowed A2A methods
  if (!['tasks/send', 'tasks/sendSubscribe', 'tasks/get', 'tasks/cancel'].includes(body.method)) {
    return c.json({ error: { message: `Unsupported method: ${body.method}`, code: 'invalid_method' } }, 400);
  }

  const result = await getOriginalAgentExecutionHandler({
    mastra,
    agentId,
    runtimeContext,
    requestId: randomUUID(),
    method: body.method as 'tasks/send' | 'tasks/sendSubscribe' | 'tasks/get' | 'tasks/cancel',
    params: body.params as TaskSendParams | TaskQueryParams | TaskIdParams,
    logger,
  });

  if (body.method === 'tasks/sendSubscribe') {
    return stream(
      c,
      async stream => {
        try {
          stream.onAbort(() => {
            if (!result.locked) {
              return result.cancel();
            }
          });

          for await (const chunk of result) {
            await stream.write(JSON.stringify(chunk) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in tasks/sendSubscribe stream: ' + (err as Error)?.message);
        }
      },
      async err => {
        logger.error('Error in tasks/sendSubscribe stream: ' + (err as Error)?.message);
      },
    );
  }

  return c.json(result);
}
