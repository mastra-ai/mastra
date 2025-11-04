import type { Mastra } from '@mastra/core/mastra';
import express from 'express';

import { listAgentsRouteHandler, streamAgentsRouteHandler } from './routes/agents';
import { RequestContext } from '@mastra/core/request-context';

export interface RegisterRoutesOptions {
  prefix?: string;
  app: express.Application;
  mastra: Mastra;
}
export const registerRoutes = ({ app, mastra, prefix = '/mastra' }: RegisterRoutesOptions) => {
  const router = express.Router();
  router.use(express.json());

  router.use((_, res, next) => {
    res.locals.mastra = mastra;
    res.locals.requestContext = new RequestContext();
    next();
  });

  router.get('/agents', listAgentsRouteHandler);
  router.post('/agents/:agentId/stream', streamAgentsRouteHandler);

  app.use(prefix, router);
};
