import type {
  ListWorkflowRunsResponse,
  ListWorkflowRunCountsResponse,
  ListStoredAgentsResponse,
  GetSystemPackagesResponse,
  RouteResponse,
  ListLogsResponse,
  GetProcessorDetailResponse,
  ExecuteProcessorResponse,
} from '@mastra/client-js';

export const noTools: RouteResponse<'GET /tools'> = {};
export const noProcessors: RouteResponse<'GET /processors'> = {};
export const noScorers: RouteResponse<'GET /scores/scorers'> = {};
export const noWorkflowRuns: ListWorkflowRunsResponse = { runs: [], total: 0 };
export const noWorkflowRunCounts: ListWorkflowRunCountsResponse = {};
export const noStoredAgents: ListStoredAgentsResponse = { agents: [], total: 0, page: 0, perPage: 50, hasMore: false };
export const packagesWithPromptEditing: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: true,
  observabilityEnabled: false,
};

export const availableTools: RouteResponse<'GET /tools'> = {
  weather: {
    id: 'weather',
    description: 'Get weather for a city',
    inputSchema: JSON.stringify({ json: { type: 'object', properties: { city: { type: 'string' } } } }),
    outputSchema: JSON.stringify({ json: { type: 'object' } }),
  },
};

export const availableProcessors: RouteResponse<'GET /processors'> = {
  redactor: {
    id: 'redactor',
    name: 'PII redactor',
    phases: ['input'],
    agentIds: [],
    configurations: [],
    isWorkflow: false,
  },
};

export const availableScorers: RouteResponse<'GET /scores/scorers'> = {
  quality: {
    scorer: { config: { id: 'quality', description: 'Measures response quality' } },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'code',
  },
};

export const redactorDetail: GetProcessorDetailResponse = {
  id: 'redactor',
  name: 'PII redactor',
  phases: ['input', 'outputStep', 'outputStream', 'llmRequest'],
  configurations: [
    { agentId: 'research-agent', agentName: 'Research Agent', type: 'input' },
    { agentId: 'support-agent', agentName: 'Support Agent', type: 'output' },
  ],
  isWorkflow: false,
};
export const processorSuccess: ExecuteProcessorResponse = { success: true, phase: 'input' };
export const processorTripwire: ExecuteProcessorResponse = {
  success: false,
  phase: 'input',
  tripwire: { triggered: true, reason: 'Private data detected' },
};

export const noLogs: ListLogsResponse = { logs: [], pagination: { total: 0, page: 0, perPage: 50, hasMore: false } };
