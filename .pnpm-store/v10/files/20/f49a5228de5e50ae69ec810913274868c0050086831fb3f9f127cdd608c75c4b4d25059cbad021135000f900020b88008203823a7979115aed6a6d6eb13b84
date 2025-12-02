// src/xai-provider.ts
import {
  NoSuchModelError
} from "@ai-sdk/provider";
import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleImageModel
} from "@ai-sdk/openai-compatible";
import {
  loadApiKey,
  withoutTrailingSlash
} from "@ai-sdk/provider-utils";

// src/xai-chat-settings.ts
function supportsStructuredOutputs(modelId) {
  return [
    "grok-3",
    "grok-3-beta",
    "grok-3-latest",
    "grok-3-fast",
    "grok-3-fast-beta",
    "grok-3-fast-latest",
    "grok-3-mini",
    "grok-3-mini-beta",
    "grok-3-mini-latest",
    "grok-3-mini-fast",
    "grok-3-mini-fast-beta",
    "grok-3-mini-fast-latest",
    "grok-2-1212",
    "grok-2-vision-1212"
  ].includes(modelId);
}

// src/xai-error.ts
import { z } from "zod";
var xaiErrorSchema = z.object({
  code: z.string(),
  error: z.string()
});

// src/xai-provider.ts
var xaiErrorStructure = {
  errorSchema: xaiErrorSchema,
  errorToMessage: (data) => data.error
};
function createXai(options = {}) {
  var _a;
  const baseURL = withoutTrailingSlash(
    (_a = options.baseURL) != null ? _a : "https://api.x.ai/v1"
  );
  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: "XAI_API_KEY",
      description: "xAI API key"
    })}`,
    ...options.headers
  });
  const createLanguageModel = (modelId, settings = {}) => {
    const structuredOutputs = supportsStructuredOutputs(modelId);
    return new OpenAICompatibleChatLanguageModel(modelId, settings, {
      provider: "xai.chat",
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      defaultObjectGenerationMode: structuredOutputs ? "json" : "tool",
      errorStructure: xaiErrorStructure,
      supportsStructuredOutputs: structuredOutputs,
      includeUsage: true
    });
  };
  const createImageModel = (modelId, settings = {}) => {
    return new OpenAICompatibleImageModel(modelId, settings, {
      provider: "xai.image",
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      errorStructure: xaiErrorStructure
    });
  };
  const provider = (modelId, settings) => createLanguageModel(modelId, settings);
  provider.languageModel = createLanguageModel;
  provider.chat = createLanguageModel;
  provider.textEmbeddingModel = (modelId) => {
    throw new NoSuchModelError({ modelId, modelType: "textEmbeddingModel" });
  };
  provider.imageModel = createImageModel;
  provider.image = createImageModel;
  return provider;
}
var xai = createXai();
export {
  createXai,
  xai
};
//# sourceMappingURL=index.mjs.map