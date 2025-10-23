// @ts-nocheck
import { WorkflowStreamResult } from '@mastra/core/workflows';

export const workflowResultFixture: WorkflowStreamResult<any, any, any, any> = {
  input: {
    text: 'a',
  },
  status: 'suspended',
  steps: {
    'add-letter': {
      id: 'add-letter',
      payload: {
        text: 'a',
      },
      startedAt: 1760687940402,
      status: 'success',
      output: {
        text: 'aA',
      },
      endedAt: 1760687940410,
    },
    'add-letter-b': {
      id: 'add-letter-b',
      payload: {
        text: 'aA',
      },
      startedAt: 1760687940413,
      status: 'success',
      output: {
        text: 'aAB',
      },
      endedAt: 1760687940418,
    },
    'add-letter-c': {
      id: 'add-letter-c',
      status: 'success',
      output: {
        text: 'aAC',
      },
      endedAt: 1760687940519,
    },
    'mapping_988af47f-b9cc-4570-8d35-7c855d54cb68': {
      id: 'mapping_988af47f-b9cc-4570-8d35-7c855d54cb68',
      payload: {
        'add-letter-b': {
          text: 'aAB',
        },
        'add-letter-c': {
          text: 'aAC',
        },
      },
      startedAt: 1760687940522,
      status: 'success',
      output: {
        text: 'aABaAC',
      },
      endedAt: 1760687940525,
    },
    'short-text': {
      id: 'short-text',
      payload: {
        text: 'aABaAC',
      },
      startedAt: 1760687940532,
      status: 'success',
      output: {
        text: 'aABaACS',
      },
      endedAt: 1760687940534,
    },
    'mapping_80096365-dd95-43c6-8e03-c57065d9d93e': {
      id: 'mapping_80096365-dd95-43c6-8e03-c57065d9d93e',
      payload: {
        'short-text': {
          text: 'aABaACS',
        },
      },
      startedAt: 1760687940538,
      status: 'success',
      output: {
        text: 'aABaACS',
      },
      endedAt: 1760687940539,
    },
    'nested-text-processor': {
      id: 'nested-text-processor',
      payload: {
        text: 'aABaACS',
      },
      startedAt: 1760687940540,
      status: 'success',
      output: {
        text: 'aABaACSAB',
      },
      endedAt: 1760687940548,
    },
    'nested-text-processor.add-letter-clone-nested': {
      id: 'nested-text-processor.add-letter-clone-nested',
      payload: {
        text: 'aABaACS',
      },
      startedAt: 1760687940543,
      status: 'success',
      output: {
        text: 'aABaACSA',
      },
      endedAt: 1760687940544,
    },
    'nested-text-processor.add-letter-b-clone-nested': {
      id: 'nested-text-processor.add-letter-b-clone-nested',
      payload: {
        text: 'aABaACSA',
      },
      startedAt: 1760687940545,
      status: 'success',
      output: {
        text: 'aABaACSAB',
      },
      endedAt: 1760687940547,
    },
    'add-letter-with-count': {
      id: 'add-letter-with-count',
      payload: {
        text: 'aABaACSABDDDDDDDDDD',
        iterationCount: 10,
      },
      startedAt: 1760687940561,
      status: 'success',
      metadata: {
        iterationCount: 11,
      },
      output: {
        text: 'aABaACSABDDDDDDDDDDD',
        iterationCount: 11,
      },
      endedAt: 1760687940561,
    },
    'suspend-resume': {
      id: 'suspend-resume',
      payload: {
        text: 'aABaACSABDDDDDDDDDDD',
        iterationCount: 11,
      },
      startedAt: 1760687940562,
      status: 'suspended',
      suspendPayload: {
        reason: 'Please provide user input to continue',
      },
      suspendedAt: 1760687940562,
    },
  },
  suspendPayload: {
    reason: 'Please provide user input to continue',
  },
  suspended: [['suspend-resume']],
};
