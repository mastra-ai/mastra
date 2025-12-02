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
  OpenAICompatibleChatLanguageModel: () => OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel: () => OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel: () => OpenAICompatibleEmbeddingModel,
  OpenAICompatibleImageModel: () => OpenAICompatibleImageModel,
  createOpenAICompatible: () => createOpenAICompatible
});
module.exports = __toCommonJS(src_exports);

// src/openai-compatible-chat-language-model.ts
var import_provider3 = require("@ai-sdk/provider");
var import_provider_utils2 = require("@ai-sdk/provider-utils");
var import_zod2 = require("zod");

// src/convert-to-openai-compatible-chat-messages.ts
var import_provider = require("@ai-sdk/provider");
var import_provider_utils = require("@ai-sdk/provider-utils");
function getOpenAIMetadata(message) {
  var _a, _b;
  return (_b = (_a = message == null ? void 0 : message.providerMetadata) == null ? void 0 : _a.openaiCompatible) != null ? _b : {};
}
function convertToOpenAICompatibleChatMessages(prompt) {
  const messages = [];
  for (const { role, content, ...message } of prompt) {
    const metadata = getOpenAIMetadata({ ...message });
    switch (role) {
      case "system": {
        messages.push({ role: "system", content, ...metadata });
        break;
      }
      case "user": {
        if (content.length === 1 && content[0].type === "text") {
          messages.push({
            role: "user",
            content: content[0].text,
            ...getOpenAIMetadata(content[0])
          });
          break;
        }
        messages.push({
          role: "user",
          content: content.map((part) => {
            var _a;
            const partMetadata = getOpenAIMetadata(part);
            switch (part.type) {
              case "text": {
                return { type: "text", text: part.text, ...partMetadata };
              }
              case "image": {
                return {
                  type: "image_url",
                  image_url: {
                    url: part.image instanceof URL ? part.image.toString() : `data:${(_a = part.mimeType) != null ? _a : "image/jpeg"};base64,${(0, import_provider_utils.convertUint8ArrayToBase64)(part.image)}`
                  },
                  ...partMetadata
                };
              }
              case "file": {
                throw new import_provider.UnsupportedFunctionalityError({
                  functionality: "File content parts in user messages"
                });
              }
            }
          }),
          ...metadata
        });
        break;
      }
      case "assistant": {
        let text = "";
        const toolCalls = [];
        for (const part of content) {
          const partMetadata = getOpenAIMetadata(part);
          switch (part.type) {
            case "text": {
              text += part.text;
              break;
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.args)
                },
                ...partMetadata
              });
              break;
            }
          }
        }
        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : void 0,
          ...metadata
        });
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          const toolResponseMetadata = getOpenAIMetadata(toolResponse);
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: JSON.stringify(toolResponse.result),
            ...toolResponseMetadata
          });
        }
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  return messages;
}

// src/get-response-metadata.ts
function getResponseMetadata({
  id,
  model,
  created
}) {
  return {
    id: id != null ? id : void 0,
    modelId: model != null ? model : void 0,
    timestamp: created != null ? new Date(created * 1e3) : void 0
  };
}

// src/map-openai-compatible-finish-reason.ts
function mapOpenAICompatibleFinishReason(finishReason) {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    case "function_call":
    case "tool_calls":
      return "tool-calls";
    default:
      return "unknown";
  }
}

// src/openai-compatible-error.ts
var import_zod = require("zod");
var openaiCompatibleErrorDataSchema = import_zod.z.object({
  error: import_zod.z.object({
    message: import_zod.z.string(),
    // The additional information below is handled loosely to support
    // OpenAI-compatible providers that have slightly different error
    // responses:
    type: import_zod.z.string().nullish(),
    param: import_zod.z.any().nullish(),
    code: import_zod.z.union([import_zod.z.string(), import_zod.z.number()]).nullish()
  })
});
var defaultOpenAICompatibleErrorStructure = {
  errorSchema: openaiCompatibleErrorDataSchema,
  errorToMessage: (data) => data.error.message
};

// src/openai-compatible-prepare-tools.ts
var import_provider2 = require("@ai-sdk/provider");
function prepareTools({
  mode,
  structuredOutputs
}) {
  var _a;
  const tools = ((_a = mode.tools) == null ? void 0 : _a.length) ? mode.tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, tool_choice: void 0, toolWarnings };
  }
  const toolChoice = mode.toolChoice;
  const openaiCompatTools = [];
  for (const tool of tools) {
    if (tool.type === "provider-defined") {
      toolWarnings.push({ type: "unsupported-tool", tool });
    } else {
      openaiCompatTools.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      });
    }
  }
  if (toolChoice == null) {
    return { tools: openaiCompatTools, tool_choice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiCompatTools, tool_choice: type, toolWarnings };
    case "tool":
      return {
        tools: openaiCompatTools,
        tool_choice: {
          type: "function",
          function: {
            name: toolChoice.toolName
          }
        },
        toolWarnings
      };
    default: {
      const _exhaustiveCheck = type;
      throw new import_provider2.UnsupportedFunctionalityError({
        functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/openai-compatible-chat-language-model.ts
var OpenAICompatibleChatLanguageModel = class {
  // type inferred via constructor
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    var _a, _b;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    const errorStructure = (_a = config.errorStructure) != null ? _a : defaultOpenAICompatibleErrorStructure;
    this.chunkSchema = createOpenAICompatibleChatChunkSchema(
      errorStructure.errorSchema
    );
    this.failedResponseHandler = (0, import_provider_utils2.createJsonErrorResponseHandler)(errorStructure);
    this.supportsStructuredOutputs = (_b = config.supportsStructuredOutputs) != null ? _b : false;
  }
  get defaultObjectGenerationMode() {
    return this.config.defaultObjectGenerationMode;
  }
  get provider() {
    return this.config.provider;
  }
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
  }
  getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    providerMetadata,
    stopSequences,
    responseFormat,
    seed
  }) {
    var _a, _b, _c, _d, _e;
    const type = mode.type;
    const warnings = [];
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if ((responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null && !this.supportsStructuredOutputs) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format schema is only supported with structuredOutputs"
      });
    }
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      user: this.settings.user,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? this.supportsStructuredOutputs === true && responseFormat.schema != null ? {
        type: "json_schema",
        json_schema: {
          schema: responseFormat.schema,
          name: (_a = responseFormat.name) != null ? _a : "response",
          description: responseFormat.description
        }
      } : { type: "json_object" } : void 0,
      stop: stopSequences,
      seed,
      ...providerMetadata == null ? void 0 : providerMetadata[this.providerOptionsName],
      reasoning_effort: (_d = (_b = providerMetadata == null ? void 0 : providerMetadata[this.providerOptionsName]) == null ? void 0 : _b.reasoningEffort) != null ? _d : (_c = providerMetadata == null ? void 0 : providerMetadata["openai-compatible"]) == null ? void 0 : _c.reasoningEffort,
      // messages:
      messages: convertToOpenAICompatibleChatMessages(prompt)
    };
    switch (type) {
      case "regular": {
        const { tools, tool_choice, toolWarnings } = prepareTools({
          mode,
          structuredOutputs: this.supportsStructuredOutputs
        });
        return {
          args: { ...baseArgs, tools, tool_choice },
          warnings: [...warnings, ...toolWarnings]
        };
      }
      case "object-json": {
        return {
          args: {
            ...baseArgs,
            response_format: this.supportsStructuredOutputs === true && mode.schema != null ? {
              type: "json_schema",
              json_schema: {
                schema: mode.schema,
                name: (_e = mode.name) != null ? _e : "response",
                description: mode.description
              }
            } : { type: "json_object" }
          },
          warnings
        };
      }
      case "object-tool": {
        return {
          args: {
            ...baseArgs,
            tool_choice: {
              type: "function",
              function: { name: mode.tool.name }
            },
            tools: [
              {
                type: "function",
                function: {
                  name: mode.tool.name,
                  description: mode.tool.description,
                  parameters: mode.tool.parameters
                }
              }
            ]
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
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const { args, warnings } = this.getArgs({ ...options });
    const body = JSON.stringify(args);
    const {
      responseHeaders,
      value: responseBody,
      rawValue: rawResponse
    } = await (0, import_provider_utils2.postJsonToApi)({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils2.combineHeaders)(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils2.createJsonResponseHandler)(
        OpenAICompatibleChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { messages: rawPrompt, ...rawSettings } = args;
    const choice = responseBody.choices[0];
    const providerMetadata = {
      [this.providerOptionsName]: {},
      ...(_b = (_a = this.config.metadataExtractor) == null ? void 0 : _a.extractMetadata) == null ? void 0 : _b.call(_a, {
        parsedBody: rawResponse
      })
    };
    const completionTokenDetails = (_c = responseBody.usage) == null ? void 0 : _c.completion_tokens_details;
    const promptTokenDetails = (_d = responseBody.usage) == null ? void 0 : _d.prompt_tokens_details;
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.reasoning_tokens) != null) {
      providerMetadata[this.providerOptionsName].reasoningTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.reasoning_tokens;
    }
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens) != null) {
      providerMetadata[this.providerOptionsName].acceptedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens;
    }
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens) != null) {
      providerMetadata[this.providerOptionsName].rejectedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens;
    }
    if ((promptTokenDetails == null ? void 0 : promptTokenDetails.cached_tokens) != null) {
      providerMetadata[this.providerOptionsName].cachedPromptTokens = promptTokenDetails == null ? void 0 : promptTokenDetails.cached_tokens;
    }
    return {
      text: (_e = choice.message.content) != null ? _e : void 0,
      reasoning: (_f = choice.message.reasoning_content) != null ? _f : void 0,
      toolCalls: (_g = choice.message.tool_calls) == null ? void 0 : _g.map((toolCall) => {
        var _a2;
        return {
          toolCallType: "function",
          toolCallId: (_a2 = toolCall.id) != null ? _a2 : (0, import_provider_utils2.generateId)(),
          toolName: toolCall.function.name,
          args: toolCall.function.arguments
        };
      }),
      finishReason: mapOpenAICompatibleFinishReason(choice.finish_reason),
      usage: {
        promptTokens: (_i = (_h = responseBody.usage) == null ? void 0 : _h.prompt_tokens) != null ? _i : NaN,
        completionTokens: (_k = (_j = responseBody.usage) == null ? void 0 : _j.completion_tokens) != null ? _k : NaN
      },
      providerMetadata,
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders, body: rawResponse },
      response: getResponseMetadata(responseBody),
      warnings,
      request: { body }
    };
  }
  async doStream(options) {
    var _a;
    if (this.settings.simulateStreaming) {
      const result = await this.doGenerate(options);
      const simulatedStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "response-metadata", ...result.response });
          if (result.reasoning) {
            if (Array.isArray(result.reasoning)) {
              for (const part of result.reasoning) {
                if (part.type === "text") {
                  controller.enqueue({
                    type: "reasoning",
                    textDelta: part.text
                  });
                }
              }
            } else {
              controller.enqueue({
                type: "reasoning",
                textDelta: result.reasoning
              });
            }
          }
          if (result.text) {
            controller.enqueue({
              type: "text-delta",
              textDelta: result.text
            });
          }
          if (result.toolCalls) {
            for (const toolCall of result.toolCalls) {
              controller.enqueue({
                type: "tool-call",
                ...toolCall
              });
            }
          }
          controller.enqueue({
            type: "finish",
            finishReason: result.finishReason,
            usage: result.usage,
            logprobs: result.logprobs,
            providerMetadata: result.providerMetadata
          });
          controller.close();
        }
      });
      return {
        stream: simulatedStream,
        rawCall: result.rawCall,
        rawResponse: result.rawResponse,
        warnings: result.warnings
      };
    }
    const { args, warnings } = this.getArgs({ ...options });
    const body = {
      ...args,
      stream: true,
      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage ? { include_usage: true } : void 0
    };
    const metadataExtractor = (_a = this.config.metadataExtractor) == null ? void 0 : _a.createStreamExtractor();
    const { responseHeaders, value: response } = await (0, import_provider_utils2.postJsonToApi)({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils2.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils2.createEventSourceResponseHandler)(
        this.chunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { messages: rawPrompt, ...rawSettings } = args;
    const toolCalls = [];
    let finishReason = "unknown";
    let usage = {
      completionTokens: void 0,
      completionTokensDetails: {
        reasoningTokens: void 0,
        acceptedPredictionTokens: void 0,
        rejectedPredictionTokens: void 0
      },
      promptTokens: void 0,
      promptTokensDetails: {
        cachedTokens: void 0
      }
    };
    let isFirstChunk = true;
    let providerOptionsName = this.providerOptionsName;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          // TODO we lost type safety on Chunk, most likely due to the error schema. MUST FIX
          transform(chunk, controller) {
            var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
            if (!chunk.success) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            metadataExtractor == null ? void 0 : metadataExtractor.processChunk(chunk.rawValue);
            if ("error" in value) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: value.error.message });
              return;
            }
            if (isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value)
              });
            }
            if (value.usage != null) {
              const {
                prompt_tokens,
                completion_tokens,
                prompt_tokens_details,
                completion_tokens_details
              } = value.usage;
              usage.promptTokens = prompt_tokens != null ? prompt_tokens : void 0;
              usage.completionTokens = completion_tokens != null ? completion_tokens : void 0;
              if ((completion_tokens_details == null ? void 0 : completion_tokens_details.reasoning_tokens) != null) {
                usage.completionTokensDetails.reasoningTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.reasoning_tokens;
              }
              if ((completion_tokens_details == null ? void 0 : completion_tokens_details.accepted_prediction_tokens) != null) {
                usage.completionTokensDetails.acceptedPredictionTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.accepted_prediction_tokens;
              }
              if ((completion_tokens_details == null ? void 0 : completion_tokens_details.rejected_prediction_tokens) != null) {
                usage.completionTokensDetails.rejectedPredictionTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.rejected_prediction_tokens;
              }
              if ((prompt_tokens_details == null ? void 0 : prompt_tokens_details.cached_tokens) != null) {
                usage.promptTokensDetails.cachedTokens = prompt_tokens_details == null ? void 0 : prompt_tokens_details.cached_tokens;
              }
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapOpenAICompatibleFinishReason(
                choice.finish_reason
              );
            }
            if ((choice == null ? void 0 : choice.delta) == null) {
              return;
            }
            const delta = choice.delta;
            if (delta.reasoning_content != null) {
              controller.enqueue({
                type: "reasoning",
                textDelta: delta.reasoning_content
              });
            }
            if (delta.content != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: delta.content
              });
            }
            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;
                if (toolCalls[index] == null) {
                  if (toolCallDelta.type !== "function") {
                    throw new import_provider3.InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`
                    });
                  }
                  if (toolCallDelta.id == null) {
                    throw new import_provider3.InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`
                    });
                  }
                  if (((_a2 = toolCallDelta.function) == null ? void 0 : _a2.name) == null) {
                    throw new import_provider3.InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`
                    });
                  }
                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: "function",
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: (_b = toolCallDelta.function.arguments) != null ? _b : ""
                    },
                    hasFinished: false
                  };
                  const toolCall2 = toolCalls[index];
                  if (((_c = toolCall2.function) == null ? void 0 : _c.name) != null && ((_d = toolCall2.function) == null ? void 0 : _d.arguments) != null) {
                    if (toolCall2.function.arguments.length > 0) {
                      controller.enqueue({
                        type: "tool-call-delta",
                        toolCallType: "function",
                        toolCallId: toolCall2.id,
                        toolName: toolCall2.function.name,
                        argsTextDelta: toolCall2.function.arguments
                      });
                    }
                    if ((0, import_provider_utils2.isParsableJson)(toolCall2.function.arguments)) {
                      controller.enqueue({
                        type: "tool-call",
                        toolCallType: "function",
                        toolCallId: (_e = toolCall2.id) != null ? _e : (0, import_provider_utils2.generateId)(),
                        toolName: toolCall2.function.name,
                        args: toolCall2.function.arguments
                      });
                      toolCall2.hasFinished = true;
                    }
                  }
                  continue;
                }
                const toolCall = toolCalls[index];
                if (toolCall.hasFinished) {
                  continue;
                }
                if (((_f = toolCallDelta.function) == null ? void 0 : _f.arguments) != null) {
                  toolCall.function.arguments += (_h = (_g = toolCallDelta.function) == null ? void 0 : _g.arguments) != null ? _h : "";
                }
                controller.enqueue({
                  type: "tool-call-delta",
                  toolCallType: "function",
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  argsTextDelta: (_i = toolCallDelta.function.arguments) != null ? _i : ""
                });
                if (((_j = toolCall.function) == null ? void 0 : _j.name) != null && ((_k = toolCall.function) == null ? void 0 : _k.arguments) != null && (0, import_provider_utils2.isParsableJson)(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallType: "function",
                    toolCallId: (_l = toolCall.id) != null ? _l : (0, import_provider_utils2.generateId)(),
                    toolName: toolCall.function.name,
                    args: toolCall.function.arguments
                  });
                  toolCall.hasFinished = true;
                }
              }
            }
          },
          flush(controller) {
            var _a2, _b;
            const providerMetadata = {
              [providerOptionsName]: {},
              ...metadataExtractor == null ? void 0 : metadataExtractor.buildMetadata()
            };
            if (usage.completionTokensDetails.reasoningTokens != null) {
              providerMetadata[providerOptionsName].reasoningTokens = usage.completionTokensDetails.reasoningTokens;
            }
            if (usage.completionTokensDetails.acceptedPredictionTokens != null) {
              providerMetadata[providerOptionsName].acceptedPredictionTokens = usage.completionTokensDetails.acceptedPredictionTokens;
            }
            if (usage.completionTokensDetails.rejectedPredictionTokens != null) {
              providerMetadata[providerOptionsName].rejectedPredictionTokens = usage.completionTokensDetails.rejectedPredictionTokens;
            }
            if (usage.promptTokensDetails.cachedTokens != null) {
              providerMetadata[providerOptionsName].cachedPromptTokens = usage.promptTokensDetails.cachedTokens;
            }
            controller.enqueue({
              type: "finish",
              finishReason,
              usage: {
                promptTokens: (_a2 = usage.promptTokens) != null ? _a2 : NaN,
                completionTokens: (_b = usage.completionTokens) != null ? _b : NaN
              },
              providerMetadata
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings,
      request: { body: JSON.stringify(body) }
    };
  }
};
var openaiCompatibleTokenUsageSchema = import_zod2.z.object({
  prompt_tokens: import_zod2.z.number().nullish(),
  completion_tokens: import_zod2.z.number().nullish(),
  prompt_tokens_details: import_zod2.z.object({
    cached_tokens: import_zod2.z.number().nullish()
  }).nullish(),
  completion_tokens_details: import_zod2.z.object({
    reasoning_tokens: import_zod2.z.number().nullish(),
    accepted_prediction_tokens: import_zod2.z.number().nullish(),
    rejected_prediction_tokens: import_zod2.z.number().nullish()
  }).nullish()
}).nullish();
var OpenAICompatibleChatResponseSchema = import_zod2.z.object({
  id: import_zod2.z.string().nullish(),
  created: import_zod2.z.number().nullish(),
  model: import_zod2.z.string().nullish(),
  choices: import_zod2.z.array(
    import_zod2.z.object({
      message: import_zod2.z.object({
        role: import_zod2.z.literal("assistant").nullish(),
        content: import_zod2.z.string().nullish(),
        reasoning_content: import_zod2.z.string().nullish(),
        tool_calls: import_zod2.z.array(
          import_zod2.z.object({
            id: import_zod2.z.string().nullish(),
            type: import_zod2.z.literal("function"),
            function: import_zod2.z.object({
              name: import_zod2.z.string(),
              arguments: import_zod2.z.string()
            })
          })
        ).nullish()
      }),
      finish_reason: import_zod2.z.string().nullish()
    })
  ),
  usage: openaiCompatibleTokenUsageSchema
});
var createOpenAICompatibleChatChunkSchema = (errorSchema) => import_zod2.z.union([
  import_zod2.z.object({
    id: import_zod2.z.string().nullish(),
    created: import_zod2.z.number().nullish(),
    model: import_zod2.z.string().nullish(),
    choices: import_zod2.z.array(
      import_zod2.z.object({
        delta: import_zod2.z.object({
          role: import_zod2.z.enum(["assistant"]).nullish(),
          content: import_zod2.z.string().nullish(),
          reasoning_content: import_zod2.z.string().nullish(),
          tool_calls: import_zod2.z.array(
            import_zod2.z.object({
              index: import_zod2.z.number().optional(),
              id: import_zod2.z.string().nullish(),
              type: import_zod2.z.literal("function").nullish(),
              function: import_zod2.z.object({
                name: import_zod2.z.string().nullish(),
                arguments: import_zod2.z.string().nullish()
              })
            })
          ).nullish()
        }).nullish(),
        finish_reason: import_zod2.z.string().nullish()
      })
    ),
    usage: openaiCompatibleTokenUsageSchema
  }),
  errorSchema
]);

// src/openai-compatible-completion-language-model.ts
var import_provider5 = require("@ai-sdk/provider");
var import_provider_utils3 = require("@ai-sdk/provider-utils");
var import_zod3 = require("zod");

// src/convert-to-openai-compatible-completion-prompt.ts
var import_provider4 = require("@ai-sdk/provider");
function convertToOpenAICompatibleCompletionPrompt({
  prompt,
  inputFormat,
  user = "user",
  assistant = "assistant"
}) {
  if (inputFormat === "prompt" && prompt.length === 1 && prompt[0].role === "user" && prompt[0].content.length === 1 && prompt[0].content[0].type === "text") {
    return { prompt: prompt[0].content[0].text };
  }
  let text = "";
  if (prompt[0].role === "system") {
    text += `${prompt[0].content}

`;
    prompt = prompt.slice(1);
  }
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        throw new import_provider4.InvalidPromptError({
          message: "Unexpected system message in prompt: ${content}",
          prompt
        });
      }
      case "user": {
        const userMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
            case "image": {
              throw new import_provider4.UnsupportedFunctionalityError({
                functionality: "images"
              });
            }
          }
        }).join("");
        text += `${user}:
${userMessage}

`;
        break;
      }
      case "assistant": {
        const assistantMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
            case "tool-call": {
              throw new import_provider4.UnsupportedFunctionalityError({
                functionality: "tool-call messages"
              });
            }
          }
        }).join("");
        text += `${assistant}:
${assistantMessage}

`;
        break;
      }
      case "tool": {
        throw new import_provider4.UnsupportedFunctionalityError({
          functionality: "tool messages"
        });
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  text += `${assistant}:
`;
  return {
    prompt: text,
    stopSequences: [`
${user}:`]
  };
}

// src/openai-compatible-completion-language-model.ts
var OpenAICompatibleCompletionLanguageModel = class {
  // type inferred via constructor
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.defaultObjectGenerationMode = void 0;
    var _a;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    const errorStructure = (_a = config.errorStructure) != null ? _a : defaultOpenAICompatibleErrorStructure;
    this.chunkSchema = createOpenAICompatibleCompletionChunkSchema(
      errorStructure.errorSchema
    );
    this.failedResponseHandler = (0, import_provider_utils3.createJsonErrorResponseHandler)(errorStructure);
  }
  get provider() {
    return this.config.provider;
  }
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
  }
  getArgs({
    mode,
    inputFormat,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences: userStopSequences,
    responseFormat,
    seed,
    providerMetadata
  }) {
    var _a;
    const type = mode.type;
    const warnings = [];
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if (responseFormat != null && responseFormat.type !== "text") {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format is not supported."
      });
    }
    const { prompt: completionPrompt, stopSequences } = convertToOpenAICompatibleCompletionPrompt({ prompt, inputFormat });
    const stop = [...stopSequences != null ? stopSequences : [], ...userStopSequences != null ? userStopSequences : []];
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      echo: this.settings.echo,
      logit_bias: this.settings.logitBias,
      suffix: this.settings.suffix,
      user: this.settings.user,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,
      ...providerMetadata == null ? void 0 : providerMetadata[this.providerOptionsName],
      // prompt:
      prompt: completionPrompt,
      // stop sequences:
      stop: stop.length > 0 ? stop : void 0
    };
    switch (type) {
      case "regular": {
        if ((_a = mode.tools) == null ? void 0 : _a.length) {
          throw new import_provider5.UnsupportedFunctionalityError({
            functionality: "tools"
          });
        }
        if (mode.toolChoice) {
          throw new import_provider5.UnsupportedFunctionalityError({
            functionality: "toolChoice"
          });
        }
        return { args: baseArgs, warnings };
      }
      case "object-json": {
        throw new import_provider5.UnsupportedFunctionalityError({
          functionality: "object-json mode"
        });
      }
      case "object-tool": {
        throw new import_provider5.UnsupportedFunctionalityError({
          functionality: "object-tool mode"
        });
      }
      default: {
        const _exhaustiveCheck = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }
  async doGenerate(options) {
    var _a, _b, _c, _d;
    const { args, warnings } = this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils3.postJsonToApi)({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils3.combineHeaders)(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils3.createJsonResponseHandler)(
        openaiCompatibleCompletionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { prompt: rawPrompt, ...rawSettings } = args;
    const choice = response.choices[0];
    return {
      text: choice.text,
      usage: {
        promptTokens: (_b = (_a = response.usage) == null ? void 0 : _a.prompt_tokens) != null ? _b : NaN,
        completionTokens: (_d = (_c = response.usage) == null ? void 0 : _c.completion_tokens) != null ? _d : NaN
      },
      finishReason: mapOpenAICompatibleFinishReason(choice.finish_reason),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders, body: rawResponse },
      response: getResponseMetadata(response),
      warnings,
      request: { body: JSON.stringify(args) }
    };
  }
  async doStream(options) {
    const { args, warnings } = this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage ? { include_usage: true } : void 0
    };
    const { responseHeaders, value: response } = await (0, import_provider_utils3.postJsonToApi)({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils3.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils3.createEventSourceResponseHandler)(
        this.chunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { prompt: rawPrompt, ...rawSettings } = args;
    let finishReason = "unknown";
    let usage = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN
    };
    let isFirstChunk = true;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (!chunk.success) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if ("error" in value) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: value.error });
              return;
            }
            if (isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value)
              });
            }
            if (value.usage != null) {
              usage = {
                promptTokens: value.usage.prompt_tokens,
                completionTokens: value.usage.completion_tokens
              };
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapOpenAICompatibleFinishReason(
                choice.finish_reason
              );
            }
            if ((choice == null ? void 0 : choice.text) != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: choice.text
              });
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              usage
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings,
      request: { body: JSON.stringify(body) }
    };
  }
};
var openaiCompatibleCompletionResponseSchema = import_zod3.z.object({
  id: import_zod3.z.string().nullish(),
  created: import_zod3.z.number().nullish(),
  model: import_zod3.z.string().nullish(),
  choices: import_zod3.z.array(
    import_zod3.z.object({
      text: import_zod3.z.string(),
      finish_reason: import_zod3.z.string()
    })
  ),
  usage: import_zod3.z.object({
    prompt_tokens: import_zod3.z.number(),
    completion_tokens: import_zod3.z.number()
  }).nullish()
});
var createOpenAICompatibleCompletionChunkSchema = (errorSchema) => import_zod3.z.union([
  import_zod3.z.object({
    id: import_zod3.z.string().nullish(),
    created: import_zod3.z.number().nullish(),
    model: import_zod3.z.string().nullish(),
    choices: import_zod3.z.array(
      import_zod3.z.object({
        text: import_zod3.z.string(),
        finish_reason: import_zod3.z.string().nullish(),
        index: import_zod3.z.number()
      })
    ),
    usage: import_zod3.z.object({
      prompt_tokens: import_zod3.z.number(),
      completion_tokens: import_zod3.z.number()
    }).nullish()
  }),
  errorSchema
]);

// src/openai-compatible-embedding-model.ts
var import_provider6 = require("@ai-sdk/provider");
var import_provider_utils4 = require("@ai-sdk/provider-utils");
var import_zod4 = require("zod");
var OpenAICompatibleEmbeddingModel = class {
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  get maxEmbeddingsPerCall() {
    var _a;
    return (_a = this.config.maxEmbeddingsPerCall) != null ? _a : 2048;
  }
  get supportsParallelCalls() {
    var _a;
    return (_a = this.config.supportsParallelCalls) != null ? _a : true;
  }
  async doEmbed({
    values,
    headers,
    abortSignal
  }) {
    var _a;
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new import_provider6.TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      });
    }
    const { responseHeaders, value: response } = await (0, import_provider_utils4.postJsonToApi)({
      url: this.config.url({
        path: "/embeddings",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils4.combineHeaders)(this.config.headers(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: "float",
        dimensions: this.settings.dimensions,
        user: this.settings.user
      },
      failedResponseHandler: (0, import_provider_utils4.createJsonErrorResponseHandler)(
        (_a = this.config.errorStructure) != null ? _a : defaultOpenAICompatibleErrorStructure
      ),
      successfulResponseHandler: (0, import_provider_utils4.createJsonResponseHandler)(
        openaiTextEmbeddingResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      embeddings: response.data.map((item) => item.embedding),
      usage: response.usage ? { tokens: response.usage.prompt_tokens } : void 0,
      rawResponse: { headers: responseHeaders }
    };
  }
};
var openaiTextEmbeddingResponseSchema = import_zod4.z.object({
  data: import_zod4.z.array(import_zod4.z.object({ embedding: import_zod4.z.array(import_zod4.z.number()) })),
  usage: import_zod4.z.object({ prompt_tokens: import_zod4.z.number() }).nullish()
});

// src/openai-compatible-image-model.ts
var import_provider_utils5 = require("@ai-sdk/provider-utils");
var import_zod5 = require("zod");
var OpenAICompatibleImageModel = class {
  constructor(modelId, settings, config) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.specificationVersion = "v1";
  }
  get maxImagesPerCall() {
    var _a;
    return (_a = this.settings.maxImagesPerCall) != null ? _a : 10;
  }
  get provider() {
    return this.config.provider;
  }
  async doGenerate({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal
  }) {
    var _a, _b, _c, _d, _e;
    const warnings = [];
    if (aspectRatio != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "aspectRatio",
        details: "This model does not support aspect ratio. Use `size` instead."
      });
    }
    if (seed != null) {
      warnings.push({ type: "unsupported-setting", setting: "seed" });
    }
    const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
    const { value: response, responseHeaders } = await (0, import_provider_utils5.postJsonToApi)({
      url: this.config.url({
        path: "/images/generations",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils5.combineHeaders)(this.config.headers(), headers),
      body: {
        model: this.modelId,
        prompt,
        n,
        size,
        ...(_d = providerOptions.openai) != null ? _d : {},
        response_format: "b64_json",
        ...this.settings.user ? { user: this.settings.user } : {}
      },
      failedResponseHandler: (0, import_provider_utils5.createJsonErrorResponseHandler)(
        (_e = this.config.errorStructure) != null ? _e : defaultOpenAICompatibleErrorStructure
      ),
      successfulResponseHandler: (0, import_provider_utils5.createJsonResponseHandler)(
        openaiCompatibleImageResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      images: response.data.map((item) => item.b64_json),
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders
      }
    };
  }
};
var openaiCompatibleImageResponseSchema = import_zod5.z.object({
  data: import_zod5.z.array(import_zod5.z.object({ b64_json: import_zod5.z.string() }))
});

// src/openai-compatible-provider.ts
var import_provider_utils6 = require("@ai-sdk/provider-utils");
function createOpenAICompatible(options) {
  const baseURL = (0, import_provider_utils6.withoutTrailingSlash)(options.baseURL);
  const providerName = options.name;
  const getHeaders = () => ({
    ...options.apiKey && { Authorization: `Bearer ${options.apiKey}` },
    ...options.headers
  });
  const getCommonModelConfig = (modelType) => ({
    provider: `${providerName}.${modelType}`,
    url: ({ path }) => {
      const url = new URL(`${baseURL}${path}`);
      if (options.queryParams) {
        url.search = new URLSearchParams(options.queryParams).toString();
      }
      return url.toString();
    },
    headers: getHeaders,
    fetch: options.fetch
  });
  const createLanguageModel = (modelId, settings = {}, config) => createChatModel(modelId, settings, config);
  const createChatModel = (modelId, settings = {}, config) => new OpenAICompatibleChatLanguageModel(modelId, settings, {
    ...getCommonModelConfig("chat"),
    defaultObjectGenerationMode: "tool",
    ...config
  });
  const createCompletionModel = (modelId, settings = {}) => new OpenAICompatibleCompletionLanguageModel(
    modelId,
    settings,
    getCommonModelConfig("completion")
  );
  const createEmbeddingModel = (modelId, settings = {}) => new OpenAICompatibleEmbeddingModel(
    modelId,
    settings,
    getCommonModelConfig("embedding")
  );
  const createImageModel = (modelId, settings = {}) => new OpenAICompatibleImageModel(
    modelId,
    settings,
    getCommonModelConfig("image")
  );
  const provider = (modelId, settings, config) => createLanguageModel(modelId, settings, config);
  provider.languageModel = createLanguageModel;
  provider.chatModel = createChatModel;
  provider.completionModel = createCompletionModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.imageModel = createImageModel;
  return provider;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
  OpenAICompatibleImageModel,
  createOpenAICompatible
});
//# sourceMappingURL=index.js.map