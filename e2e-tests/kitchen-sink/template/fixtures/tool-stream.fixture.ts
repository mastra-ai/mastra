const toolStream = [
  {
    type: 'stream-start',
    warnings: [],
  },
  {
    type: 'response-metadata',
    id: 'resp_021f0dc3850255630068f6624b1828819e8b2a81289ec48c45',
    timestamp: '2025-10-20T16:24:43.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'tool-input-start',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    toolName: 'weatherInfo',
  },
  {
    type: 'tool-input-delta',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    delta: '{"',
  },
  {
    type: 'tool-input-delta',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    delta: 'location',
  },
  {
    type: 'tool-input-delta',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    delta: '":"',
  },
  {
    type: 'tool-input-delta',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    delta: 'par',
  },
  {
    type: 'tool-input-delta',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    delta: 'is',
  },
  {
    type: 'tool-input-delta',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    delta: '"}',
  },
  {
    type: 'tool-input-end',
    id: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
  },
  {
    type: 'tool-call',
    toolCallId: 'call_rnXxpWJCOHCPvSkAaxiLEAhG',
    toolName: 'weatherInfo',
    input: '{"location":"paris"}',
    providerMetadata: {
      openai: {
        itemId: 'fc_021f0dc3850255630068f6624bb5cc819e9a17221d491b5e75',
      },
    },
  },
  {
    type: 'finish',
    finishReason: 'tool-calls',
    usage: {
      inputTokens: 146,
      outputTokens: 16,
      totalTokens: 162,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_021f0dc3850255630068f6624b1828819e8b2a81289ec48c45',
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
    id: 'resp_0ef3bec8191bd5920068f6624c0a1481938e47cab605520228',
    timestamp: '2025-10-20T16:24:44.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'text-start',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    providerMetadata: {
      openai: {
        itemId: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
      },
    },
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: 'The',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' weather',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' in',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' Paris',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' is',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' sunny',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ',',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' with',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' a',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' temperature',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' of',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' ',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '19',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '°C',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' (',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '66',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '°F',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ').',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' The',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' humidity',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' is',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' at',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' ',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '50',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '%,',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' and',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: " there's",
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' a',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' light',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' wind',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' blowing',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' at',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' ',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '10',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' mph',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '.',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' Perfect',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' weather',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' for',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' a',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' lovely',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' day',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' out',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' or',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' a',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' cozy',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' meal',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' at',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' home',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '!',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' \n\n',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: 'If',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: " you're",
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' thinking',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' about',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' cooking',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' something',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' special',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' today',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ',',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' let',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' me',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' know',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' what',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' ingredients',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' you',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' have',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ',',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' and',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' I',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' can',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' help',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' you',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' with',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' a',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: ' recipe',
  },
  {
    type: 'text-delta',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
    delta: '!',
  },
  {
    type: 'text-end',
    id: 'msg_0ef3bec8191bd5920068f6624cc95881938ad226c643241604',
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: {
      inputTokens: 199,
      outputTokens: 79,
      totalTokens: 278,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_0ef3bec8191bd5920068f6624c0a1481938e47cab605520228',
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
    id: 'resp_0b7a0c4e83cee8330068f6624ecd3081949c245c9ff71f3543',
    timestamp: '2025-10-20T16:24:46.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'text-start',
    id: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
    providerMetadata: {
      openai: {
        itemId: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
      },
    },
  },
  {
    type: 'text-delta',
    id: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
    delta: 'Weather',
  },
  {
    type: 'text-delta',
    id: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
    delta: ' information',
  },
  {
    type: 'text-delta',
    id: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
    delta: ' request',
  },
  {
    type: 'text-delta',
    id: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
    delta: ' for',
  },
  {
    type: 'text-delta',
    id: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
    delta: ' Paris',
  },
  {
    type: 'text-end',
    id: 'msg_0b7a0c4e83cee8330068f6624f636c81949caf621014dc18d4',
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: {
      inputTokens: 103,
      outputTokens: 6,
      totalTokens: 109,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_0b7a0c4e83cee8330068f6624ecd3081949c245c9ff71f3543',
        logprobs: [[], [], [], [], []],
      },
    },
  },
];

export const toolStreamFixture = [toolStream, textDeltaStream, generateTitleStream];
