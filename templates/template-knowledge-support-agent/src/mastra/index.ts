import { observability } from './observability.ts';
import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';
import { createSupportAgent } from './agents/support-agent.ts';
import { createKnowledge } from './knowledge/index.ts';
import { createAuth, createReviewerAuthority, loadCredentials } from './server/access.ts';
import { localDatabaseUrl } from './database.ts';
import { createReviewService } from './review/service.ts';
import { createConfirmationRoute } from './server/confirmations.ts';
import { createReviewWorkflow } from './workflows/review-workflow.ts';

export const storage = new LibSQLStore({
  id: 'local-support',
  url: localDatabaseUrl(),
});
export const memory = new Memory({
  storage,
  options: { lastMessages: 12, semanticRecall: false, workingMemory: { enabled: false }, generateTitle: false },
});
export const supportKnowledge = createKnowledge(storage);
const support = createSupportAgent(memory, supportKnowledge);

const credentials = () =>
  loadCredentials(
    process.env.SUPPORT_CREDENTIALS_FILE ?? resolve('.local/local-access.json'),
    process.env.SUPPORT_STUDIO_ROLE,
  );
const review = createReviewWorkflow(
  createReviewService(supportKnowledge, memory, createReviewerAuthority(credentials)),
);
const auth = createAuth(credentials, memory, review);

export const mastra = new Mastra({
  logger: false,
  observability,
  storage,
  knowledge: { support: supportKnowledge },
  agents: { support },
  workflows: { review },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT ?? 4111),
    auth,
    apiRoutes: [...KNOWLEDGE_ROUTES, createConfirmationRoute(memory)],
  },
});
