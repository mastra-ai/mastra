type TextPayload = { text: string };
type TextOutput = { text: string };
type TextWithCountPayload = { text: string; iterationCount: number };
type TextWithCountOutput = { text: string; iterationCount: number };
type MappingPayload = Record<string, { text: string }>;
type SuspendPayload = { reason: string };
type StepMetadata = { iterationCount?: number };

type StepSuccessResult<P, T> = {
  status: 'success';
  output: T;
  payload: P;
  startedAt: number;
  endedAt: number;
  metadata?: StepMetadata;
};

type StepSuspendedResult<P> = {
  status: 'suspended';
  payload: P;
  suspendPayload: SuspendPayload;
  startedAt: number;
  suspendedAt: number;
};

interface WorkflowResultFixture {
  input: TextPayload;
  status: 'suspended';
  steps: {
    'add-letter': StepSuccessResult<TextPayload, TextOutput>;
    'add-letter-b': StepSuccessResult<TextPayload, TextOutput>;
    'add-letter-c': StepSuccessResult<TextPayload, TextOutput>;
    'mapping_988af47f-b9cc-4570-8d35-7c855d54cb68': StepSuccessResult<MappingPayload, TextOutput>;
    'short-text': StepSuccessResult<TextPayload, TextOutput>;
    'mapping_80096365-dd95-43c6-8e03-c57065d9d93e': StepSuccessResult<MappingPayload, TextOutput>;
    'nested-text-processor': StepSuccessResult<TextPayload, TextOutput>;
    'nested-text-processor.add-letter-clone-nested': StepSuccessResult<TextPayload, TextOutput>;
    'nested-text-processor.add-letter-b-clone-nested': StepSuccessResult<TextPayload, TextOutput>;
    'add-letter-with-count': StepSuccessResult<TextWithCountPayload, TextWithCountOutput>;
    'suspend-resume': StepSuspendedResult<TextWithCountPayload>;
  };
  suspendPayload: SuspendPayload;
  suspended: [string[], ...string[][]];
}

export const workflowResultFixture: WorkflowResultFixture = {
  input: {
    text: 'a',
  },
  status: 'suspended',
  steps: {
    'add-letter': {
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
      payload: {
        text: 'aAC',
      },
      startedAt: 1760687940515,
      status: 'success',
      output: {
        text: 'aAC',
      },
      endedAt: 1760687940519,
    },
    'mapping_988af47f-b9cc-4570-8d35-7c855d54cb68': {
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
