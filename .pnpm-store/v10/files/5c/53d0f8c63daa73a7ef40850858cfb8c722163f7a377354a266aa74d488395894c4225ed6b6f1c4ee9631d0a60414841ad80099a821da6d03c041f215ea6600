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
  createGoogleGenerativeAI: () => createGoogleGenerativeAI,
  google: () => google
});
module.exports = __toCommonJS(src_exports);

// src/google-provider.ts
var import_provider_utils9 = require("@ai-sdk/provider-utils");

// src/google-generative-ai-embedding-model.ts
var import_provider = require("@ai-sdk/provider");
var import_provider_utils2 = require("@ai-sdk/provider-utils");
var import_v43 = require("zod/v4");

// src/google-error.ts
var import_provider_utils = require("@ai-sdk/provider-utils");
var import_v4 = require("zod/v4");
var googleErrorDataSchema = import_v4.z.object({
  error: import_v4.z.object({
    code: import_v4.z.number().nullable(),
    message: import_v4.z.string(),
    status: import_v4.z.string()
  })
});
var googleFailedResponseHandler = (0, import_provider_utils.createJsonErrorResponseHandler)({
  errorSchema: googleErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/google-generative-ai-embedding-options.ts
var import_v42 = require("zod/v4");
var googleGenerativeAIEmbeddingProviderOptions = import_v42.z.object({
  /**
   * Optional. Optional reduced dimension for the output embedding.
   * If set, excessive values in the output embedding are truncated from the end.
   */
  outputDimensionality: import_v42.z.number().optional(),
  /**
   * Optional. Specifies the task type for generating embeddings.
   * Supported task types:
   * - SEMANTIC_SIMILARITY: Optimized for text similarity.
   * - CLASSIFICATION: Optimized for text classification.
   * - CLUSTERING: Optimized for clustering texts based on similarity.
   * - RETRIEVAL_DOCUMENT: Optimized for document retrieval.
   * - RETRIEVAL_QUERY: Optimized for query-based retrieval.
   * - QUESTION_ANSWERING: Optimized for answering questions.
   * - FACT_VERIFICATION: Optimized for verifying factual information.
   * - CODE_RETRIEVAL_QUERY: Optimized for retrieving code blocks based on natural language queries.
   */
  taskType: import_v42.z.enum([
    "SEMANTIC_SIMILARITY",
    "CLASSIFICATION",
    "CLUSTERING",
    "RETRIEVAL_DOCUMENT",
    "RETRIEVAL_QUERY",
    "QUESTION_ANSWERING",
    "FACT_VERIFICATION",
    "CODE_RETRIEVAL_QUERY"
  ]).optional()
});

// src/google-generative-ai-embedding-model.ts
var GoogleGenerativeAIEmbeddingModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    this.maxEmbeddingsPerCall = 2048;
    this.supportsParallelCalls = true;
    this.modelId = modelId;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions
  }) {
    const googleOptions = await (0, import_provider_utils2.parseProviderOptions)({
      provider: "google",
      providerOptions,
      schema: googleGenerativeAIEmbeddingProviderOptions
    });
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new import_provider.TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      });
    }
    const mergedHeaders = (0, import_provider_utils2.combineHeaders)(
      await (0, import_provider_utils2.resolve)(this.config.headers),
      headers
    );
    if (values.length === 1) {
      const {
        responseHeaders: responseHeaders2,
        value: response2,
        rawValue: rawValue2
      } = await (0, import_provider_utils2.postJsonToApi)({
        url: `${this.config.baseURL}/models/${this.modelId}:embedContent`,
        headers: mergedHeaders,
        body: {
          model: `models/${this.modelId}`,
          content: {
            parts: [{ text: values[0] }]
          },
          outputDimensionality: googleOptions == null ? void 0 : googleOptions.outputDimensionality,
          taskType: googleOptions == null ? void 0 : googleOptions.taskType
        },
        failedResponseHandler: googleFailedResponseHandler,
        successfulResponseHandler: (0, import_provider_utils2.createJsonResponseHandler)(
          googleGenerativeAISingleEmbeddingResponseSchema
        ),
        abortSignal,
        fetch: this.config.fetch
      });
      return {
        embeddings: [response2.embedding.values],
        usage: void 0,
        response: { headers: responseHeaders2, body: rawValue2 }
      };
    }
    const {
      responseHeaders,
      value: response,
      rawValue
    } = await (0, import_provider_utils2.postJsonToApi)({
      url: `${this.config.baseURL}/models/${this.modelId}:batchEmbedContents`,
      headers: mergedHeaders,
      body: {
        requests: values.map((value) => ({
          model: `models/${this.modelId}`,
          content: { role: "user", parts: [{ text: value }] },
          outputDimensionality: googleOptions == null ? void 0 : googleOptions.outputDimensionality,
          taskType: googleOptions == null ? void 0 : googleOptions.taskType
        }))
      },
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils2.createJsonResponseHandler)(
        googleGenerativeAITextEmbeddingResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      embeddings: response.embeddings.map((item) => item.values),
      usage: void 0,
      response: { headers: responseHeaders, body: rawValue }
    };
  }
};
var googleGenerativeAITextEmbeddingResponseSchema = import_v43.z.object({
  embeddings: import_v43.z.array(import_v43.z.object({ values: import_v43.z.array(import_v43.z.number()) }))
});
var googleGenerativeAISingleEmbeddingResponseSchema = import_v43.z.object({
  embedding: import_v43.z.object({ values: import_v43.z.array(import_v43.z.number()) })
});

// src/google-generative-ai-language-model.ts
var import_provider_utils6 = require("@ai-sdk/provider-utils");
var import_v47 = require("zod/v4");

// src/convert-json-schema-to-openapi-schema.ts
function convertJSONSchemaToOpenAPISchema(jsonSchema) {
  if (jsonSchema == null || isEmptyObjectSchema(jsonSchema)) {
    return void 0;
  }
  if (typeof jsonSchema === "boolean") {
    return { type: "boolean", properties: {} };
  }
  const {
    type,
    description,
    required,
    properties,
    items,
    allOf,
    anyOf,
    oneOf,
    format,
    const: constValue,
    minLength,
    enum: enumValues
  } = jsonSchema;
  const result = {};
  if (description)
    result.description = description;
  if (required)
    result.required = required;
  if (format)
    result.format = format;
  if (constValue !== void 0) {
    result.enum = [constValue];
  }
  if (type) {
    if (Array.isArray(type)) {
      if (type.includes("null")) {
        result.type = type.filter((t) => t !== "null")[0];
        result.nullable = true;
      } else {
        result.type = type;
      }
    } else if (type === "null") {
      result.type = "null";
    } else {
      result.type = type;
    }
  }
  if (enumValues !== void 0) {
    result.enum = enumValues;
  }
  if (properties != null) {
    result.properties = Object.entries(properties).reduce(
      (acc, [key, value]) => {
        acc[key] = convertJSONSchemaToOpenAPISchema(value);
        return acc;
      },
      {}
    );
  }
  if (items) {
    result.items = Array.isArray(items) ? items.map(convertJSONSchemaToOpenAPISchema) : convertJSONSchemaToOpenAPISchema(items);
  }
  if (allOf) {
    result.allOf = allOf.map(convertJSONSchemaToOpenAPISchema);
  }
  if (anyOf) {
    if (anyOf.some(
      (schema) => typeof schema === "object" && (schema == null ? void 0 : schema.type) === "null"
    )) {
      const nonNullSchemas = anyOf.filter(
        (schema) => !(typeof schema === "object" && (schema == null ? void 0 : schema.type) === "null")
      );
      if (nonNullSchemas.length === 1) {
        const converted = convertJSONSchemaToOpenAPISchema(nonNullSchemas[0]);
        if (typeof converted === "object") {
          result.nullable = true;
          Object.assign(result, converted);
        }
      } else {
        result.anyOf = nonNullSchemas.map(convertJSONSchemaToOpenAPISchema);
        result.nullable = true;
      }
    } else {
      result.anyOf = anyOf.map(convertJSONSchemaToOpenAPISchema);
    }
  }
  if (oneOf) {
    result.oneOf = oneOf.map(convertJSONSchemaToOpenAPISchema);
  }
  if (minLength !== void 0) {
    result.minLength = minLength;
  }
  return result;
}
function isEmptyObjectSchema(jsonSchema) {
  return jsonSchema != null && typeof jsonSchema === "object" && jsonSchema.type === "object" && (jsonSchema.properties == null || Object.keys(jsonSchema.properties).length === 0) && !jsonSchema.additionalProperties;
}

// src/convert-to-google-generative-ai-messages.ts
var import_provider2 = require("@ai-sdk/provider");
var import_provider_utils3 = require("@ai-sdk/provider-utils");
function convertToGoogleGenerativeAIMessages(prompt, options) {
  var _a;
  const systemInstructionParts = [];
  const contents = [];
  let systemMessagesAllowed = true;
  const isGemmaModel = (_a = options == null ? void 0 : options.isGemmaModel) != null ? _a : false;
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        if (!systemMessagesAllowed) {
          throw new import_provider2.UnsupportedFunctionalityError({
            functionality: "system messages are only supported at the beginning of the conversation"
          });
        }
        systemInstructionParts.push({ text: content });
        break;
      }
      case "user": {
        systemMessagesAllowed = false;
        const parts = [];
        for (const part of content) {
          switch (part.type) {
            case "text": {
              parts.push({ text: part.text });
              break;
            }
            case "file": {
              const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType;
              parts.push(
                part.data instanceof URL ? {
                  fileData: {
                    mimeType: mediaType,
                    fileUri: part.data.toString()
                  }
                } : {
                  inlineData: {
                    mimeType: mediaType,
                    data: (0, import_provider_utils3.convertToBase64)(part.data)
                  }
                }
              );
              break;
            }
          }
        }
        contents.push({ role: "user", parts });
        break;
      }
      case "assistant": {
        systemMessagesAllowed = false;
        contents.push({
          role: "model",
          parts: content.map((part) => {
            var _a2, _b, _c, _d, _e, _f;
            switch (part.type) {
              case "text": {
                return part.text.length === 0 ? void 0 : {
                  text: part.text,
                  thoughtSignature: (_b = (_a2 = part.providerOptions) == null ? void 0 : _a2.google) == null ? void 0 : _b.thoughtSignature
                };
              }
              case "reasoning": {
                return part.text.length === 0 ? void 0 : {
                  text: part.text,
                  thought: true,
                  thoughtSignature: (_d = (_c = part.providerOptions) == null ? void 0 : _c.google) == null ? void 0 : _d.thoughtSignature
                };
              }
              case "file": {
                if (part.mediaType !== "image/png") {
                  throw new import_provider2.UnsupportedFunctionalityError({
                    functionality: "Only PNG images are supported in assistant messages"
                  });
                }
                if (part.data instanceof URL) {
                  throw new import_provider2.UnsupportedFunctionalityError({
                    functionality: "File data URLs in assistant messages are not supported"
                  });
                }
                return {
                  inlineData: {
                    mimeType: part.mediaType,
                    data: (0, import_provider_utils3.convertToBase64)(part.data)
                  }
                };
              }
              case "tool-call": {
                return {
                  functionCall: {
                    name: part.toolName,
                    args: part.input
                  },
                  thoughtSignature: (_f = (_e = part.providerOptions) == null ? void 0 : _e.google) == null ? void 0 : _f.thoughtSignature
                };
              }
            }
          }).filter((part) => part !== void 0)
        });
        break;
      }
      case "tool": {
        systemMessagesAllowed = false;
        contents.push({
          role: "user",
          parts: content.map((part) => ({
            functionResponse: {
              name: part.toolName,
              response: {
                name: part.toolName,
                content: part.output.value
              }
            }
          }))
        });
        break;
      }
    }
  }
  if (isGemmaModel && systemInstructionParts.length > 0 && contents.length > 0 && contents[0].role === "user") {
    const systemText = systemInstructionParts.map((part) => part.text).join("\n\n");
    contents[0].parts.unshift({ text: systemText + "\n\n" });
  }
  return {
    systemInstruction: systemInstructionParts.length > 0 && !isGemmaModel ? { parts: systemInstructionParts } : void 0,
    contents
  };
}

// src/get-model-path.ts
function getModelPath(modelId) {
  return modelId.includes("/") ? modelId : `models/${modelId}`;
}

// src/google-generative-ai-options.ts
var import_v44 = require("zod/v4");
var googleGenerativeAIProviderOptions = import_v44.z.object({
  responseModalities: import_v44.z.array(import_v44.z.enum(["TEXT", "IMAGE"])).optional(),
  thinkingConfig: import_v44.z.object({
    thinkingBudget: import_v44.z.number().optional(),
    includeThoughts: import_v44.z.boolean().optional()
  }).optional(),
  /**
  Optional.
  The name of the cached content used as context to serve the prediction.
  Format: cachedContents/{cachedContent}
     */
  cachedContent: import_v44.z.string().optional(),
  /**
   * Optional. Enable structured output. Default is true.
   *
   * This is useful when the JSON Schema contains elements that are
   * not supported by the OpenAPI schema version that
   * Google Generative AI uses. You can use this to disable
   * structured outputs if you need to.
   */
  structuredOutputs: import_v44.z.boolean().optional(),
  /**
  Optional. A list of unique safety settings for blocking unsafe content.
   */
  safetySettings: import_v44.z.array(
    import_v44.z.object({
      category: import_v44.z.enum([
        "HARM_CATEGORY_UNSPECIFIED",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_CIVIC_INTEGRITY"
      ]),
      threshold: import_v44.z.enum([
        "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
        "BLOCK_LOW_AND_ABOVE",
        "BLOCK_MEDIUM_AND_ABOVE",
        "BLOCK_ONLY_HIGH",
        "BLOCK_NONE",
        "OFF"
      ])
    })
  ).optional(),
  threshold: import_v44.z.enum([
    "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    "BLOCK_LOW_AND_ABOVE",
    "BLOCK_MEDIUM_AND_ABOVE",
    "BLOCK_ONLY_HIGH",
    "BLOCK_NONE",
    "OFF"
  ]).optional(),
  /**
   * Optional. Enables timestamp understanding for audio-only files.
   *
   * https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/audio-understanding
   */
  audioTimestamp: import_v44.z.boolean().optional(),
  /**
   * Optional. Defines labels used in billing reports. Available on Vertex AI only.
   *
   * https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/add-labels-to-api-calls
   */
  labels: import_v44.z.record(import_v44.z.string(), import_v44.z.string()).optional()
});

// src/google-prepare-tools.ts
var import_provider3 = require("@ai-sdk/provider");
function prepareTools({
  tools,
  toolChoice,
  modelId
}) {
  var _a;
  tools = (tools == null ? void 0 : tools.length) ? tools : void 0;
  const toolWarnings = [];
  const isGemini2 = modelId.includes("gemini-2");
  const supportsDynamicRetrieval = modelId.includes("gemini-1.5-flash") && !modelId.includes("-8b");
  if (tools == null) {
    return { tools: void 0, toolConfig: void 0, toolWarnings };
  }
  const hasFunctionTools = tools.some((tool) => tool.type === "function");
  const hasProviderDefinedTools = tools.some(
    (tool) => tool.type === "provider-defined"
  );
  if (hasFunctionTools && hasProviderDefinedTools) {
    toolWarnings.push({
      type: "unsupported-tool",
      tool: tools.find((tool) => tool.type === "function"),
      details: "Cannot mix function tools with provider-defined tools in the same request. Please use either function tools or provider-defined tools, but not both."
    });
  }
  if (hasProviderDefinedTools) {
    const googleTools2 = {};
    const providerDefinedTools = tools.filter(
      (tool) => tool.type === "provider-defined"
    );
    providerDefinedTools.forEach((tool) => {
      switch (tool.id) {
        case "google.google_search":
          if (isGemini2) {
            googleTools2.googleSearch = {};
          } else if (supportsDynamicRetrieval) {
            googleTools2.googleSearchRetrieval = {
              dynamicRetrievalConfig: {
                mode: tool.args.mode,
                dynamicThreshold: tool.args.dynamicThreshold
              }
            };
          } else {
            googleTools2.googleSearchRetrieval = {};
          }
          break;
        case "google.url_context":
          if (isGemini2) {
            googleTools2.urlContext = {};
          } else {
            toolWarnings.push({
              type: "unsupported-tool",
              tool,
              details: "The URL context tool is not supported with other Gemini models than Gemini 2."
            });
          }
          break;
        case "google.code_execution":
          if (isGemini2) {
            googleTools2.codeExecution = {};
          } else {
            toolWarnings.push({
              type: "unsupported-tool",
              tool,
              details: "The code execution tools is not supported with other Gemini models than Gemini 2."
            });
          }
          break;
        default:
          toolWarnings.push({ type: "unsupported-tool", tool });
          break;
      }
    });
    return {
      tools: Object.keys(googleTools2).length > 0 ? googleTools2 : void 0,
      toolConfig: void 0,
      toolWarnings
    };
  }
  const functionDeclarations = [];
  for (const tool of tools) {
    switch (tool.type) {
      case "function":
        functionDeclarations.push({
          name: tool.name,
          description: (_a = tool.description) != null ? _a : "",
          parameters: convertJSONSchemaToOpenAPISchema(tool.inputSchema)
        });
        break;
      default:
        toolWarnings.push({ type: "unsupported-tool", tool });
        break;
    }
  }
  if (toolChoice == null) {
    return {
      tools: { functionDeclarations },
      toolConfig: void 0,
      toolWarnings
    };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
      return {
        tools: { functionDeclarations },
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        toolWarnings
      };
    case "none":
      return {
        tools: { functionDeclarations },
        toolConfig: { functionCallingConfig: { mode: "NONE" } },
        toolWarnings
      };
    case "required":
      return {
        tools: { functionDeclarations },
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
        toolWarnings
      };
    case "tool":
      return {
        tools: { functionDeclarations },
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: [toolChoice.toolName]
          }
        },
        toolWarnings
      };
    default: {
      const _exhaustiveCheck = type;
      throw new import_provider3.UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/map-google-generative-ai-finish-reason.ts
function mapGoogleGenerativeAIFinishReason({
  finishReason,
  hasToolCalls
}) {
  switch (finishReason) {
    case "STOP":
      return hasToolCalls ? "tool-calls" : "stop";
    case "MAX_TOKENS":
      return "length";
    case "IMAGE_SAFETY":
    case "RECITATION":
    case "SAFETY":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "content-filter";
    case "FINISH_REASON_UNSPECIFIED":
    case "OTHER":
      return "other";
    case "MALFORMED_FUNCTION_CALL":
      return "error";
    default:
      return "unknown";
  }
}

// src/tool/google-search.ts
var import_provider_utils4 = require("@ai-sdk/provider-utils");
var import_v45 = require("zod/v4");
var groundingChunkSchema = import_v45.z.object({
  web: import_v45.z.object({ uri: import_v45.z.string(), title: import_v45.z.string() }).nullish(),
  retrievedContext: import_v45.z.object({ uri: import_v45.z.string(), title: import_v45.z.string() }).nullish()
});
var groundingMetadataSchema = import_v45.z.object({
  webSearchQueries: import_v45.z.array(import_v45.z.string()).nullish(),
  retrievalQueries: import_v45.z.array(import_v45.z.string()).nullish(),
  searchEntryPoint: import_v45.z.object({ renderedContent: import_v45.z.string() }).nullish(),
  groundingChunks: import_v45.z.array(groundingChunkSchema).nullish(),
  groundingSupports: import_v45.z.array(
    import_v45.z.object({
      segment: import_v45.z.object({
        startIndex: import_v45.z.number().nullish(),
        endIndex: import_v45.z.number().nullish(),
        text: import_v45.z.string().nullish()
      }),
      segment_text: import_v45.z.string().nullish(),
      groundingChunkIndices: import_v45.z.array(import_v45.z.number()).nullish(),
      supportChunkIndices: import_v45.z.array(import_v45.z.number()).nullish(),
      confidenceScores: import_v45.z.array(import_v45.z.number()).nullish(),
      confidenceScore: import_v45.z.array(import_v45.z.number()).nullish()
    })
  ).nullish(),
  retrievalMetadata: import_v45.z.union([
    import_v45.z.object({
      webDynamicRetrievalScore: import_v45.z.number()
    }),
    import_v45.z.object({})
  ]).nullish()
});
var googleSearch = (0, import_provider_utils4.createProviderDefinedToolFactory)({
  id: "google.google_search",
  name: "google_search",
  inputSchema: import_v45.z.object({
    mode: import_v45.z.enum(["MODE_DYNAMIC", "MODE_UNSPECIFIED"]).default("MODE_UNSPECIFIED"),
    dynamicThreshold: import_v45.z.number().default(1)
  })
});

// src/tool/url-context.ts
var import_provider_utils5 = require("@ai-sdk/provider-utils");
var import_v46 = require("zod/v4");
var urlMetadataSchema = import_v46.z.object({
  retrievedUrl: import_v46.z.string(),
  urlRetrievalStatus: import_v46.z.string()
});
var urlContextMetadataSchema = import_v46.z.object({
  urlMetadata: import_v46.z.array(urlMetadataSchema)
});
var urlContext = (0, import_provider_utils5.createProviderDefinedToolFactory)({
  id: "google.url_context",
  name: "url_context",
  inputSchema: import_v46.z.object({})
});

// src/google-generative-ai-language-model.ts
var GoogleGenerativeAILanguageModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    var _a;
    this.modelId = modelId;
    this.config = config;
    this.generateId = (_a = config.generateId) != null ? _a : import_provider_utils6.generateId;
  }
  get provider() {
    return this.config.provider;
  }
  get supportedUrls() {
    var _a, _b, _c;
    return (_c = (_b = (_a = this.config).supportedUrls) == null ? void 0 : _b.call(_a)) != null ? _c : {};
  }
  async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    tools,
    toolChoice,
    providerOptions
  }) {
    var _a, _b;
    const warnings = [];
    const googleOptions = await (0, import_provider_utils6.parseProviderOptions)({
      provider: "google",
      providerOptions,
      schema: googleGenerativeAIProviderOptions
    });
    if (((_a = googleOptions == null ? void 0 : googleOptions.thinkingConfig) == null ? void 0 : _a.includeThoughts) === true && !this.config.provider.startsWith("google.vertex.")) {
      warnings.push({
        type: "other",
        message: `The 'includeThoughts' option is only supported with the Google Vertex provider and might not be supported or could behave unexpectedly with the current Google provider (${this.config.provider}).`
      });
    }
    const isGemmaModel = this.modelId.toLowerCase().startsWith("gemma-");
    const { contents, systemInstruction } = convertToGoogleGenerativeAIMessages(
      prompt,
      { isGemmaModel }
    );
    const {
      tools: googleTools2,
      toolConfig: googleToolConfig,
      toolWarnings
    } = prepareTools({
      tools,
      toolChoice,
      modelId: this.modelId
    });
    return {
      args: {
        generationConfig: {
          // standardized settings:
          maxOutputTokens,
          temperature,
          topK,
          topP,
          frequencyPenalty,
          presencePenalty,
          stopSequences,
          seed,
          // response format:
          responseMimeType: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? "application/json" : void 0,
          responseSchema: (responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null && // Google GenAI does not support all OpenAPI Schema features,
          // so this is needed as an escape hatch:
          // TODO convert into provider option
          ((_b = googleOptions == null ? void 0 : googleOptions.structuredOutputs) != null ? _b : true) ? convertJSONSchemaToOpenAPISchema(responseFormat.schema) : void 0,
          ...(googleOptions == null ? void 0 : googleOptions.audioTimestamp) && {
            audioTimestamp: googleOptions.audioTimestamp
          },
          // provider options:
          responseModalities: googleOptions == null ? void 0 : googleOptions.responseModalities,
          thinkingConfig: googleOptions == null ? void 0 : googleOptions.thinkingConfig
        },
        contents,
        systemInstruction: isGemmaModel ? void 0 : systemInstruction,
        safetySettings: googleOptions == null ? void 0 : googleOptions.safetySettings,
        tools: googleTools2,
        toolConfig: googleToolConfig,
        cachedContent: googleOptions == null ? void 0 : googleOptions.cachedContent,
        labels: googleOptions == null ? void 0 : googleOptions.labels
      },
      warnings: [...warnings, ...toolWarnings]
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const { args, warnings } = await this.getArgs(options);
    const body = JSON.stringify(args);
    const mergedHeaders = (0, import_provider_utils6.combineHeaders)(
      await (0, import_provider_utils6.resolve)(this.config.headers),
      options.headers
    );
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils6.postJsonToApi)({
      url: `${this.config.baseURL}/${getModelPath(
        this.modelId
      )}:generateContent`,
      headers: mergedHeaders,
      body: args,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils6.createJsonResponseHandler)(responseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const candidate = response.candidates[0];
    const content = [];
    const parts = (_b = (_a = candidate.content) == null ? void 0 : _a.parts) != null ? _b : [];
    const usageMetadata = response.usageMetadata;
    let lastCodeExecutionToolCallId;
    for (const part of parts) {
      if ("executableCode" in part && ((_c = part.executableCode) == null ? void 0 : _c.code)) {
        const toolCallId = this.config.generateId();
        lastCodeExecutionToolCallId = toolCallId;
        content.push({
          type: "tool-call",
          toolCallId,
          toolName: "code_execution",
          input: JSON.stringify(part.executableCode),
          providerExecuted: true
        });
      } else if ("codeExecutionResult" in part && part.codeExecutionResult) {
        content.push({
          type: "tool-result",
          // Assumes a result directly follows its corresponding call part.
          toolCallId: lastCodeExecutionToolCallId,
          toolName: "code_execution",
          result: {
            outcome: part.codeExecutionResult.outcome,
            output: part.codeExecutionResult.output
          },
          providerExecuted: true
        });
        lastCodeExecutionToolCallId = void 0;
      } else if ("text" in part && part.text != null && part.text.length > 0) {
        content.push({
          type: part.thought === true ? "reasoning" : "text",
          text: part.text,
          providerMetadata: part.thoughtSignature ? { google: { thoughtSignature: part.thoughtSignature } } : void 0
        });
      } else if ("functionCall" in part) {
        content.push({
          type: "tool-call",
          toolCallId: this.config.generateId(),
          toolName: part.functionCall.name,
          input: JSON.stringify(part.functionCall.args),
          providerMetadata: part.thoughtSignature ? { google: { thoughtSignature: part.thoughtSignature } } : void 0
        });
      } else if ("inlineData" in part) {
        content.push({
          type: "file",
          data: part.inlineData.data,
          mediaType: part.inlineData.mimeType
        });
      }
    }
    const sources = (_d = extractSources({
      groundingMetadata: candidate.groundingMetadata,
      generateId: this.config.generateId
    })) != null ? _d : [];
    for (const source of sources) {
      content.push(source);
    }
    return {
      content,
      finishReason: mapGoogleGenerativeAIFinishReason({
        finishReason: candidate.finishReason,
        hasToolCalls: content.some((part) => part.type === "tool-call")
      }),
      usage: {
        inputTokens: (_e = usageMetadata == null ? void 0 : usageMetadata.promptTokenCount) != null ? _e : void 0,
        outputTokens: (_f = usageMetadata == null ? void 0 : usageMetadata.candidatesTokenCount) != null ? _f : void 0,
        totalTokens: (_g = usageMetadata == null ? void 0 : usageMetadata.totalTokenCount) != null ? _g : void 0,
        reasoningTokens: (_h = usageMetadata == null ? void 0 : usageMetadata.thoughtsTokenCount) != null ? _h : void 0,
        cachedInputTokens: (_i = usageMetadata == null ? void 0 : usageMetadata.cachedContentTokenCount) != null ? _i : void 0
      },
      warnings,
      providerMetadata: {
        google: {
          groundingMetadata: (_j = candidate.groundingMetadata) != null ? _j : null,
          urlContextMetadata: (_k = candidate.urlContextMetadata) != null ? _k : null,
          safetyRatings: (_l = candidate.safetyRatings) != null ? _l : null,
          usageMetadata: usageMetadata != null ? usageMetadata : null
        }
      },
      request: { body },
      response: {
        // TODO timestamp, model id, id
        headers: responseHeaders,
        body: rawResponse
      }
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const body = JSON.stringify(args);
    const headers = (0, import_provider_utils6.combineHeaders)(
      await (0, import_provider_utils6.resolve)(this.config.headers),
      options.headers
    );
    const { responseHeaders, value: response } = await (0, import_provider_utils6.postJsonToApi)({
      url: `${this.config.baseURL}/${getModelPath(
        this.modelId
      )}:streamGenerateContent?alt=sse`,
      headers,
      body: args,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils6.createEventSourceResponseHandler)(chunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    let finishReason = "unknown";
    const usage = {
      inputTokens: void 0,
      outputTokens: void 0,
      totalTokens: void 0
    };
    let providerMetadata = void 0;
    const generateId3 = this.config.generateId;
    let hasToolCalls = false;
    let currentTextBlockId = null;
    let currentReasoningBlockId = null;
    let blockCounter = 0;
    const emittedSourceUrls = /* @__PURE__ */ new Set();
    let lastCodeExecutionToolCallId;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
            if (!chunk.success) {
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            const usageMetadata = value.usageMetadata;
            if (usageMetadata != null) {
              usage.inputTokens = (_a = usageMetadata.promptTokenCount) != null ? _a : void 0;
              usage.outputTokens = (_b = usageMetadata.candidatesTokenCount) != null ? _b : void 0;
              usage.totalTokens = (_c = usageMetadata.totalTokenCount) != null ? _c : void 0;
              usage.reasoningTokens = (_d = usageMetadata.thoughtsTokenCount) != null ? _d : void 0;
              usage.cachedInputTokens = (_e = usageMetadata.cachedContentTokenCount) != null ? _e : void 0;
            }
            const candidate = (_f = value.candidates) == null ? void 0 : _f[0];
            if (candidate == null) {
              return;
            }
            const content = candidate.content;
            const sources = extractSources({
              groundingMetadata: candidate.groundingMetadata,
              generateId: generateId3
            });
            if (sources != null) {
              for (const source of sources) {
                if (source.sourceType === "url" && !emittedSourceUrls.has(source.url)) {
                  emittedSourceUrls.add(source.url);
                  controller.enqueue(source);
                }
              }
            }
            if (content != null) {
              const parts = (_g = content.parts) != null ? _g : [];
              for (const part of parts) {
                if ("executableCode" in part && ((_h = part.executableCode) == null ? void 0 : _h.code)) {
                  const toolCallId = generateId3();
                  lastCodeExecutionToolCallId = toolCallId;
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId,
                    toolName: "code_execution",
                    input: JSON.stringify(part.executableCode),
                    providerExecuted: true
                  });
                  hasToolCalls = true;
                } else if ("codeExecutionResult" in part && part.codeExecutionResult) {
                  const toolCallId = lastCodeExecutionToolCallId;
                  if (toolCallId) {
                    controller.enqueue({
                      type: "tool-result",
                      toolCallId,
                      toolName: "code_execution",
                      result: {
                        outcome: part.codeExecutionResult.outcome,
                        output: part.codeExecutionResult.output
                      },
                      providerExecuted: true
                    });
                    lastCodeExecutionToolCallId = void 0;
                  }
                } else if ("text" in part && part.text != null && part.text.length > 0) {
                  if (part.thought === true) {
                    if (currentTextBlockId !== null) {
                      controller.enqueue({
                        type: "text-end",
                        id: currentTextBlockId
                      });
                      currentTextBlockId = null;
                    }
                    if (currentReasoningBlockId === null) {
                      currentReasoningBlockId = String(blockCounter++);
                      controller.enqueue({
                        type: "reasoning-start",
                        id: currentReasoningBlockId,
                        providerMetadata: part.thoughtSignature ? {
                          google: {
                            thoughtSignature: part.thoughtSignature
                          }
                        } : void 0
                      });
                    }
                    controller.enqueue({
                      type: "reasoning-delta",
                      id: currentReasoningBlockId,
                      delta: part.text,
                      providerMetadata: part.thoughtSignature ? {
                        google: { thoughtSignature: part.thoughtSignature }
                      } : void 0
                    });
                  } else {
                    if (currentReasoningBlockId !== null) {
                      controller.enqueue({
                        type: "reasoning-end",
                        id: currentReasoningBlockId
                      });
                      currentReasoningBlockId = null;
                    }
                    if (currentTextBlockId === null) {
                      currentTextBlockId = String(blockCounter++);
                      controller.enqueue({
                        type: "text-start",
                        id: currentTextBlockId,
                        providerMetadata: part.thoughtSignature ? {
                          google: {
                            thoughtSignature: part.thoughtSignature
                          }
                        } : void 0
                      });
                    }
                    controller.enqueue({
                      type: "text-delta",
                      id: currentTextBlockId,
                      delta: part.text,
                      providerMetadata: part.thoughtSignature ? {
                        google: { thoughtSignature: part.thoughtSignature }
                      } : void 0
                    });
                  }
                }
              }
              const inlineDataParts = getInlineDataParts(content.parts);
              if (inlineDataParts != null) {
                for (const part of inlineDataParts) {
                  controller.enqueue({
                    type: "file",
                    mediaType: part.inlineData.mimeType,
                    data: part.inlineData.data
                  });
                }
              }
              const toolCallDeltas = getToolCallsFromParts({
                parts: content.parts,
                generateId: generateId3
              });
              if (toolCallDeltas != null) {
                for (const toolCall of toolCallDeltas) {
                  controller.enqueue({
                    type: "tool-input-start",
                    id: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    providerMetadata: toolCall.providerMetadata
                  });
                  controller.enqueue({
                    type: "tool-input-delta",
                    id: toolCall.toolCallId,
                    delta: toolCall.args,
                    providerMetadata: toolCall.providerMetadata
                  });
                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCall.toolCallId,
                    providerMetadata: toolCall.providerMetadata
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.args,
                    providerMetadata: toolCall.providerMetadata
                  });
                  hasToolCalls = true;
                }
              }
            }
            if (candidate.finishReason != null) {
              finishReason = mapGoogleGenerativeAIFinishReason({
                finishReason: candidate.finishReason,
                hasToolCalls
              });
              providerMetadata = {
                google: {
                  groundingMetadata: (_i = candidate.groundingMetadata) != null ? _i : null,
                  urlContextMetadata: (_j = candidate.urlContextMetadata) != null ? _j : null,
                  safetyRatings: (_k = candidate.safetyRatings) != null ? _k : null
                }
              };
              if (usageMetadata != null) {
                providerMetadata.google.usageMetadata = usageMetadata;
              }
            }
          },
          flush(controller) {
            if (currentTextBlockId !== null) {
              controller.enqueue({
                type: "text-end",
                id: currentTextBlockId
              });
            }
            if (currentReasoningBlockId !== null) {
              controller.enqueue({
                type: "reasoning-end",
                id: currentReasoningBlockId
              });
            }
            controller.enqueue({
              type: "finish",
              finishReason,
              usage,
              providerMetadata
            });
          }
        })
      ),
      response: { headers: responseHeaders },
      request: { body }
    };
  }
};
function getToolCallsFromParts({
  parts,
  generateId: generateId3
}) {
  const functionCallParts = parts == null ? void 0 : parts.filter(
    (part) => "functionCall" in part
  );
  return functionCallParts == null || functionCallParts.length === 0 ? void 0 : functionCallParts.map((part) => ({
    type: "tool-call",
    toolCallId: generateId3(),
    toolName: part.functionCall.name,
    args: JSON.stringify(part.functionCall.args),
    providerMetadata: part.thoughtSignature ? { google: { thoughtSignature: part.thoughtSignature } } : void 0
  }));
}
function getInlineDataParts(parts) {
  return parts == null ? void 0 : parts.filter(
    (part) => "inlineData" in part
  );
}
function extractSources({
  groundingMetadata,
  generateId: generateId3
}) {
  var _a;
  return (_a = groundingMetadata == null ? void 0 : groundingMetadata.groundingChunks) == null ? void 0 : _a.filter(
    (chunk) => chunk.web != null
  ).map((chunk) => ({
    type: "source",
    sourceType: "url",
    id: generateId3(),
    url: chunk.web.uri,
    title: chunk.web.title
  }));
}
var contentSchema = import_v47.z.object({
  parts: import_v47.z.array(
    import_v47.z.union([
      // note: order matters since text can be fully empty
      import_v47.z.object({
        functionCall: import_v47.z.object({
          name: import_v47.z.string(),
          args: import_v47.z.unknown()
        }),
        thoughtSignature: import_v47.z.string().nullish()
      }),
      import_v47.z.object({
        inlineData: import_v47.z.object({
          mimeType: import_v47.z.string(),
          data: import_v47.z.string()
        })
      }),
      import_v47.z.object({
        executableCode: import_v47.z.object({
          language: import_v47.z.string(),
          code: import_v47.z.string()
        }).nullish(),
        codeExecutionResult: import_v47.z.object({
          outcome: import_v47.z.string(),
          output: import_v47.z.string()
        }).nullish(),
        text: import_v47.z.string().nullish(),
        thought: import_v47.z.boolean().nullish(),
        thoughtSignature: import_v47.z.string().nullish()
      })
    ])
  ).nullish()
});
var safetyRatingSchema = import_v47.z.object({
  category: import_v47.z.string().nullish(),
  probability: import_v47.z.string().nullish(),
  probabilityScore: import_v47.z.number().nullish(),
  severity: import_v47.z.string().nullish(),
  severityScore: import_v47.z.number().nullish(),
  blocked: import_v47.z.boolean().nullish()
});
var usageSchema = import_v47.z.object({
  cachedContentTokenCount: import_v47.z.number().nullish(),
  thoughtsTokenCount: import_v47.z.number().nullish(),
  promptTokenCount: import_v47.z.number().nullish(),
  candidatesTokenCount: import_v47.z.number().nullish(),
  totalTokenCount: import_v47.z.number().nullish()
});
var responseSchema = import_v47.z.object({
  candidates: import_v47.z.array(
    import_v47.z.object({
      content: contentSchema.nullish().or(import_v47.z.object({}).strict()),
      finishReason: import_v47.z.string().nullish(),
      safetyRatings: import_v47.z.array(safetyRatingSchema).nullish(),
      groundingMetadata: groundingMetadataSchema.nullish(),
      urlContextMetadata: urlContextMetadataSchema.nullish()
    })
  ),
  usageMetadata: usageSchema.nullish()
});
var chunkSchema = import_v47.z.object({
  candidates: import_v47.z.array(
    import_v47.z.object({
      content: contentSchema.nullish(),
      finishReason: import_v47.z.string().nullish(),
      safetyRatings: import_v47.z.array(safetyRatingSchema).nullish(),
      groundingMetadata: groundingMetadataSchema.nullish(),
      urlContextMetadata: urlContextMetadataSchema.nullish()
    })
  ).nullish(),
  usageMetadata: usageSchema.nullish()
});

// src/tool/code-execution.ts
var import_provider_utils7 = require("@ai-sdk/provider-utils");
var import_v48 = require("zod/v4");
var codeExecution = (0, import_provider_utils7.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "google.code_execution",
  name: "code_execution",
  inputSchema: import_v48.z.object({
    language: import_v48.z.string().describe("The programming language of the code."),
    code: import_v48.z.string().describe("The code to be executed.")
  }),
  outputSchema: import_v48.z.object({
    outcome: import_v48.z.string().describe('The outcome of the execution (e.g., "OUTCOME_OK").'),
    output: import_v48.z.string().describe("The output from the code execution.")
  })
});

// src/google-tools.ts
var googleTools = {
  /**
   * Creates a Google search tool that gives Google direct access to real-time web content.
   * Must have name "google_search".
   */
  googleSearch,
  /**
   * Creates a URL context tool that gives Google direct access to real-time web content.
   * Must have name "url_context".
   */
  urlContext,
  /**
   * A tool that enables the model to generate and run Python code.
   * Must have name "code_execution".
   *
   * @note Ensure the selected model supports Code Execution.
   * Multi-tool usage with the code execution tool is typically compatible with Gemini >=2 models.
   *
   * @see https://ai.google.dev/gemini-api/docs/code-execution (Google AI)
   * @see https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/code-execution-api (Vertex AI)
   */
  codeExecution
};

// src/google-generative-ai-image-model.ts
var import_provider_utils8 = require("@ai-sdk/provider-utils");
var import_v49 = require("zod/v4");
var GoogleGenerativeAIImageModel = class {
  constructor(modelId, settings, config) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.specificationVersion = "v2";
  }
  get maxImagesPerCall() {
    var _a;
    return (_a = this.settings.maxImagesPerCall) != null ? _a : 4;
  }
  get provider() {
    return this.config.provider;
  }
  async doGenerate(options) {
    var _a, _b, _c;
    const {
      prompt,
      n = 1,
      size = "1024x1024",
      aspectRatio = "1:1",
      seed,
      providerOptions,
      headers,
      abortSignal
    } = options;
    const warnings = [];
    if (size != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "size",
        details: "This model does not support the `size` option. Use `aspectRatio` instead."
      });
    }
    if (seed != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "seed",
        details: "This model does not support the `seed` option through this provider."
      });
    }
    const googleOptions = await (0, import_provider_utils8.parseProviderOptions)({
      provider: "google",
      providerOptions,
      schema: googleImageProviderOptionsSchema
    });
    const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
    const parameters = {
      sampleCount: n
    };
    if (aspectRatio != null) {
      parameters.aspectRatio = aspectRatio;
    }
    if (googleOptions) {
      Object.assign(parameters, googleOptions);
    }
    const body = {
      instances: [{ prompt }],
      parameters
    };
    const { responseHeaders, value: response } = await (0, import_provider_utils8.postJsonToApi)({
      url: `${this.config.baseURL}/models/${this.modelId}:predict`,
      headers: (0, import_provider_utils8.combineHeaders)(await (0, import_provider_utils8.resolve)(this.config.headers), headers),
      body,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils8.createJsonResponseHandler)(
        googleImageResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      images: response.predictions.map(
        (p) => p.bytesBase64Encoded
      ),
      warnings: warnings != null ? warnings : [],
      providerMetadata: {
        google: {
          images: response.predictions.map((prediction) => ({
            // Add any prediction-specific metadata here
          }))
        }
      },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders
      }
    };
  }
};
var googleImageResponseSchema = import_v49.z.object({
  predictions: import_v49.z.array(import_v49.z.object({ bytesBase64Encoded: import_v49.z.string() })).default([])
});
var googleImageProviderOptionsSchema = import_v49.z.object({
  personGeneration: import_v49.z.enum(["dont_allow", "allow_adult", "allow_all"]).nullish(),
  aspectRatio: import_v49.z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).nullish()
});

// src/google-provider.ts
function createGoogleGenerativeAI(options = {}) {
  var _a;
  const baseURL = (_a = (0, import_provider_utils9.withoutTrailingSlash)(options.baseURL)) != null ? _a : "https://generativelanguage.googleapis.com/v1beta";
  const getHeaders = () => ({
    "x-goog-api-key": (0, import_provider_utils9.loadApiKey)({
      apiKey: options.apiKey,
      environmentVariableName: "GOOGLE_GENERATIVE_AI_API_KEY",
      description: "Google Generative AI"
    }),
    ...options.headers
  });
  const createChatModel = (modelId) => {
    var _a2;
    return new GoogleGenerativeAILanguageModel(modelId, {
      provider: "google.generative-ai",
      baseURL,
      headers: getHeaders,
      generateId: (_a2 = options.generateId) != null ? _a2 : import_provider_utils9.generateId,
      supportedUrls: () => ({
        "*": [
          // Google Generative Language "files" endpoint
          // e.g. https://generativelanguage.googleapis.com/v1beta/files/...
          new RegExp(`^${baseURL}/files/.*$`),
          // YouTube URLs (public or unlisted videos)
          new RegExp(
            `^https://(?:www\\.)?youtube\\.com/watch\\?v=[\\w-]+(?:&[\\w=&.-]*)?$`
          ),
          new RegExp(`^https://youtu\\.be/[\\w-]+(?:\\?[\\w=&.-]*)?$`)
        ]
      }),
      fetch: options.fetch
    });
  };
  const createEmbeddingModel = (modelId) => new GoogleGenerativeAIEmbeddingModel(modelId, {
    provider: "google.generative-ai",
    baseURL,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createImageModel = (modelId, settings = {}) => new GoogleGenerativeAIImageModel(modelId, settings, {
    provider: "google.generative-ai",
    baseURL,
    headers: getHeaders,
    fetch: options.fetch
  });
  const provider = function(modelId) {
    if (new.target) {
      throw new Error(
        "The Google Generative AI model function cannot be called with the new keyword."
      );
    }
    return createChatModel(modelId);
  };
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.generativeAI = createChatModel;
  provider.embedding = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.tools = googleTools;
  return provider;
}
var google = createGoogleGenerativeAI();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createGoogleGenerativeAI,
  google
});
//# sourceMappingURL=index.js.map