// src/google-generative-ai-language-model.ts
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  resolve
} from "@ai-sdk/provider-utils";
import { z as z2 } from "zod";

// src/convert-json-schema-to-openapi-schema.ts
function convertJSONSchemaToOpenAPISchema(jsonSchema) {
  if (isEmptyObjectSchema(jsonSchema)) {
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
import {
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils";
function convertToGoogleGenerativeAIMessages(prompt) {
  var _a, _b;
  const systemInstructionParts = [];
  const contents = [];
  let systemMessagesAllowed = true;
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        if (!systemMessagesAllowed) {
          throw new UnsupportedFunctionalityError({
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
            case "image": {
              parts.push(
                part.image instanceof URL ? {
                  fileData: {
                    mimeType: (_a = part.mimeType) != null ? _a : "image/jpeg",
                    fileUri: part.image.toString()
                  }
                } : {
                  inlineData: {
                    mimeType: (_b = part.mimeType) != null ? _b : "image/jpeg",
                    data: convertUint8ArrayToBase64(part.image)
                  }
                }
              );
              break;
            }
            case "file": {
              parts.push(
                part.data instanceof URL ? {
                  fileData: {
                    mimeType: part.mimeType,
                    fileUri: part.data.toString()
                  }
                } : {
                  inlineData: {
                    mimeType: part.mimeType,
                    data: part.data
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
            switch (part.type) {
              case "text": {
                return part.text.length === 0 ? void 0 : { text: part.text };
              }
              case "file": {
                if (part.mimeType !== "image/png") {
                  throw new UnsupportedFunctionalityError({
                    functionality: "Only PNG images are supported in assistant messages"
                  });
                }
                if (part.data instanceof URL) {
                  throw new UnsupportedFunctionalityError({
                    functionality: "File data URLs in assistant messages are not supported"
                  });
                }
                return {
                  inlineData: {
                    mimeType: part.mimeType,
                    data: part.data
                  }
                };
              }
              case "tool-call": {
                return {
                  functionCall: {
                    name: part.toolName,
                    args: part.args
                  }
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
                content: part.result
              }
            }
          }))
        });
        break;
      }
    }
  }
  return {
    systemInstruction: systemInstructionParts.length > 0 ? { parts: systemInstructionParts } : void 0,
    contents
  };
}

// src/get-model-path.ts
function getModelPath(modelId) {
  return modelId.includes("/") ? modelId : `models/${modelId}`;
}

// src/google-error.ts
import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
import { z } from "zod";
var googleErrorDataSchema = z.object({
  error: z.object({
    code: z.number().nullable(),
    message: z.string(),
    status: z.string()
  })
});
var googleFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: googleErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/google-prepare-tools.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";
function prepareTools(mode, useSearchGrounding, dynamicRetrievalConfig, modelId) {
  var _a, _b;
  const tools = ((_a = mode.tools) == null ? void 0 : _a.length) ? mode.tools : void 0;
  const toolWarnings = [];
  const isGemini2 = modelId.includes("gemini-2");
  const supportsDynamicRetrieval = modelId.includes("gemini-1.5-flash") && !modelId.includes("-8b");
  if (useSearchGrounding) {
    return {
      tools: isGemini2 ? { googleSearch: {} } : {
        googleSearchRetrieval: !supportsDynamicRetrieval || !dynamicRetrievalConfig ? {} : { dynamicRetrievalConfig }
      },
      toolConfig: void 0,
      toolWarnings
    };
  }
  if (tools == null) {
    return { tools: void 0, toolConfig: void 0, toolWarnings };
  }
  const functionDeclarations = [];
  for (const tool of tools) {
    if (tool.type === "provider-defined") {
      toolWarnings.push({ type: "unsupported-tool", tool });
    } else {
      functionDeclarations.push({
        name: tool.name,
        description: (_b = tool.description) != null ? _b : "",
        parameters: convertJSONSchemaToOpenAPISchema(tool.parameters)
      });
    }
  }
  const toolChoice = mode.toolChoice;
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
      throw new UnsupportedFunctionalityError2({
        functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`
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

// src/google-generative-ai-language-model.ts
var GoogleGenerativeAILanguageModel = class {
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.defaultObjectGenerationMode = "json";
    this.supportsImageUrls = false;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get supportsStructuredOutputs() {
    var _a;
    return (_a = this.settings.structuredOutputs) != null ? _a : true;
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    providerMetadata
  }) {
    var _a, _b, _c;
    const type = mode.type;
    const warnings = [];
    const googleOptions = parseProviderOptions({
      provider: "google",
      providerOptions: providerMetadata,
      schema: googleGenerativeAIProviderOptionsSchema
    });
    if (((_a = googleOptions == null ? void 0 : googleOptions.thinkingConfig) == null ? void 0 : _a.includeThoughts) === true && !this.config.provider.startsWith("google.vertex.")) {
      warnings.push({
        type: "other",
        message: `The 'includeThoughts' option is only supported with the Google Vertex provider and might not be supported or could behave unexpectedly with the current Google provider (${this.config.provider}).`
      });
    }
    const generationConfig = {
      // standardized settings:
      maxOutputTokens: maxTokens,
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
      this.supportsStructuredOutputs ? convertJSONSchemaToOpenAPISchema(responseFormat.schema) : void 0,
      ...this.settings.audioTimestamp && {
        audioTimestamp: this.settings.audioTimestamp
      },
      // provider options:
      responseModalities: googleOptions == null ? void 0 : googleOptions.responseModalities,
      thinkingConfig: googleOptions == null ? void 0 : googleOptions.thinkingConfig
    };
    const { contents, systemInstruction } = convertToGoogleGenerativeAIMessages(prompt);
    switch (type) {
      case "regular": {
        const { tools, toolConfig, toolWarnings } = prepareTools(
          mode,
          (_b = this.settings.useSearchGrounding) != null ? _b : false,
          this.settings.dynamicRetrievalConfig,
          this.modelId
        );
        return {
          args: {
            generationConfig,
            contents,
            systemInstruction,
            safetySettings: this.settings.safetySettings,
            tools,
            toolConfig,
            cachedContent: this.settings.cachedContent
          },
          warnings: [...warnings, ...toolWarnings]
        };
      }
      case "object-json": {
        return {
          args: {
            generationConfig: {
              ...generationConfig,
              responseMimeType: "application/json",
              responseSchema: mode.schema != null && // Google GenAI does not support all OpenAPI Schema features,
              // so this is needed as an escape hatch:
              this.supportsStructuredOutputs ? convertJSONSchemaToOpenAPISchema(mode.schema) : void 0
            },
            contents,
            systemInstruction,
            safetySettings: this.settings.safetySettings,
            cachedContent: this.settings.cachedContent
          },
          warnings
        };
      }
      case "object-tool": {
        return {
          args: {
            generationConfig,
            contents,
            systemInstruction,
            tools: {
              functionDeclarations: [
                {
                  name: mode.tool.name,
                  description: (_c = mode.tool.description) != null ? _c : "",
                  parameters: convertJSONSchemaToOpenAPISchema(
                    mode.tool.parameters
                  )
                }
              ]
            },
            toolConfig: { functionCallingConfig: { mode: "ANY" } },
            safetySettings: this.settings.safetySettings,
            cachedContent: this.settings.cachedContent
          },
          warnings
        };
      }
      default: {
        const _exhaustiveCheck = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }
  supportsUrl(url) {
    return this.config.isSupportedUrl(url);
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e;
    const { args, warnings } = await this.getArgs(options);
    const body = JSON.stringify(args);
    const mergedHeaders = combineHeaders(
      await resolve(this.config.headers),
      options.headers
    );
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await postJsonToApi({
      url: `${this.config.baseURL}/${getModelPath(
        this.modelId
      )}:generateContent`,
      headers: mergedHeaders,
      body: args,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(responseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { contents: rawPrompt, ...rawSettings } = args;
    const candidate = response.candidates[0];
    const parts = candidate.content == null || typeof candidate.content !== "object" || !("parts" in candidate.content) ? [] : candidate.content.parts;
    const toolCalls = getToolCallsFromParts({
      parts,
      // Use candidateParts
      generateId: this.config.generateId
    });
    const usageMetadata = response.usageMetadata;
    return {
      text: getTextFromParts(parts),
      reasoning: getReasoningDetailsFromParts(parts),
      files: (_a = getInlineDataParts(parts)) == null ? void 0 : _a.map((part) => ({
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType
      })),
      toolCalls,
      finishReason: mapGoogleGenerativeAIFinishReason({
        finishReason: candidate.finishReason,
        hasToolCalls: toolCalls != null && toolCalls.length > 0
      }),
      usage: {
        promptTokens: (_b = usageMetadata == null ? void 0 : usageMetadata.promptTokenCount) != null ? _b : NaN,
        completionTokens: (_c = usageMetadata == null ? void 0 : usageMetadata.candidatesTokenCount) != null ? _c : NaN
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders, body: rawResponse },
      warnings,
      providerMetadata: {
        google: {
          groundingMetadata: (_d = candidate.groundingMetadata) != null ? _d : null,
          safetyRatings: (_e = candidate.safetyRatings) != null ? _e : null
        }
      },
      sources: extractSources({
        groundingMetadata: candidate.groundingMetadata,
        generateId: this.config.generateId
      }),
      request: { body }
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const body = JSON.stringify(args);
    const headers = combineHeaders(
      await resolve(this.config.headers),
      options.headers
    );
    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/${getModelPath(
        this.modelId
      )}:streamGenerateContent?alt=sse`,
      headers,
      body: args,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(chunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { contents: rawPrompt, ...rawSettings } = args;
    let finishReason = "unknown";
    let usage = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN
    };
    let providerMetadata = void 0;
    const generateId = this.config.generateId;
    let hasToolCalls = false;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f;
            if (!chunk.success) {
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            const usageMetadata = value.usageMetadata;
            if (usageMetadata != null) {
              usage = {
                promptTokens: (_a = usageMetadata.promptTokenCount) != null ? _a : NaN,
                completionTokens: (_b = usageMetadata.candidatesTokenCount) != null ? _b : NaN
              };
            }
            const candidate = (_c = value.candidates) == null ? void 0 : _c[0];
            if (candidate == null) {
              return;
            }
            const content = candidate.content;
            if (content != null) {
              const deltaText = getTextFromParts(content.parts);
              if (deltaText != null) {
                controller.enqueue({
                  type: "text-delta",
                  textDelta: deltaText
                });
              }
              const reasoningDeltaText = getReasoningDetailsFromParts(
                content.parts
              );
              if (reasoningDeltaText != null) {
                for (const part of reasoningDeltaText) {
                  controller.enqueue({
                    type: "reasoning",
                    textDelta: part.text
                  });
                }
              }
              const inlineDataParts = getInlineDataParts(content.parts);
              if (inlineDataParts != null) {
                for (const part of inlineDataParts) {
                  controller.enqueue({
                    type: "file",
                    mimeType: part.inlineData.mimeType,
                    data: part.inlineData.data
                  });
                }
              }
              const toolCallDeltas = getToolCallsFromParts({
                parts: content.parts,
                generateId
              });
              if (toolCallDeltas != null) {
                for (const toolCall of toolCallDeltas) {
                  controller.enqueue({
                    type: "tool-call-delta",
                    toolCallType: "function",
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    argsTextDelta: toolCall.args
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallType: "function",
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.args
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
              const sources = (_d = extractSources({
                groundingMetadata: candidate.groundingMetadata,
                generateId
              })) != null ? _d : [];
              for (const source of sources) {
                controller.enqueue({ type: "source", source });
              }
              providerMetadata = {
                google: {
                  groundingMetadata: (_e = candidate.groundingMetadata) != null ? _e : null,
                  safetyRatings: (_f = candidate.safetyRatings) != null ? _f : null
                }
              };
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              usage,
              providerMetadata
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings,
      request: { body }
    };
  }
};
function getToolCallsFromParts({
  parts,
  generateId
}) {
  const functionCallParts = parts == null ? void 0 : parts.filter(
    (part) => "functionCall" in part
  );
  return functionCallParts == null || functionCallParts.length === 0 ? void 0 : functionCallParts.map((part) => ({
    toolCallType: "function",
    toolCallId: generateId(),
    toolName: part.functionCall.name,
    args: JSON.stringify(part.functionCall.args)
  }));
}
function getTextFromParts(parts) {
  const textParts = parts == null ? void 0 : parts.filter(
    (part) => "text" in part && part.thought !== true
  );
  return textParts == null || textParts.length === 0 ? void 0 : textParts.map((part) => part.text).join("");
}
function getReasoningDetailsFromParts(parts) {
  const reasoningParts = parts == null ? void 0 : parts.filter(
    (part) => "text" in part && part.thought === true && part.text != null
  );
  return reasoningParts == null || reasoningParts.length === 0 ? void 0 : reasoningParts.map((part) => ({ type: "text", text: part.text }));
}
function getInlineDataParts(parts) {
  return parts == null ? void 0 : parts.filter(
    (part) => "inlineData" in part
  );
}
function extractSources({
  groundingMetadata,
  generateId
}) {
  var _a;
  return (_a = groundingMetadata == null ? void 0 : groundingMetadata.groundingChunks) == null ? void 0 : _a.filter(
    (chunk) => chunk.web != null
  ).map((chunk) => ({
    sourceType: "url",
    id: generateId(),
    url: chunk.web.uri,
    title: chunk.web.title
  }));
}
var contentSchema = z2.object({
  parts: z2.array(
    z2.union([
      // note: order matters since text can be fully empty
      z2.object({
        functionCall: z2.object({
          name: z2.string(),
          args: z2.unknown()
        })
      }),
      z2.object({
        inlineData: z2.object({
          mimeType: z2.string(),
          data: z2.string()
        })
      }),
      z2.object({
        text: z2.string().nullish(),
        thought: z2.boolean().nullish()
      })
    ])
  ).nullish()
});
var groundingChunkSchema = z2.object({
  web: z2.object({ uri: z2.string(), title: z2.string() }).nullish(),
  retrievedContext: z2.object({ uri: z2.string(), title: z2.string() }).nullish()
});
var groundingMetadataSchema = z2.object({
  webSearchQueries: z2.array(z2.string()).nullish(),
  retrievalQueries: z2.array(z2.string()).nullish(),
  searchEntryPoint: z2.object({ renderedContent: z2.string() }).nullish(),
  groundingChunks: z2.array(groundingChunkSchema).nullish(),
  groundingSupports: z2.array(
    z2.object({
      segment: z2.object({
        startIndex: z2.number().nullish(),
        endIndex: z2.number().nullish(),
        text: z2.string().nullish()
      }),
      segment_text: z2.string().nullish(),
      groundingChunkIndices: z2.array(z2.number()).nullish(),
      supportChunkIndices: z2.array(z2.number()).nullish(),
      confidenceScores: z2.array(z2.number()).nullish(),
      confidenceScore: z2.array(z2.number()).nullish()
    })
  ).nullish(),
  retrievalMetadata: z2.union([
    z2.object({
      webDynamicRetrievalScore: z2.number()
    }),
    z2.object({})
  ]).nullish()
});
var safetyRatingSchema = z2.object({
  category: z2.string().nullish(),
  probability: z2.string().nullish(),
  probabilityScore: z2.number().nullish(),
  severity: z2.string().nullish(),
  severityScore: z2.number().nullish(),
  blocked: z2.boolean().nullish()
});
var responseSchema = z2.object({
  candidates: z2.array(
    z2.object({
      content: contentSchema.nullish().or(z2.object({}).strict()),
      finishReason: z2.string().nullish(),
      safetyRatings: z2.array(safetyRatingSchema).nullish(),
      groundingMetadata: groundingMetadataSchema.nullish()
    })
  ),
  usageMetadata: z2.object({
    promptTokenCount: z2.number().nullish(),
    candidatesTokenCount: z2.number().nullish(),
    totalTokenCount: z2.number().nullish()
  }).nullish()
});
var chunkSchema = z2.object({
  candidates: z2.array(
    z2.object({
      content: contentSchema.nullish(),
      finishReason: z2.string().nullish(),
      safetyRatings: z2.array(safetyRatingSchema).nullish(),
      groundingMetadata: groundingMetadataSchema.nullish()
    })
  ).nullish(),
  usageMetadata: z2.object({
    promptTokenCount: z2.number().nullish(),
    candidatesTokenCount: z2.number().nullish(),
    totalTokenCount: z2.number().nullish()
  }).nullish()
});
var googleGenerativeAIProviderOptionsSchema = z2.object({
  responseModalities: z2.array(z2.enum(["TEXT", "IMAGE"])).nullish(),
  thinkingConfig: z2.object({
    thinkingBudget: z2.number().nullish(),
    includeThoughts: z2.boolean().nullish()
  }).nullish()
});
export {
  GoogleGenerativeAILanguageModel,
  groundingMetadataSchema,
  safetyRatingSchema
};
//# sourceMappingURL=index.mjs.map