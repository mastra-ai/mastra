import { observability } from './observability.ts';
import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';
import { createSupportAgent } from './agents/support-agent.ts';
import { createKnowledge } from './knowledge/index.ts';
import { seedHostedExample } from './knowledge/seed-on-startup.ts';
import { createAuth, createReviewerAuthority, createSupportAuthorization, loadCredentials } from './server/access.ts';
import { hostedMode, serverHost, storageConfiguration } from './database/database.ts';
import { createStorage } from './storage.ts';
import { createHostedIdentity, hasHostedOAuthConfiguration } from './server/hosted-identity.ts';
import { createPlatformIdentity, platformAuthMiddleware } from './server/platform-identity.ts';
import { createReviewService } from './review/service.ts';
import { createConfirmationRoute } from './server/confirmations.ts';
import { createReviewWorkflow } from './workflows/review-workflow.ts';
import { datasets } from '../examples/datasets.ts';
import { runtimeExample } from '../examples/runtime.ts';

const database = storageConfiguration();
const hosted = hostedMode(database);
const onPlatform = Boolean(process.env.MASTRA_ENVIRONMENT_ID);
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
const usePlatformIdentity = onPlatform && !hasHostedOAuthConfiguration();
const platform = usePlatformIdentity
  ? createPlatformIdentity(datasets[runtimeExample.initialDataset]?.profiles[0])
  : undefined;
const oauth = hosted && !usePlatformIdentity ? createHostedIdentity() : undefined;
if (onPlatform && process.env.SUPPORT_SEED_ON_STARTUP === 'true') {
  await seedHostedExample();
}
const reviewerAuthority =
  platform?.reviewerAuthority ?? oauth?.reviewerAuthority ?? createReviewerAuthority(credentials);
const review = createReviewWorkflow(createReviewService(supportKnowledge, memory, reviewerAuthority));
const authorize = createSupportAuthorization(memory, review, reviewerAuthority);
const auth = platform?.createAuth(authorize) ?? createAuth(credentials, authorize, oauth?.authenticateToken);

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
    middleware: onPlatform ? (platform?.middleware ?? platformAuthMiddleware()) : undefined,
    apiRoutes: [...KNOWLEDGE_ROUTES, createConfirmationRoute(memory)],
  },
});
