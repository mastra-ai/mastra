export { TeamsProvider, resolveTeamsAdapterConfig } from './teams-provider';
export { TeamsInstallStore, toInstallationInfo, PLATFORM } from './install-store';
export {
  addApplicationPassword,
  createApplication,
  createBotRegistration,
  deleteApplication,
  deleteBotRegistration,
  validateBotCredentials,
} from './microsoft-clients';
export type { EntraApplication, TeamsBotRegistration } from './microsoft-clients';
export {
  DEV_PORTAL_BASE_URL,
  DEV_PORTAL_BOTS_URL,
  GRAPH_API_BASE_URL,
  LOGIN_BASE_URL,
  TEAMS_DEV_PORTAL_SCOPE,
  TEAMS_GRAPH_SCOPE,
} from './types';
export type {
  TeamsConnectOptions,
  TeamsCredentialsConfig,
  TeamsDelegatedCredentialsConfig,
  TeamsInstallation,
  TeamsProviderConfig,
  TeamsProviderConfigBase,
  TeamsSelfManagedCredentialsConfig,
  TeamsTokenResolver,
} from './types';

// Re-export the underlying adapter for convenience (parity with @mastra/slack).
export { createTeamsAdapter, TeamsAdapter } from '@chat-adapter/teams';
