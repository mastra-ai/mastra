import type { Request, Response } from 'express';
import { listAgentsHandler } from '@mastra/server/handlers/agents';
import { RequestContext } from '@mastra/core/request-context';

export const listAgentsRouteHandler = async (_: Request, res: Response) => {
  const mastra = res.locals.mastra;
  const agents = await listAgentsHandler({ mastra, requestContext: new RequestContext() });
  res.json(agents);
};
