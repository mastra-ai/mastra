const toolStream = [
  {
    type: 'stream-start',
    warnings: [],
  },
  {
    type: 'response-metadata',
    id: 'resp_0ddb9e4833fc14e80068f88c1f603c81a39fca95604011608a',
    timestamp: '2025-10-22T07:47:43.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'tool-input-start',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    toolName: 'workflow-lessComplexWorkflow',
  },
  {
    type: 'tool-input-delta',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    delta: '{"',
  },
  {
    type: 'tool-input-delta',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    delta: 'text',
  },
  {
    type: 'tool-input-delta',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    delta: '":"',
  },
  {
    type: 'tool-input-delta',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    delta: 'tom',
  },
  {
    type: 'tool-input-delta',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    delta: 'ato',
  },
  {
    type: 'tool-input-delta',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    delta: '"}',
  },
  {
    type: 'tool-input-end',
    id: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
  },
  {
    type: 'tool-call',
    toolCallId: 'call_IfDE6cqXEE0xgtrAHVwJ5FSC',
    toolName: 'workflow-lessComplexWorkflow',
    input: '{"text":"tomato"}',
    providerMetadata: {
      openai: {
        itemId: 'fc_0ddb9e4833fc14e80068f88c201ebc81a3bd8ba5d6b741a44a',
      },
    },
  },
  {
    type: 'finish',
    finishReason: 'tool-calls',
    usage: {
      inputTokens: 170,
      outputTokens: 18,
      totalTokens: 188,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_0ddb9e4833fc14e80068f88c1f603c81a39fca95604011608a',
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
    id: 'resp_0abaf4c208af3b550068f88c2493e881a3b46f2f42c10f7d46',
    timestamp: '2025-10-22T07:47:48.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'text-start',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    providerMetadata: {
      openai: {
        itemId: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
      },
    },
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'It',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' looks',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' like',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' the',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' process',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' I',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' ran',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' with',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' "',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'tom',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'ato',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: '"',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' resulted',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' in',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' a',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' playful',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' transformation',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ':',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' **',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: '"',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'tom',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'ato',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'AB',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'tom',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'ato',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'AC',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'LAB',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'D',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: '-',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'ENDED',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: '"',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: '**',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: '.',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' \n\n',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: 'If',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: " you're",
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' looking',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' for',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' recipes',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' or',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' ideas',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' using',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' tomatoes',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ',',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' let',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' me',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' know',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' what',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' other',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' ingredients',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' you',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' have',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ',',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' and',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' I',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' can',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' help',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' you',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' whip',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' up',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' something',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: ' delicious',
  },
  {
    type: 'text-delta',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
    delta: '!',
  },
  {
    type: 'text-end',
    id: 'msg_0abaf4c208af3b550068f88c250ef081a391b20ae89ed37407',
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: {
      inputTokens: 806,
      outputTokens: 65,
      totalTokens: 871,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_0abaf4c208af3b550068f88c2493e881a3b46f2f42c10f7d46',
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
    id: 'resp_0279e90eb449c1fa0068f88c26f13c819da3fa2e092940091f',
    timestamp: '2025-10-22T07:47:50.000Z',
    modelId: 'gpt-4o-mini-2024-07-18',
  },
  {
    type: 'text-start',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    providerMetadata: {
      openai: {
        itemId: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
      },
    },
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: 'Calling',
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: ' less',
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: 'Complex',
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: 'Workflow',
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: ' tool',
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: ' with',
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: ' tomato',
  },
  {
    type: 'text-delta',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
    delta: ' input',
  },
  {
    type: 'text-end',
    id: 'msg_0279e90eb449c1fa0068f88c2763e8819dbe1e16af55534201',
  },
  {
    type: 'finish',
    finishReason: 'stop',
    usage: {
      inputTokens: 102,
      outputTokens: 9,
      totalTokens: 111,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    providerMetadata: {
      openai: {
        responseId: 'resp_0279e90eb449c1fa0068f88c26f13c819da3fa2e092940091f',
        logprobs: [[], [], [], [], [], [], [], []],
      },
    },
  },
];

export const workflowStreamFixture = [toolStream, textDeltaStream, generateTitleStream];
