import { readAgentConfig, readIntegrationConfig, hasEnabledIntegration } from '../env.js';
import { createRuntimeMastra } from './runtime.js';

const integrationConfig = readIntegrationConfig();
export const mastra = createRuntimeMastra(readAgentConfig(), {
  // Real integrations enter through signed Hono webhooks. Studio shares the
  // persisted runs and traces, while pasted fixtures remain local-only.
  allowWebhookInput: integrationConfig.mode === 'local' && !hasEnabledIntegration(integrationConfig),
  integrationConfig,
});

export { storage, createDomainEventPubSub } from './runtime.js';
