import type { GetAgentResponse, GetProcessorResponse, GetScorerResponse, GetWorkflowResponse } from '@mastra/client-js';

/** Registry responses served by MSW when a test needs experiment targets resolved to names. */

export const agent = (id: string, name: string): GetAgentResponse => ({
  id,
  name,
  instructions: '',
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
});

export const workflow = (name: string): GetWorkflowResponse => ({
  name,
  steps: {},
  allSteps: {},
  stepGraph: [],
  inputSchema: '',
  outputSchema: '',
  stateSchema: '',
});

/** `scorer` is a class instance on the wire, so only the serialized shape the UI reads is modelled. */
export const scorer = (id: string, name: string): GetScorerResponse =>
  ({
    scorer: { config: { id, name, description: `${name} description` } },
    source: 'code',
    isRegistered: true,
    agentIds: [],
    agentNames: [],
    workflowIds: [],
  }) as unknown as GetScorerResponse;

export const processor = (id: string, name: string): GetProcessorResponse => ({
  id,
  name,
  phases: ['input'],
  agentIds: [],
  isWorkflow: false,
});

export const agents: Record<string, GetAgentResponse> = { 'agent-1': agent('agent-1', 'Support Agent') };
export const workflows: Record<string, GetWorkflowResponse> = { 'wf-1': workflow('Triage Workflow') };
export const scorers: Record<string, GetScorerResponse> = { 'sc-1': scorer('sc-1', 'Relevancy') };
export const processors: Record<string, GetProcessorResponse> = { 'proc-1': processor('proc-1', 'PII Redactor') };

export const noAgents: Record<string, GetAgentResponse> = {};
export const noWorkflows: Record<string, GetWorkflowResponse> = {};
export const noScorers: Record<string, GetScorerResponse> = {};
export const noProcessors: Record<string, GetProcessorResponse> = {};
