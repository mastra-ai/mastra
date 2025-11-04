import type { Mastra } from '@mastra/core/mastra';
import express from 'express';
import { listAgentsHandler } from '@mastra/server/handlers/agents';
import { RequestContext } from '@mastra/core/request-context';

export interface RegisterRoutesOptions {
  prefix?: string;
  app: express.Application;
  mastra: Mastra;
}
export const registerRoutes = ({ app, mastra, prefix = '/mastra' }: RegisterRoutesOptions) => {
  const router = express.Router();

  router.get('/agents', (_, res) => {
    console.log('agents', mastra.listAgents());
    const agents = listAgentsHandler({ mastra, requestContext: new RequestContext() });
    res.json(agents);
  });

  app.use(prefix, router);
};
