import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  createTemplateInstallRunHandler as getOriginalCreateTemplateInstallRunHandler,
  startAsyncTemplateInstallHandler as getOriginalStartAsyncTemplateInstallHandler,
  streamTemplateInstallHandler as getOriginalStreamTemplateInstallHandler,
  type TemplateInstallationRequest,
} from '@mastra/server/handlers/templates';
import type { Context } from 'hono';
import { stream } from 'hono/streaming';

import { handleError } from '../../error';

export async function createTemplateInstallRunHandler(c: Context): Promise<Response> {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const runId = c.req.query('runId');
    const body = (await c.req.json()) as TemplateInstallationRequest;

    const result = await getOriginalCreateTemplateInstallRunHandler({
      mastra,
      runtimeContext,
      runId,
      repo: body.repo,
      ref: body.ref,
      slug: body.slug,
      targetPath: body.targetPath,
      variables: body.variables,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error creating template installation run');
  }
}

export async function startAsyncTemplateInstallHandler(c: Context): Promise<Response> {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const runId = c.req.query('runId');
    const body = (await c.req.json()) as TemplateInstallationRequest;

    const result = await getOriginalStartAsyncTemplateInstallHandler({
      mastra,
      runtimeContext,
      runId,
      repo: body.repo,
      ref: body.ref,
      slug: body.slug,
      targetPath: body.targetPath,
      variables: body.variables,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error starting async template installation');
  }
}

export async function streamTemplateInstallHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const logger = mastra.getLogger();
    const runId = c.req.query('runId');
    const body = (await c.req.json()) as TemplateInstallationRequest;

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalStreamTemplateInstallHandler({
            mastra,
            runtimeContext,
            runId,
            repo: body.repo,
            ref: body.ref,
            slug: body.slug,
            targetPath: body.targetPath,
            variables: body.variables,
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
          logger.error('Error in template installation stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
        await stream.close();
      },
      async err => {
        logger.error('Error in template installation stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming template installation');
  }
}
