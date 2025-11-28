import type { Request, Response } from 'express';
import { listAgentsHandler, streamGenerateHandler } from '@mastra/server/handlers/agents';
import { RequestContext } from '@mastra/core/request-context';

export const listAgentsRouteHandler = async (_: Request, res: Response) => {
  const mastra = res.locals.mastra;
  const requestContext = res.locals.requestContext;
  const agents = await listAgentsHandler({ mastra, requestContext });
  res.json(agents);
};

export const streamAgentsRouteHandler = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');

  const mastra = res.locals.mastra;
  const agentId = req.params.agentId?.toString() ?? '';
  const requestContext = res.locals.requestContext;
  const body = await req.body;

  const response = await streamGenerateHandler({
    mastra,
    agentId,
    requestContext,
    body,
  });

  const readableStream = response.fullStream;
  const reader = readableStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        console.log('WRITING', JSON.stringify(value));
        res.write(`data: ${JSON.stringify(value)}\n\n`);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    res.end();
  }
};
