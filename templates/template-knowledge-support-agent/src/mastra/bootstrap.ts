import { observability } from './observability.ts';
import { resolve } from 'node:path';
import { Memory } from '@mastra/memory';
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';
import { createSupportAgent } from './agents/support-agent.ts';
import { createKnowledge } from './knowledge/index.ts';
import { seedHostedExample } from './knowledge/seed-on-startup.ts';
import { createAuth, createReviewerAuthority, createSupportAuthorization, loadCredentials } from './server/access.ts';
import { createStore, hostedMode, resolveStoreConfiguration } from './database/store.ts';
import { createKnowledgeReadSnapshot } from './database/knowledge-snapshot.ts';
import { historyStorageOpener } from './database/history-storage.ts';
import { createHostedIdentity, hasHostedOAuthConfiguration } from './server/hosted-identity.ts';
import { createPlatformIdentity, platformAuthMiddleware } from './server/platform-identity.ts';
import { createReviewService } from './review/service.ts';
import { createConfirmationRoute } from './server/confirmations.ts';
import { createReviewWorkflow } from './workflows/review-workflow.ts';
import { datasets } from '../examples/datasets.ts';
import { runtimeExample } from '../examples/runtime.ts';

function serverHost(hosted: boolean, onPlatform: boolean) {
  if (!hosted) return '127.0.0.1';
  const host = process.env.SUPPORT_HOST ?? (onPlatform ? '0.0.0.0' : undefined);
  if (!host || !/^[a-zA-Z0-9.:-]+$/u.test(host)) throw new Error('Hosted mode requires SUPPORT_HOST');
  return host;
}

export async function bootstrap() {
  const database = resolveStoreConfiguration();
  const hosted = hostedMode(database);
  const onPlatform = Boolean(process.env.MASTRA_ENVIRONMENT_ID);
  const store = createStore('support', database);
  const memory = new Memory({
    storage: store,
    options: { lastMessages: 12, semanticRecall: false, workingMemory: { enabled: false }, generateTitle: false },
  });
  const supportKnowledge = Object.assign(createKnowledge(store), {
    openHistoryStorage: historyStorageOpener(store, database),
    withReadSnapshot: createKnowledgeReadSnapshot(store, database),
  });
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
  const { authorize, writerContentionResponse } = createSupportAuthorization(memory, review, reviewerAuthority, hosted);
  const middleware = [
    ...(onPlatform ? [platform?.middleware ?? platformAuthMiddleware()] : []),
    ...(hosted ? [writerContentionResponse] : []),
  ];
  const auth = platform?.createAuth(authorize) ?? createAuth(credentials, authorize, oauth?.authenticateToken);

  return {
    logger: false as const,
    observability,
    storage: store,
    knowledge: { support: supportKnowledge },
    agents: { support },
    workflows: { review },
    server: {
      host: serverHost(hosted, onPlatform),
      port: Number(process.env.PORT ?? 4111),
      auth,
      middleware,
      apiRoutes: [...KNOWLEDGE_ROUTES, createConfirmationRoute(memory)],
    },
  };
}
