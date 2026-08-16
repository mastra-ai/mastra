import type { GetScoresScorers_Response } from '@mastra/client-js';

export const itemScorers: GetScoresScorers_Response = {
  quality: {
    scorer: {
      config: {
        id: 'quality',
        name: 'Quality scorer',
        description: 'Measures response quality',
      },
    },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'code',
  },
  'stored-judge': {
    scorer: {
      config: {
        id: 'stored-judge',
        name: 'Stored judge',
        description: 'A stored scorer hydrated by the Editor',
      },
    },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'stored',
  },
  unavailable: {
    scorer: {
      config: {
        id: 'unavailable',
        name: 'Unavailable scorer',
      },
    },
    agentIds: ['agent-1'],
    agentNames: ['Agent 1'],
    workflowIds: [],
    isRegistered: false,
    source: 'code',
  },
};
