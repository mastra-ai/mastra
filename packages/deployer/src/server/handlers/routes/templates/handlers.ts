import type { Mastra } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import {
  createTemplateInstallRunHandler as getOriginalCreateTemplateInstallRunHandler,
  startAsyncTemplateInstallHandler as getOriginalStartAsyncTemplateInstallHandler,
  streamTemplateInstallHandler as getOriginalStreamTemplateInstallHandler,
  streamVNextTemplateInstallHandler as getOriginalStreamVNextTemplateInstallHandler,
  startTemplateInstallRunHandler as getOriginalStartTemplateInstallRunHandler,
  watchTemplateInstallHandler as getOriginalWatchTemplateInstallHandler,
  getTemplateInstallRunByIdHandler as getOriginalGetTemplateInstallRunByIdHandler,
  getTemplateInstallRunExecutionResultHandler as getOriginalGetTemplateInstallRunExecutionResultHandler,
  getTemplateInstallRunsHandler as getOriginalGetTemplateInstallRunsHandler,
  cancelTemplateInstallRunHandler as getOriginalCancelTemplateInstallRunHandler,
  sendTemplateInstallRunEventHandler as getOriginalSendTemplateInstallRunEventHandler,
  resumeAsyncTemplateInstallHandler as getOriginalResumeAsyncTemplateInstallHandler,
  resumeTemplateInstallHandler as getOriginalResumeTemplateInstallHandler,
  getAgentBuilderWorkflow as getOriginalGetAgentBuilderWorkflow,
  type TemplateInstallationRequest,
} from '@mastra/server/handlers/templates';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
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

export async function startTemplateInstallRunHandler(c: Context): Promise<Response> {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const runId = c.req.query('runId');
    const body = (await c.req.json()) as TemplateInstallationRequest;

    await getOriginalStartTemplateInstallRunHandler({
      mastra,
      runtimeContext,
      runId,
      repo: body.repo,
      ref: body.ref,
      slug: body.slug,
      targetPath: body.targetPath,
      variables: body.variables,
    });

    return c.json({ message: 'Template installation run started' });
  } catch (error) {
    return handleError(error, 'Error starting template installation run');
  }
}

export function watchTemplateInstallHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const logger = mastra.getLogger();
    const runId = c.req.query('runId');

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to watch template installation' });
    }

    c.header('Transfer-Encoding', 'chunked');

    return stream(
      c,
      async stream => {
        try {
          const result = await getOriginalWatchTemplateInstallHandler({
            mastra,
            runtimeContext: c.get('runtimeContext'),
            runId,
            repo: '', // These will be ignored by the watch handler
            slug: '',
          });

          const reader = result.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in template watch stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in template watch stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error watching template installation');
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

export async function streamVNextTemplateInstallHandler(c: Context) {
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
          const result = await getOriginalStreamVNextTemplateInstallHandler({
            mastra,
            runtimeContext,
            runId,
            repo: body.repo,
            ref: body.ref,
            slug: body.slug,
            targetPath: body.targetPath,
            variables: body.variables,
          });

          const reader = result.getReader();

          stream.onAbort(() => {
            void reader.cancel('request aborted');
          });

          let chunkResult;
          while ((chunkResult = await reader.read()) && !chunkResult.done) {
            await stream.write(JSON.stringify(chunkResult.value) + '\x1E');
          }
        } catch (err) {
          logger.error('Error in template VNext stream: ' + ((err as Error)?.message ?? 'Unknown error'));
        }
      },
      async err => {
        logger.error('Error in template VNext stream: ' + err?.message);
      },
    );
  } catch (error) {
    return handleError(error, 'Error streaming template installation');
  }
}

export async function resumeAsyncTemplateInstallHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const runId = c.req.query('runId');
    const { step, resumeData } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume template installation' });
    }

    const result = await getOriginalResumeAsyncTemplateInstallHandler({
      mastra,
      runtimeContext,
      runId,
      repo: '', // These will be retrieved from the workflow state
      slug: '',
      body: { step, resumeData },
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error resuming template installation step');
  }
}

export async function resumeTemplateInstallHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runtimeContext: RuntimeContext = c.get('runtimeContext');
    const runId = c.req.query('runId');
    const { step, resumeData } = await c.req.json();

    if (!runId) {
      throw new HTTPException(400, { message: 'runId required to resume template installation' });
    }

    await getOriginalResumeTemplateInstallHandler({
      mastra,
      runtimeContext,
      runId,
      repo: '', // These will be retrieved from the workflow state
      slug: '',
      body: { step, resumeData },
    });

    return c.json({ message: 'Template installation run resumed' });
  } catch (error) {
    return handleError(error, 'Error resuming template installation');
  }
}

export async function getTemplateInstallRunsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const { fromDate, toDate, limit, offset, resourceId } = c.req.query();

    // Call the underlying workflow handler directly since it has different params
    const templateRuns = await getOriginalGetTemplateInstallRunsHandler({
      mastra,
      runtimeContext: c.get('runtimeContext'),
      repo: '', // These will be ignored by the handler
      slug: '',
      ...(fromDate && { fromDate: new Date(fromDate) }),
      ...(toDate && { toDate: new Date(toDate) }),
      ...(limit && { limit: Number(limit) }),
      ...(offset && { offset: Number(offset) }),
      ...(resourceId && { resourceId }),
    } as any);

    return c.json(templateRuns);
  } catch (error) {
    return handleError(error, 'Error getting template installation runs');
  }
}

export async function getTemplateInstallRunByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runId = c.req.param('runId');

    const templateRun = await getOriginalGetTemplateInstallRunByIdHandler({
      mastra,
      runtimeContext: c.get('runtimeContext'),
      runId,
      repo: '', // These will be ignored by the handler
      slug: '',
    });

    return c.json(templateRun);
  } catch (error) {
    return handleError(error, 'Error getting template installation run');
  }
}

export async function getTemplateInstallRunExecutionResultHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runId = c.req.param('runId');

    const templateRunExecutionResult = await getOriginalGetTemplateInstallRunExecutionResultHandler({
      mastra,
      runtimeContext: c.get('runtimeContext'),
      runId,
      repo: '', // These will be ignored by the handler
      slug: '',
    });

    return c.json(templateRunExecutionResult);
  } catch (error) {
    return handleError(error, 'Error getting template installation run execution result');
  }
}

export async function cancelTemplateInstallRunHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runId = c.req.param('runId');

    const result = await getOriginalCancelTemplateInstallRunHandler({
      mastra,
      runtimeContext: c.get('runtimeContext'),
      runId,
      repo: '', // These will be ignored by the handler
      slug: '',
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error canceling template installation run');
  }
}

export async function sendTemplateInstallRunEventHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const runId = c.req.param('runId');
    const { event, data } = await c.req.json();

    // Call the underlying workflow handler directly since it has different params
    const result = await getOriginalSendTemplateInstallRunEventHandler({
      mastra,
      runtimeContext: c.get('runtimeContext'),
      runId,
      repo: '', // These will be ignored by the handler
      slug: '',
      event,
      data,
    } as any);

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error sending template installation run event');
  }
}

export async function getAgentBuilderWorkflow(c: Context): Promise<Response> {
  try {
    const result = await getOriginalGetAgentBuilderWorkflow();
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting agent builder workflow');
  }
}
