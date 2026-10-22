import type { GetAgentResponse, ListAgentVersionsResponse } from '@mastra/client-js';
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
