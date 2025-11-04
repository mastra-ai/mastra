import type { Mastra } from '@mastra/core/mastra';
import express from 'express';

import { listAgentsRouteHandler } from './routes/listAgents';

export interface RegisterRoutesOptions {
  prefix?: string;
  app: express.Application;
  mastra: Mastra;
}
export const registerRoutes = ({ app, mastra, prefix = '/mastra' }: RegisterRoutesOptions) => {
  const router = express.Router();

  router.use((_, res, next) => {
    res.locals.mastra = mastra;
    next();
  });

  router.get('/agents', listAgentsRouteHandler);

  app.use(prefix, router);
};
