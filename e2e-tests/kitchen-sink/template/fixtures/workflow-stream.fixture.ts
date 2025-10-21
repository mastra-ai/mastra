const toolStream = [
  {
    type: 'stream-start',
    warnings: [],
  },
  {
    type: 'response-metadata',
    id: 'resp_02cdc37bc147eb8f0068f799b068b481a18a0e5e4c951db05d',
    timestamp: '2025-10-21T14:33:20.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'tool-input-start',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    toolName: 'lessComplexWorkflow',
  },
  {
    type: 'tool-input-delta',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    delta: '{"',
  },
  {
    type: 'tool-input-delta',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    delta: 'text',
  },
  {
    type: 'tool-input-delta',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    delta: '":"',
  },
  {
    type: 'tool-input-delta',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    delta: 'AB',
  },
  {
    type: 'tool-input-delta',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    delta: 'CD',
  },
  {
    type: 'tool-input-delta',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    delta: '"}',
  },
  {
    type: 'tool-input-end',
    id: 'call_HQfHdjNNKDd1twaNhJm79IfB',
  },
  {
    type: 'tool-call',
    toolCallId: 'call_HQfHdjNNKDd1twaNhJm79IfB',
    toolName: 'lessComplexWorkflow',
    input: '{"text":"ABCD"}',
    providerMetadata: {
      openai: {
        itemId: 'fc_02cdc37bc147eb8f0068f799b108a081a18581e3eb663e0bb7',
      },
    },
  },
  {
    type: 'finish',
    finishReason: 'tool-calls',
    usage: {
      inputTokens: 148,
      outputTokens: 17,
      totalTokens: 165,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_02cdc37bc147eb8f0068f799b068b481a18a0e5e4c951db05d',
      },
    },
  },
];

const textDeltaStream = [
  {
    type: 'stream-start',
    warnings: [],
  },
  {
    type: 'response-metadata',
    id: 'resp_01c2328acc7ea3b20068f799bc843881a2b3dc525d993447be',
    timestamp: '2025-10-21T14:33:32.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'text-start',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    providerMetadata: {
      openai: {
        itemId: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
      },
    },
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'The',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' process',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' with',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' the',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' input',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' "',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'AB',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'CD',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: '"',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' has',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' been',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' completed',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' successfully',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: '.',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' The',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' final',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' output',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' is',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ':\n\n',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: '**',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'AB',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'CD',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'AB',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'AB',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'CD',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'AC',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'LAB',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'DD',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'DDD',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'END',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: '-',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'ENDED',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: '**\n\n',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: 'If',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' you',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' have',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' any',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' questions',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' or',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' need',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' further',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' assistance',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ',',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' feel',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' free',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' to',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: ' ask',
  },
  {
    type: 'text-delta',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
    delta: '!',
  },
  {
    type: 'text-end',
    id: 'msg_01c2328acc7ea3b20068f799bce59881a2b0b11ff386b400c0',
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: {
      inputTokens: 867,
      outputTokens: 50,
      totalTokens: 917,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_01c2328acc7ea3b20068f799bc843881a2b3dc525d993447be',
        logprobs: [
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
        ],
      },
    },
  },
];

const generateTitleStream = [
  {
    type: 'stream-start',
    warnings: [],
  },
  {
    type: 'response-metadata',
    id: 'resp_09165ff0310e92130068f799bea3b48194a0c38ca8ec4c1bdd',
    timestamp: '2025-10-21T14:33:34.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'text-start',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    providerMetadata: {
      openai: {
        itemId: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
      },
    },
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: 'Calling',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: ' less',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: '-com',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: 'plex',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: '-work',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: 'flow',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: ' tool',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: ' with',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: ' ABC',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: 'D',
  },
  {
    type: 'text-delta',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
    delta: ' input',
  },
  {
    type: 'text-end',
    id: 'msg_09165ff0310e92130068f799c211f48194a96f3014dc7cf4d9',
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: {
      inputTokens: 106,
      outputTokens: 12,
      totalTokens: 118,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_09165ff0310e92130068f799bea3b48194a0c38ca8ec4c1bdd',
        logprobs: [[], [], [], [], [], [], [], [], [], [], []],
      },
    },
  },
];

export const workflowStreamFixture = [toolStream, textDeltaStream, generateTitleStream];
