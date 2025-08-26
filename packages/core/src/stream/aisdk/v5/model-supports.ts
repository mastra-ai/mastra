type SupportLevel = 'full' | 'partial' | 'none';

interface ResponseFormatCapability {
  support: SupportLevel;
  jsonMode: boolean;
  jsonSchema: boolean;
  notes: string;
}

interface ToolCallsCapability {
  support: SupportLevel;
  structured: boolean;
  notes: string;
}

interface ModelCapabilities {
  responseFormat: ResponseFormatCapability;
  toolCalls: ToolCallsCapability;
  reasoning: boolean;
}

interface ModelSupport {
  modelId: string;
  provider: string; // AI SDK provider function name (openai, anthropic, google, openrouter)
  capabilities: ModelCapabilities;
}

export function getModelSupport(modelId: string, provider: string): ModelSupport | undefined {
  return modelSupports.find(m => m.modelId === modelId && m.provider === provider);
}

const openaiModels: ModelSupport[] = [
  {
    modelId: 'gpt-5',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gpt-4.1',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-4o',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-4',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-3.5-turbo',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'o1',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: "Reasoning models don't support responseFormat",
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: "o1 reasoning models don't support function calling",
      },
      reasoning: true,
    },
  },
  {
    modelId: 'o1-mini',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: "Reasoning models don't support responseFormat",
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: "o1 reasoning models don't support function calling",
      },
      reasoning: true,
    },
  },
  {
    modelId: 'o1-preview',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: "Reasoning models don't support responseFormat",
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: "o1 reasoning models don't support function calling",
      },
      reasoning: true,
    },
  },
  {
    modelId: 'o3',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'o3 reasoning model supports structured outputs',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'o3 reasoning model supports function calling',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'o3-mini',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'o3 reasoning model supports structured outputs',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'o3 reasoning model supports function calling',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'o4-mini',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'dall-e-3',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'dall-e-2',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'whisper',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'tts-1',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'tts-1-hd',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'text-embedding-3-large',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'text-embedding-3-small',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'text-embedding-ada-002',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'davinci-002',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'babbage-002',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'none',
        jsonMode: false,
        jsonSchema: false,
        notes: 'No native responseFormat support',
      },
      toolCalls: {
        support: 'none',
        structured: false,
        notes: 'No tool calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-4o-mini',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-4o-realtime-preview',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-4o-audio-preview',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'chatgpt-4o-latest',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-4-turbo',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
  {
    modelId: 'gpt-4-vision-preview',
    provider: 'openai.responses',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for responseFormat with json_schema',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: false,
    },
  },
];

const googleModels: ModelSupport[] = [
  {
    modelId: 'gemini-2.5-pro',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-flash',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-flash-lite',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-flash-preview-native-audio-dialog',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-flash-exp-native-audio-thinking-dialog',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-flash-preview-tts',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-pro-preview-tts',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash-preview-image-generation',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash-lite',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash-live',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-1.5-flash',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-1.5-flash',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-1.5-pro',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-flash-preview',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-flash-lite',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash-exp',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash-lite',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-1.5-flash-latest',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-1.5-pro-latest',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-1.5-pro',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.5-pro-preview',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-pro-exp',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash-exp-image-generation',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-2.0-flash-thinking-exp',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
  {
    modelId: 'gemini-1.5-pro-exp',
    provider: 'google',
    capabilities: {
      responseFormat: {
        support: 'full',
        jsonMode: true,
        jsonSchema: true,
        notes: 'Full support for structured outputs via response_mime_type',
      },
      toolCalls: {
        support: 'full',
        structured: true,
        notes: 'Full function calling support',
      },
      reasoning: true,
    },
  },
];

const modelSupports: ModelSupport[] = [...openaiModels, ...googleModels];
