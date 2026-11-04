import type {
  GetAgentResponse,
  ListAgentVersionsResponse,
  SerializedRouteResponse,
  GetAgentBrowserSessionResponse,
  GetSystemPackagesResponse,
} from '@mastra/client-js';
import type { AgentEditorConfig } from '@mastra/core/agent';

export const AGENT_ID = 'fs-agent';

/** `GET /agents/:id` for an agent discovered from an `agents/<name>/` folder. */
export const makeFsAgent = (editor: AgentEditorConfig | undefined): GetAgentResponse => ({
  id: AGENT_ID,
  name: 'FS Agent',
  instructions: 'File-based instructions.',
  tools: {},
  workflows: {},
  agents: {},
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  modelVersion: 'v2',
  modelList: undefined,
  defaultOptions: {},
  defaultGenerateOptionsLegacy: {},
  defaultStreamOptionsLegacy: {},
  skills: [],
  workspaceTools: [],
  browserTools: [],
  hasBrowser: false,
  inputProcessors: [],
  outputProcessors: [],
  source: 'fs',
  status: 'published',
  hasDraft: false,
  editor,
});

/** No Studio override has been saved for the file-based agent yet. */
export const noVersions: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 0,
  perPage: 20,
  hasMore: false,
};

export const memoryStatus: SerializedRouteResponse<'GET /memory/status'> = { result: false };
export const memoryConfig: SerializedRouteResponse<'GET /memory/config'> = { config: {} };
export const makeSystemPackages = (editorSource: 'code' | 'db'): GetSystemPackagesResponse => ({
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
  liveKitConnectionRouteEnabled: false,
  editorSource,
});
export const builderSettings: SerializedRouteResponse<'GET /editor/builder/settings'> = { enabled: false };
export const availableModels: SerializedRouteResponse<'GET /editor/builder/models/available'> = { providers: [] };
export const agentProviders: SerializedRouteResponse<'GET /agents/providers'> = { providers: [] };
export const voiceSpeakers: SerializedRouteResponse<'GET /agents/:agentId/voice/speakers'> = [];
export const browserSession: GetAgentBrowserSessionResponse = { hasSession: false, screencastAvailable: false };
export const authCapabilities: SerializedRouteResponse<'GET /auth/capabilities'> = { enabled: false, login: null };
export const threadSubscription = {
  ok: true,
} satisfies SerializedRouteResponse<'POST /agents/:agentId/threads/subscribe'>;
export const availableTools: SerializedRouteResponse<'GET /tools'> = {};
export const datasets: SerializedRouteResponse<'GET /datasets'> = {
  datasets: [],
  pagination: { total: 0, page: 1, perPage: 50, hasMore: false },
};
export const channelPlatforms: SerializedRouteResponse<'GET /channels/platforms'> = [];
