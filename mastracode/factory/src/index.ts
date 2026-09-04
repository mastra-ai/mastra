export { MastraFactory } from './factory.js';
export type { MastraArgs, MastraFactoryConfig, MastraFactorySandboxConfig, FactorySandboxStart } from './factory.js';
export type { FactorySandboxContext, SessionSetupGate, SessionSetupRun } from './sandbox/session-sandbox.js';
export { ChannelIdentityStorage } from './storage/domains/channel-identity/base.js';
export type {
  ChannelAccountLink,
  ChannelAccountLinkEntry,
  ChannelAccountLinkKey,
  ChannelAccountLinkNames,
} from './storage/domains/channel-identity/base.js';
export { FactoryProjectsStorage } from './storage/domains/projects/base.js';
export type { FactoryProject } from './storage/domains/projects/base.js';
export { WorkItemsStorage } from './storage/domains/work-items/base.js';
export type { CreateWorkItemInput, WorkItemRow } from './storage/domains/work-items/base.js';
export { createStateSigner } from './state-signing.js';
export type { StateSigner, StateTenant } from './state-signing.js';
export { createFactorySecretEncryption, createPlaintextFactorySecretEncryption } from './secret-encryption.js';
export type {
  DecryptedFactorySecret,
  FactorySecretEncryption,
  FactorySecretEncryptionConfig,
  FactorySecretEncryptionKey,
} from './secret-encryption.js';
export { createFactoryRouteAuth } from './auth.js';
export type { RouteAuth } from './routes/route.js';
// The integration seam, so a host can implement `FactoryIntegration` from
// outside this package — the contract's stated design for third parties.
// Built-ins (GitHub, Linear, Slack) implement the same interface from inside.
export type {
  FactoryIntegration,
  IntegrationContext,
  IntegrationHooks,
  IntegrationTools,
} from './integrations/base.js';
