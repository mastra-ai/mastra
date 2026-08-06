import type { BuilderSettingsResponse, GetAgentResponse } from '@mastra/client-js';

export const agentsList: Record<string, GetAgentResponse> = {
  researcher: {
    id: 'researcher',
    name: 'Research Agent',
    instructions: 'Find reliable sources and summarize the evidence.',
    tools: {
      search: {
        id: 'search',
        description: 'Search the web',
        inputSchema: '{}',
        outputSchema: '{}',
      },
    },
    workflows: {},
    agents: {},
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    modelVersion: 'v2',
    modelList: undefined,
    defaultOptions: {},
    defaultGenerateOptionsLegacy: {},
    defaultStreamOptionsLegacy: {},
  },
  analyst: {
    id: 'analyst',
    name: 'Analysis Agent',
    instructions: 'Review the available evidence and explain the key tradeoffs.',
    tools: {},
    workflows: {},
    agents: {},
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    modelVersion: 'v2',
    modelList: undefined,
    defaultOptions: {},
    defaultGenerateOptionsLegacy: {},
    defaultStreamOptionsLegacy: {},
  },
};

export const agentsListWithWorkflow: Record<string, GetAgentResponse> = {
  researcher: {
    ...agentsList.researcher,
    workflows: {
      research: {
        name: 'Research workflow',
        steps: {},
        allSteps: {},
        stepGraph: [],
        inputSchema: '{}',
        outputSchema: '{}',
        stateSchema: '{}',
      },
      summarize: {
        name: 'Summary workflow',
        description: 'Summarize the collected research',
        steps: {},
        allSteps: {},
        stepGraph: [],
        inputSchema: '{}',
        outputSchema: '{}',
        stateSchema: '{}',
      },
    },
  },
};

export const agentsListWithSubagent: Record<string, GetAgentResponse> = {
  researcher: {
    ...agentsList.researcher,
    agents: {
      analyst: {
        id: 'analyst',
        name: 'Analysis Agent',
      },
    },
  },
};
export const builderDisabled = {
  enabled: false,
} satisfies BuilderSettingsResponse;

export const longAgentInstructions =
  'Investigate every available source and reconcile contradictory evidence before writing the final research summary.';

export const agentsListWithLongInstructions: Record<string, GetAgentResponse> = {
  researcher: {
    ...agentsList.researcher,
    instructions: longAgentInstructions,
  },
};

export const unicodeBoundaryInstructions = `${'a'.repeat(79)}👩‍💻tail`;

export const agentsListWithUnicodeBoundaryInstructions: Record<string, GetAgentResponse> = {
  researcher: {
    ...agentsList.researcher,
    instructions: unicodeBoundaryInstructions,
  },
};

export const agentsListWithoutInstructions: Record<string, GetAgentResponse> = {
  researcher: {
    ...agentsList.researcher,
    instructions: '',
  },
};

export const agentsListWithoutConfiguration: Record<string, GetAgentResponse> = {
  researcher: {
    ...agentsList.researcher,
    instructions: '',
    tools: {},
    provider: undefined,
    modelId: undefined,
  },
};

export const longAgentName =
  'Agent with an intentionally long descriptive name that should stay within its compact card';

export const agentsListWithLongName: Record<string, GetAgentResponse> = {
  researcher: {
    ...agentsList.researcher,
    name: longAgentName,
  },
};
