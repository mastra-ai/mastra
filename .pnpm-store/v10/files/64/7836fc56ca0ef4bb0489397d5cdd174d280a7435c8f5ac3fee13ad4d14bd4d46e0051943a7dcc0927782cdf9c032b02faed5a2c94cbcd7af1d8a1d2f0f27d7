"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  createXai: () => createXai,
  xai: () => xai
});
module.exports = __toCommonJS(src_exports);

// src/xai-provider.ts
var import_provider = require("@ai-sdk/provider");
var import_openai_compatible = require("@ai-sdk/openai-compatible");
var import_provider_utils = require("@ai-sdk/provider-utils");

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
var import_zod = require("zod");
var xaiErrorSchema = import_zod.z.object({
  code: import_zod.z.string(),
  error: import_zod.z.string()
});

// src/xai-provider.ts
var xaiErrorStructure = {
  errorSchema: xaiErrorSchema,
  errorToMessage: (data) => data.error
};
function createXai(options = {}) {
  var _a;
  const baseURL = (0, import_provider_utils.withoutTrailingSlash)(
    (_a = options.baseURL) != null ? _a : "https://api.x.ai/v1"
  );
  const getHeaders = () => ({
    Authorization: `Bearer ${(0, import_provider_utils.loadApiKey)({
      apiKey: options.apiKey,
      environmentVariableName: "XAI_API_KEY",
      description: "xAI API key"
    })}`,
    ...options.headers
  });
  const createLanguageModel = (modelId, settings = {}) => {
    const structuredOutputs = supportsStructuredOutputs(modelId);
    return new import_openai_compatible.OpenAICompatibleChatLanguageModel(modelId, settings, {
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
    return new import_openai_compatible.OpenAICompatibleImageModel(modelId, settings, {
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
    throw new import_provider.NoSuchModelError({ modelId, modelType: "textEmbeddingModel" });
  };
  provider.imageModel = createImageModel;
  provider.image = createImageModel;
  return provider;
}
var xai = createXai();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createXai,
  xai
});
//# sourceMappingURL=index.js.map