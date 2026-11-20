import { observability } from './observability.ts';
import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';
import { createSupportAgent } from './agents/support-agent.ts';
import { createKnowledge } from './knowledge/index.ts';
import { seedHostedExample } from './knowledge/seed-on-startup.ts';
import { createAuth, createReviewerAuthority, loadCredentials } from './server/access.ts';
import { hostedMode, serverHost, storageConfiguration } from './database.ts';
import { createStorage } from './storage.ts';
import { createHostedIdentity } from './server/hosted-identity.ts';
import { createReviewService } from './review/service.ts';
import { createConfirmationRoute } from './server/confirmations.ts';
import { createReviewWorkflow } from './workflows/review-workflow.ts';

const database = storageConfiguration();
const hosted = hostedMode(database);
export const storage = createStorage('support', database);
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
const identity = hosted ? createHostedIdentity() : undefined;
if (process.env.MASTRA_ENVIRONMENT_ID && process.env.SUPPORT_SEED_ON_STARTUP === 'true') {
  await seedHostedExample();
}
const review = createReviewWorkflow(
  createReviewService(supportKnowledge, memory, identity?.reviewerAuthority ?? createReviewerAuthority(credentials)),
);
const auth = createAuth(credentials, memory, review, identity);

export const mastra = new Mastra({
  logger: false,
  observability,
  storage,
  knowledge: { support: supportKnowledge },
  agents: { support },
  workflows: { review },
  server: {
    host: serverHost(hosted),
    port: Number(process.env.PORT ?? 4111),
    auth,
    apiRoutes: [...KNOWLEDGE_ROUTES, createConfirmationRoute(memory)],
  },
});
