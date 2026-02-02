import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { mastraAuth, rbacProvider } from './auth';

import { chefModelV2Agent } from './agents/model-v2-agent';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const config = {
  agents: {
    chefModelV2Agent,
  },
  bundler: {
    sourcemap: true,
  },
  server: {
    auth: mastraAuth,
    rbac: rbacProvider,
  },
  storage,
};

export const mastra = new Mastra({
  ...config,
});
