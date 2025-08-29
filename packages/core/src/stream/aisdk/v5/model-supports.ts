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

const modelSupports: ModelSupport[] = [];
