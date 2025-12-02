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

// src/internal/index.ts
var internal_exports = {};
__export(internal_exports, {
  OpenAIChatLanguageModel: () => OpenAIChatLanguageModel,
  OpenAICompletionLanguageModel: () => OpenAICompletionLanguageModel,
  OpenAIEmbeddingModel: () => OpenAIEmbeddingModel,
  OpenAIImageModel: () => OpenAIImageModel,
  OpenAIResponsesLanguageModel: () => OpenAIResponsesLanguageModel,
  OpenAISpeechModel: () => OpenAISpeechModel,
  OpenAITranscriptionModel: () => OpenAITranscriptionModel,
  hasDefaultResponseFormat: () => hasDefaultResponseFormat,
  modelMaxImagesPerCall: () => modelMaxImagesPerCall
});
module.exports = __toCommonJS(internal_exports);

// src/openai-chat-language-model.ts
var import_provider3 = require("@ai-sdk/provider");
var import_provider_utils3 = require("@ai-sdk/provider-utils");
var import_zod2 = require("zod");

// src/convert-to-openai-chat-messages.ts
var import_provider = require("@ai-sdk/provider");
var import_provider_utils = require("@ai-sdk/provider-utils");
function convertToOpenAIChatMessages({
  prompt,
  useLegacyFunctionCalling = false,
  systemMessageMode = "system"
}) {
  const messages = [];
  const warnings = [];
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        switch (systemMessageMode) {
          case "system": {
            messages.push({ role: "system", content });
            break;
          }
          case "developer": {
            messages.push({ role: "developer", content });
            break;
          }
          case "remove": {
            warnings.push({
              type: "other",
              message: "system messages are removed for this model"
            });
            break;
          }
          default: {
            const _exhaustiveCheck = systemMessageMode;
            throw new Error(
              `Unsupported system message mode: ${_exhaustiveCheck}`
            );
          }
        }
        break;
      }
      case "user": {
        if (content.length === 1 && content[0].type === "text") {
          messages.push({ role: "user", content: content[0].text });
          break;
        }
        messages.push({
          role: "user",
          content: content.map((part, index) => {
            var _a, _b, _c, _d;
            switch (part.type) {
              case "text": {
                return { type: "text", text: part.text };
              }
              case "image": {
                return {
                  type: "image_url",
                  image_url: {
                    url: part.image instanceof URL ? part.image.toString() : `data:${(_a = part.mimeType) != null ? _a : "image/jpeg"};base64,${(0, import_provider_utils.convertUint8ArrayToBase64)(part.image)}`,
                    // OpenAI specific extension: image detail
                    detail: (_c = (_b = part.providerMetadata) == null ? void 0 : _b.openai) == null ? void 0 : _c.imageDetail
                  }
                };
              }
              case "file": {
                if (part.data instanceof URL) {
                  throw new import_provider.UnsupportedFunctionalityError({
                    functionality: "'File content parts with URL data' functionality not supported."
                  });
                }
                switch (part.mimeType) {
                  case "audio/wav": {
                    return {
                      type: "input_audio",
                      input_audio: { data: part.data, format: "wav" }
                    };
                  }
                  case "audio/mp3":
                  case "audio/mpeg": {
                    return {
                      type: "input_audio",
                      input_audio: { data: part.data, format: "mp3" }
                    };
                  }
                  case "application/pdf": {
                    return {
                      type: "file",
                      file: {
                        filename: (_d = part.filename) != null ? _d : `part-${index}.pdf`,
                        file_data: `data:application/pdf;base64,${part.data}`
                      }
                    };
                  }
                  default: {
                    throw new import_provider.UnsupportedFunctionalityError({
                      functionality: `File content part type ${part.mimeType} in user messages`
                    });
                  }
                }
              }
            }
          })
        });
        break;
      }
      case "assistant": {
        let text = "";
        const toolCalls = [];
        for (const part of content) {
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
                }
              });
              break;
            }
          }
        }
        if (useLegacyFunctionCalling) {
          if (toolCalls.length > 1) {
            throw new import_provider.UnsupportedFunctionalityError({
              functionality: "useLegacyFunctionCalling with multiple tool calls in one message"
            });
          }
          messages.push({
            role: "assistant",
            content: text,
            function_call: toolCalls.length > 0 ? toolCalls[0].function : void 0
          });
        } else {
          messages.push({
            role: "assistant",
            content: text,
            tool_calls: toolCalls.length > 0 ? toolCalls : void 0
          });
        }
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          if (useLegacyFunctionCalling) {
            messages.push({
              role: "function",
              name: toolResponse.toolName,
              content: JSON.stringify(toolResponse.result)
            });
          } else {
            messages.push({
              role: "tool",
              tool_call_id: toolResponse.toolCallId,
              content: JSON.stringify(toolResponse.result)
            });
          }
        }
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  return { messages, warnings };
}

// src/map-openai-chat-logprobs.ts
function mapOpenAIChatLogProbsOutput(logprobs) {
  var _a, _b;
  return (_b = (_a = logprobs == null ? void 0 : logprobs.content) == null ? void 0 : _a.map(({ token, logprob, top_logprobs }) => ({
    token,
    logprob,
    topLogprobs: top_logprobs ? top_logprobs.map(({ token: token2, logprob: logprob2 }) => ({
      token: token2,
      logprob: logprob2
    })) : []
  }))) != null ? _b : void 0;
}

// src/map-openai-finish-reason.ts
function mapOpenAIFinishReason(finishReason) {
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

// src/openai-error.ts
var import_zod = require("zod");
var import_provider_utils2 = require("@ai-sdk/provider-utils");
var openaiErrorDataSchema = import_zod.z.object({
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
var openaiFailedResponseHandler = (0, import_provider_utils2.createJsonErrorResponseHandler)({
  errorSchema: openaiErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

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

// src/openai-prepare-tools.ts
var import_provider2 = require("@ai-sdk/provider");
function prepareTools({
  mode,
  useLegacyFunctionCalling = false,
  structuredOutputs
}) {
  var _a;
  const tools = ((_a = mode.tools) == null ? void 0 : _a.length) ? mode.tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, tool_choice: void 0, toolWarnings };
  }
  const toolChoice = mode.toolChoice;
  if (useLegacyFunctionCalling) {
    const openaiFunctions = [];
    for (const tool of tools) {
      if (tool.type === "provider-defined") {
        toolWarnings.push({ type: "unsupported-tool", tool });
      } else {
        openaiFunctions.push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        });
      }
    }
    if (toolChoice == null) {
      return {
        functions: openaiFunctions,
        function_call: void 0,
        toolWarnings
      };
    }
    const type2 = toolChoice.type;
    switch (type2) {
      case "auto":
      case "none":
      case void 0:
        return {
          functions: openaiFunctions,
          function_call: void 0,
          toolWarnings
        };
      case "required":
        throw new import_provider2.UnsupportedFunctionalityError({
          functionality: "useLegacyFunctionCalling and toolChoice: required"
        });
      default:
        return {
          functions: openaiFunctions,
          function_call: { name: toolChoice.toolName },
          toolWarnings
        };
    }
  }
  const openaiTools = [];
  for (const tool of tools) {
    if (tool.type === "provider-defined") {
      toolWarnings.push({ type: "unsupported-tool", tool });
    } else {
      openaiTools.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          strict: structuredOutputs ? true : void 0
        }
      });
    }
  }
  if (toolChoice == null) {
    return { tools: openaiTools, tool_choice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiTools, tool_choice: type, toolWarnings };
    case "tool":
      return {
        tools: openaiTools,
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

// src/openai-chat-language-model.ts
var OpenAIChatLanguageModel = class {
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get supportsStructuredOutputs() {
    var _a;
    return (_a = this.settings.structuredOutputs) != null ? _a : isReasoningModel(this.modelId);
  }
  get defaultObjectGenerationMode() {
    if (isAudioModel(this.modelId)) {
      return "tool";
    }
    return this.supportsStructuredOutputs ? "json" : "tool";
  }
  get provider() {
    return this.config.provider;
  }
  get supportsImageUrls() {
    return !this.settings.downloadImages;
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
    stopSequences,
    responseFormat,
    seed,
    providerMetadata
  }) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
    const useLegacyFunctionCalling = this.settings.useLegacyFunctionCalling;
    if (useLegacyFunctionCalling && this.settings.parallelToolCalls === true) {
      throw new import_provider3.UnsupportedFunctionalityError({
        functionality: "useLegacyFunctionCalling with parallelToolCalls"
      });
    }
    if (useLegacyFunctionCalling && this.supportsStructuredOutputs) {
      throw new import_provider3.UnsupportedFunctionalityError({
        functionality: "structuredOutputs with useLegacyFunctionCalling"
      });
    }
    const { messages, warnings: messageWarnings } = convertToOpenAIChatMessages(
      {
        prompt,
        useLegacyFunctionCalling,
        systemMessageMode: getSystemMessageMode(this.modelId)
      }
    );
    warnings.push(...messageWarnings);
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      logit_bias: this.settings.logitBias,
      logprobs: this.settings.logprobs === true || typeof this.settings.logprobs === "number" ? true : void 0,
      top_logprobs: typeof this.settings.logprobs === "number" ? this.settings.logprobs : typeof this.settings.logprobs === "boolean" ? this.settings.logprobs ? 0 : void 0 : void 0,
      user: this.settings.user,
      parallel_tool_calls: this.settings.parallelToolCalls,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? this.supportsStructuredOutputs && responseFormat.schema != null ? {
        type: "json_schema",
        json_schema: {
          schema: responseFormat.schema,
          strict: true,
          name: (_a = responseFormat.name) != null ? _a : "response",
          description: responseFormat.description
        }
      } : { type: "json_object" } : void 0,
      stop: stopSequences,
      seed,
      // openai specific settings:
      // TODO remove in next major version; we auto-map maxTokens now
      max_completion_tokens: (_b = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _b.maxCompletionTokens,
      store: (_c = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _c.store,
      metadata: (_d = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _d.metadata,
      prediction: (_e = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _e.prediction,
      reasoning_effort: (_g = (_f = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _f.reasoningEffort) != null ? _g : this.settings.reasoningEffort,
      // messages:
      messages
    };
    if (isReasoningModel(this.modelId)) {
      if (baseArgs.temperature != null) {
        baseArgs.temperature = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "temperature",
          details: "temperature is not supported for reasoning models"
        });
      }
      if (baseArgs.top_p != null) {
        baseArgs.top_p = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "topP",
          details: "topP is not supported for reasoning models"
        });
      }
      if (baseArgs.frequency_penalty != null) {
        baseArgs.frequency_penalty = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "frequencyPenalty",
          details: "frequencyPenalty is not supported for reasoning models"
        });
      }
      if (baseArgs.presence_penalty != null) {
        baseArgs.presence_penalty = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "presencePenalty",
          details: "presencePenalty is not supported for reasoning models"
        });
      }
      if (baseArgs.logit_bias != null) {
        baseArgs.logit_bias = void 0;
        warnings.push({
          type: "other",
          message: "logitBias is not supported for reasoning models"
        });
      }
      if (baseArgs.logprobs != null) {
        baseArgs.logprobs = void 0;
        warnings.push({
          type: "other",
          message: "logprobs is not supported for reasoning models"
        });
      }
      if (baseArgs.top_logprobs != null) {
        baseArgs.top_logprobs = void 0;
        warnings.push({
          type: "other",
          message: "topLogprobs is not supported for reasoning models"
        });
      }
      if (baseArgs.max_tokens != null) {
        if (baseArgs.max_completion_tokens == null) {
          baseArgs.max_completion_tokens = baseArgs.max_tokens;
        }
        baseArgs.max_tokens = void 0;
      }
    } else if (this.modelId.startsWith("gpt-4o-search-preview") || this.modelId.startsWith("gpt-4o-mini-search-preview")) {
      if (baseArgs.temperature != null) {
        baseArgs.temperature = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "temperature",
          details: "temperature is not supported for the search preview models and has been removed."
        });
      }
    }
    switch (type) {
      case "regular": {
        const { tools, tool_choice, functions, function_call, toolWarnings } = prepareTools({
          mode,
          useLegacyFunctionCalling,
          structuredOutputs: this.supportsStructuredOutputs
        });
        return {
          args: {
            ...baseArgs,
            tools,
            tool_choice,
            functions,
            function_call
          },
          warnings: [...warnings, ...toolWarnings]
        };
      }
      case "object-json": {
        return {
          args: {
            ...baseArgs,
            response_format: this.supportsStructuredOutputs && mode.schema != null ? {
              type: "json_schema",
              json_schema: {
                schema: mode.schema,
                strict: true,
                name: (_h = mode.name) != null ? _h : "response",
                description: mode.description
              }
            } : { type: "json_object" }
          },
          warnings
        };
      }
      case "object-tool": {
        return {
          args: useLegacyFunctionCalling ? {
            ...baseArgs,
            function_call: {
              name: mode.tool.name
            },
            functions: [
              {
                name: mode.tool.name,
                description: mode.tool.description,
                parameters: mode.tool.parameters
              }
            ]
          } : {
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
                  parameters: mode.tool.parameters,
                  strict: this.supportsStructuredOutputs ? true : void 0
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
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { args: body, warnings } = this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils3.postJsonToApi)({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils3.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils3.createJsonResponseHandler)(
        openaiChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { messages: rawPrompt, ...rawSettings } = body;
    const choice = response.choices[0];
    const completionTokenDetails = (_a = response.usage) == null ? void 0 : _a.completion_tokens_details;
    const promptTokenDetails = (_b = response.usage) == null ? void 0 : _b.prompt_tokens_details;
    const providerMetadata = { openai: {} };
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.reasoning_tokens) != null) {
      providerMetadata.openai.reasoningTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.reasoning_tokens;
    }
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens) != null) {
      providerMetadata.openai.acceptedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens;
    }
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens) != null) {
      providerMetadata.openai.rejectedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens;
    }
    if ((promptTokenDetails == null ? void 0 : promptTokenDetails.cached_tokens) != null) {
      providerMetadata.openai.cachedPromptTokens = promptTokenDetails == null ? void 0 : promptTokenDetails.cached_tokens;
    }
    return {
      text: (_c = choice.message.content) != null ? _c : void 0,
      toolCalls: this.settings.useLegacyFunctionCalling && choice.message.function_call ? [
        {
          toolCallType: "function",
          toolCallId: (0, import_provider_utils3.generateId)(),
          toolName: choice.message.function_call.name,
          args: choice.message.function_call.arguments
        }
      ] : (_d = choice.message.tool_calls) == null ? void 0 : _d.map((toolCall) => {
        var _a2;
        return {
          toolCallType: "function",
          toolCallId: (_a2 = toolCall.id) != null ? _a2 : (0, import_provider_utils3.generateId)(),
          toolName: toolCall.function.name,
          args: toolCall.function.arguments
        };
      }),
      finishReason: mapOpenAIFinishReason(choice.finish_reason),
      usage: {
        promptTokens: (_f = (_e = response.usage) == null ? void 0 : _e.prompt_tokens) != null ? _f : NaN,
        completionTokens: (_h = (_g = response.usage) == null ? void 0 : _g.completion_tokens) != null ? _h : NaN
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders, body: rawResponse },
      request: { body: JSON.stringify(body) },
      response: getResponseMetadata(response),
      warnings,
      logprobs: mapOpenAIChatLogProbsOutput(choice.logprobs),
      providerMetadata
    };
  }
  async doStream(options) {
    if (this.settings.simulateStreaming) {
      const result = await this.doGenerate(options);
      const simulatedStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "response-metadata", ...result.response });
          if (result.text) {
            controller.enqueue({
              type: "text-delta",
              textDelta: result.text
            });
          }
          if (result.toolCalls) {
            for (const toolCall of result.toolCalls) {
              controller.enqueue({
                type: "tool-call-delta",
                toolCallType: "function",
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                argsTextDelta: toolCall.args
              });
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
    const { args, warnings } = this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.compatibility === "strict" ? { include_usage: true } : void 0
    };
    const { responseHeaders, value: response } = await (0, import_provider_utils3.postJsonToApi)({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils3.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils3.createEventSourceResponseHandler)(
        openaiChatChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { messages: rawPrompt, ...rawSettings } = args;
    const toolCalls = [];
    let finishReason = "unknown";
    let usage = {
      promptTokens: void 0,
      completionTokens: void 0
    };
    let logprobs;
    let isFirstChunk = true;
    const { useLegacyFunctionCalling } = this.settings;
    const providerMetadata = { openai: {} };
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
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
              const {
                prompt_tokens,
                completion_tokens,
                prompt_tokens_details,
                completion_tokens_details
              } = value.usage;
              usage = {
                promptTokens: prompt_tokens != null ? prompt_tokens : void 0,
                completionTokens: completion_tokens != null ? completion_tokens : void 0
              };
              if ((completion_tokens_details == null ? void 0 : completion_tokens_details.reasoning_tokens) != null) {
                providerMetadata.openai.reasoningTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.reasoning_tokens;
              }
              if ((completion_tokens_details == null ? void 0 : completion_tokens_details.accepted_prediction_tokens) != null) {
                providerMetadata.openai.acceptedPredictionTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.accepted_prediction_tokens;
              }
              if ((completion_tokens_details == null ? void 0 : completion_tokens_details.rejected_prediction_tokens) != null) {
                providerMetadata.openai.rejectedPredictionTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.rejected_prediction_tokens;
              }
              if ((prompt_tokens_details == null ? void 0 : prompt_tokens_details.cached_tokens) != null) {
                providerMetadata.openai.cachedPromptTokens = prompt_tokens_details == null ? void 0 : prompt_tokens_details.cached_tokens;
              }
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapOpenAIFinishReason(choice.finish_reason);
            }
            if ((choice == null ? void 0 : choice.delta) == null) {
              return;
            }
            const delta = choice.delta;
            if (delta.content != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: delta.content
              });
            }
            const mappedLogprobs = mapOpenAIChatLogProbsOutput(
              choice == null ? void 0 : choice.logprobs
            );
            if (mappedLogprobs == null ? void 0 : mappedLogprobs.length) {
              if (logprobs === void 0) logprobs = [];
              logprobs.push(...mappedLogprobs);
            }
            const mappedToolCalls = useLegacyFunctionCalling && delta.function_call != null ? [
              {
                type: "function",
                id: (0, import_provider_utils3.generateId)(),
                function: delta.function_call,
                index: 0
              }
            ] : delta.tool_calls;
            if (mappedToolCalls != null) {
              for (const toolCallDelta of mappedToolCalls) {
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
                  if (((_a = toolCallDelta.function) == null ? void 0 : _a.name) == null) {
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
                    if ((0, import_provider_utils3.isParsableJson)(toolCall2.function.arguments)) {
                      controller.enqueue({
                        type: "tool-call",
                        toolCallType: "function",
                        toolCallId: (_e = toolCall2.id) != null ? _e : (0, import_provider_utils3.generateId)(),
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
                if (((_j = toolCall.function) == null ? void 0 : _j.name) != null && ((_k = toolCall.function) == null ? void 0 : _k.arguments) != null && (0, import_provider_utils3.isParsableJson)(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallType: "function",
                    toolCallId: (_l = toolCall.id) != null ? _l : (0, import_provider_utils3.generateId)(),
                    toolName: toolCall.function.name,
                    args: toolCall.function.arguments
                  });
                  toolCall.hasFinished = true;
                }
              }
            }
          },
          flush(controller) {
            var _a, _b;
            controller.enqueue({
              type: "finish",
              finishReason,
              logprobs,
              usage: {
                promptTokens: (_a = usage.promptTokens) != null ? _a : NaN,
                completionTokens: (_b = usage.completionTokens) != null ? _b : NaN
              },
              ...providerMetadata != null ? { providerMetadata } : {}
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      request: { body: JSON.stringify(body) },
      warnings
    };
  }
};
var openaiTokenUsageSchema = import_zod2.z.object({
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
var openaiChatResponseSchema = import_zod2.z.object({
  id: import_zod2.z.string().nullish(),
  created: import_zod2.z.number().nullish(),
  model: import_zod2.z.string().nullish(),
  choices: import_zod2.z.array(
    import_zod2.z.object({
      message: import_zod2.z.object({
        role: import_zod2.z.literal("assistant").nullish(),
        content: import_zod2.z.string().nullish(),
        function_call: import_zod2.z.object({
          arguments: import_zod2.z.string(),
          name: import_zod2.z.string()
        }).nullish(),
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
      index: import_zod2.z.number(),
      logprobs: import_zod2.z.object({
        content: import_zod2.z.array(
          import_zod2.z.object({
            token: import_zod2.z.string(),
            logprob: import_zod2.z.number(),
            top_logprobs: import_zod2.z.array(
              import_zod2.z.object({
                token: import_zod2.z.string(),
                logprob: import_zod2.z.number()
              })
            )
          })
        ).nullable()
      }).nullish(),
      finish_reason: import_zod2.z.string().nullish()
    })
  ),
  usage: openaiTokenUsageSchema
});
var openaiChatChunkSchema = import_zod2.z.union([
  import_zod2.z.object({
    id: import_zod2.z.string().nullish(),
    created: import_zod2.z.number().nullish(),
    model: import_zod2.z.string().nullish(),
    choices: import_zod2.z.array(
      import_zod2.z.object({
        delta: import_zod2.z.object({
          role: import_zod2.z.enum(["assistant"]).nullish(),
          content: import_zod2.z.string().nullish(),
          function_call: import_zod2.z.object({
            name: import_zod2.z.string().optional(),
            arguments: import_zod2.z.string().optional()
          }).nullish(),
          tool_calls: import_zod2.z.array(
            import_zod2.z.object({
              index: import_zod2.z.number(),
              id: import_zod2.z.string().nullish(),
              type: import_zod2.z.literal("function").nullish(),
              function: import_zod2.z.object({
                name: import_zod2.z.string().nullish(),
                arguments: import_zod2.z.string().nullish()
              })
            })
          ).nullish()
        }).nullish(),
        logprobs: import_zod2.z.object({
          content: import_zod2.z.array(
            import_zod2.z.object({
              token: import_zod2.z.string(),
              logprob: import_zod2.z.number(),
              top_logprobs: import_zod2.z.array(
                import_zod2.z.object({
                  token: import_zod2.z.string(),
                  logprob: import_zod2.z.number()
                })
              )
            })
          ).nullable()
        }).nullish(),
        finish_reason: import_zod2.z.string().nullish(),
        index: import_zod2.z.number()
      })
    ),
    usage: openaiTokenUsageSchema
  }),
  openaiErrorDataSchema
]);
function isReasoningModel(modelId) {
  return modelId.startsWith("o") || modelId.startsWith("gpt-5");
}
function isAudioModel(modelId) {
  return modelId.startsWith("gpt-4o-audio-preview");
}
function getSystemMessageMode(modelId) {
  var _a, _b;
  if (!isReasoningModel(modelId)) {
    return "system";
  }
  return (_b = (_a = reasoningModels[modelId]) == null ? void 0 : _a.systemMessageMode) != null ? _b : "developer";
}
var reasoningModels = {
  "o1-mini": {
    systemMessageMode: "remove"
  },
  "o1-mini-2024-09-12": {
    systemMessageMode: "remove"
  },
  "o1-preview": {
    systemMessageMode: "remove"
  },
  "o1-preview-2024-09-12": {
    systemMessageMode: "remove"
  },
  o3: {
    systemMessageMode: "developer"
  },
  "o3-2025-04-16": {
    systemMessageMode: "developer"
  },
  "o3-mini": {
    systemMessageMode: "developer"
  },
  "o3-mini-2025-01-31": {
    systemMessageMode: "developer"
  },
  "o4-mini": {
    systemMessageMode: "developer"
  },
  "o4-mini-2025-04-16": {
    systemMessageMode: "developer"
  }
};

// src/openai-completion-language-model.ts
var import_provider5 = require("@ai-sdk/provider");
var import_provider_utils4 = require("@ai-sdk/provider-utils");
var import_zod3 = require("zod");

// src/convert-to-openai-completion-prompt.ts
var import_provider4 = require("@ai-sdk/provider");
function convertToOpenAICompletionPrompt({
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

// src/map-openai-completion-logprobs.ts
function mapOpenAICompletionLogProbs(logprobs) {
  return logprobs == null ? void 0 : logprobs.tokens.map((token, index) => ({
    token,
    logprob: logprobs.token_logprobs[index],
    topLogprobs: logprobs.top_logprobs ? Object.entries(logprobs.top_logprobs[index]).map(
      ([token2, logprob]) => ({
        token: token2,
        logprob
      })
    ) : []
  }));
}

// src/openai-completion-language-model.ts
var OpenAICompletionLanguageModel = class {
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.defaultObjectGenerationMode = void 0;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
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
    seed
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
    const { prompt: completionPrompt, stopSequences } = convertToOpenAICompletionPrompt({ prompt, inputFormat });
    const stop = [...stopSequences != null ? stopSequences : [], ...userStopSequences != null ? userStopSequences : []];
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      echo: this.settings.echo,
      logit_bias: this.settings.logitBias,
      logprobs: typeof this.settings.logprobs === "number" ? this.settings.logprobs : typeof this.settings.logprobs === "boolean" ? this.settings.logprobs ? 0 : void 0 : void 0,
      suffix: this.settings.suffix,
      user: this.settings.user,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,
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
    const { args, warnings } = this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils4.postJsonToApi)({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils4.combineHeaders)(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils4.createJsonResponseHandler)(
        openaiCompletionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { prompt: rawPrompt, ...rawSettings } = args;
    const choice = response.choices[0];
    return {
      text: choice.text,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens
      },
      finishReason: mapOpenAIFinishReason(choice.finish_reason),
      logprobs: mapOpenAICompletionLogProbs(choice.logprobs),
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
      stream_options: this.config.compatibility === "strict" ? { include_usage: true } : void 0
    };
    const { responseHeaders, value: response } = await (0, import_provider_utils4.postJsonToApi)({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils4.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils4.createEventSourceResponseHandler)(
        openaiCompletionChunkSchema
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
    let logprobs;
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
              finishReason = mapOpenAIFinishReason(choice.finish_reason);
            }
            if ((choice == null ? void 0 : choice.text) != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: choice.text
              });
            }
            const mappedLogprobs = mapOpenAICompletionLogProbs(
              choice == null ? void 0 : choice.logprobs
            );
            if (mappedLogprobs == null ? void 0 : mappedLogprobs.length) {
              if (logprobs === void 0) logprobs = [];
              logprobs.push(...mappedLogprobs);
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              logprobs,
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
var openaiCompletionResponseSchema = import_zod3.z.object({
  id: import_zod3.z.string().nullish(),
  created: import_zod3.z.number().nullish(),
  model: import_zod3.z.string().nullish(),
  choices: import_zod3.z.array(
    import_zod3.z.object({
      text: import_zod3.z.string(),
      finish_reason: import_zod3.z.string(),
      logprobs: import_zod3.z.object({
        tokens: import_zod3.z.array(import_zod3.z.string()),
        token_logprobs: import_zod3.z.array(import_zod3.z.number()),
        top_logprobs: import_zod3.z.array(import_zod3.z.record(import_zod3.z.string(), import_zod3.z.number())).nullable()
      }).nullish()
    })
  ),
  usage: import_zod3.z.object({
    prompt_tokens: import_zod3.z.number(),
    completion_tokens: import_zod3.z.number()
  })
});
var openaiCompletionChunkSchema = import_zod3.z.union([
  import_zod3.z.object({
    id: import_zod3.z.string().nullish(),
    created: import_zod3.z.number().nullish(),
    model: import_zod3.z.string().nullish(),
    choices: import_zod3.z.array(
      import_zod3.z.object({
        text: import_zod3.z.string(),
        finish_reason: import_zod3.z.string().nullish(),
        index: import_zod3.z.number(),
        logprobs: import_zod3.z.object({
          tokens: import_zod3.z.array(import_zod3.z.string()),
          token_logprobs: import_zod3.z.array(import_zod3.z.number()),
          top_logprobs: import_zod3.z.array(import_zod3.z.record(import_zod3.z.string(), import_zod3.z.number())).nullable()
        }).nullish()
      })
    ),
    usage: import_zod3.z.object({
      prompt_tokens: import_zod3.z.number(),
      completion_tokens: import_zod3.z.number()
    }).nullish()
  }),
  openaiErrorDataSchema
]);

// src/openai-embedding-model.ts
var import_provider6 = require("@ai-sdk/provider");
var import_provider_utils5 = require("@ai-sdk/provider-utils");
var import_zod4 = require("zod");
var OpenAIEmbeddingModel = class {
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
    return (_a = this.settings.maxEmbeddingsPerCall) != null ? _a : 2048;
  }
  get supportsParallelCalls() {
    var _a;
    return (_a = this.settings.supportsParallelCalls) != null ? _a : true;
  }
  async doEmbed({
    values,
    headers,
    abortSignal
  }) {
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new import_provider6.TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      });
    }
    const { responseHeaders, value: response } = await (0, import_provider_utils5.postJsonToApi)({
      url: this.config.url({
        path: "/embeddings",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils5.combineHeaders)(this.config.headers(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: "float",
        dimensions: this.settings.dimensions,
        user: this.settings.user
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils5.createJsonResponseHandler)(
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

// src/openai-image-model.ts
var import_provider_utils6 = require("@ai-sdk/provider-utils");
var import_zod5 = require("zod");

// src/openai-image-settings.ts
var modelMaxImagesPerCall = {
  "dall-e-3": 1,
  "dall-e-2": 10,
  "gpt-image-1": 10
};
var hasDefaultResponseFormat = /* @__PURE__ */ new Set(["gpt-image-1"]);

// src/openai-image-model.ts
var OpenAIImageModel = class {
  constructor(modelId, settings, config) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.specificationVersion = "v1";
  }
  get maxImagesPerCall() {
    var _a, _b;
    return (_b = (_a = this.settings.maxImagesPerCall) != null ? _a : modelMaxImagesPerCall[this.modelId]) != null ? _b : 1;
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
    var _a, _b, _c, _d;
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
    const { value: response, responseHeaders } = await (0, import_provider_utils6.postJsonToApi)({
      url: this.config.url({
        path: "/images/generations",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils6.combineHeaders)(this.config.headers(), headers),
      body: {
        model: this.modelId,
        prompt,
        n,
        size,
        ...(_d = providerOptions.openai) != null ? _d : {},
        ...!hasDefaultResponseFormat.has(this.modelId) ? { response_format: "b64_json" } : {}
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils6.createJsonResponseHandler)(
        openaiImageResponseSchema
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
var openaiImageResponseSchema = import_zod5.z.object({
  data: import_zod5.z.array(import_zod5.z.object({ b64_json: import_zod5.z.string() }))
});

// src/openai-transcription-model.ts
var import_provider_utils7 = require("@ai-sdk/provider-utils");
var import_zod6 = require("zod");
var openAIProviderOptionsSchema = import_zod6.z.object({
  include: import_zod6.z.array(import_zod6.z.string()).nullish(),
  language: import_zod6.z.string().nullish(),
  prompt: import_zod6.z.string().nullish(),
  temperature: import_zod6.z.number().min(0).max(1).nullish().default(0),
  timestampGranularities: import_zod6.z.array(import_zod6.z.enum(["word", "segment"])).nullish().default(["segment"])
});
var languageMap = {
  afrikaans: "af",
  arabic: "ar",
  armenian: "hy",
  azerbaijani: "az",
  belarusian: "be",
  bosnian: "bs",
  bulgarian: "bg",
  catalan: "ca",
  chinese: "zh",
  croatian: "hr",
  czech: "cs",
  danish: "da",
  dutch: "nl",
  english: "en",
  estonian: "et",
  finnish: "fi",
  french: "fr",
  galician: "gl",
  german: "de",
  greek: "el",
  hebrew: "he",
  hindi: "hi",
  hungarian: "hu",
  icelandic: "is",
  indonesian: "id",
  italian: "it",
  japanese: "ja",
  kannada: "kn",
  kazakh: "kk",
  korean: "ko",
  latvian: "lv",
  lithuanian: "lt",
  macedonian: "mk",
  malay: "ms",
  marathi: "mr",
  maori: "mi",
  nepali: "ne",
  norwegian: "no",
  persian: "fa",
  polish: "pl",
  portuguese: "pt",
  romanian: "ro",
  russian: "ru",
  serbian: "sr",
  slovak: "sk",
  slovenian: "sl",
  spanish: "es",
  swahili: "sw",
  swedish: "sv",
  tagalog: "tl",
  tamil: "ta",
  thai: "th",
  turkish: "tr",
  ukrainian: "uk",
  urdu: "ur",
  vietnamese: "vi",
  welsh: "cy"
};
var OpenAITranscriptionModel = class {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
    this.specificationVersion = "v1";
  }
  get provider() {
    return this.config.provider;
  }
  getArgs({
    audio,
    mediaType,
    providerOptions
  }) {
    var _a, _b, _c, _d, _e;
    const warnings = [];
    const openAIOptions = (0, import_provider_utils7.parseProviderOptions)({
      provider: "openai",
      providerOptions,
      schema: openAIProviderOptionsSchema
    });
    const formData = new FormData();
    const blob = audio instanceof Uint8Array ? new Blob([audio]) : new Blob([(0, import_provider_utils7.convertBase64ToUint8Array)(audio)]);
    formData.append("model", this.modelId);
    formData.append("file", new File([blob], "audio", { type: mediaType }));
    if (openAIOptions) {
      const transcriptionModelOptions = {
        include: (_a = openAIOptions.include) != null ? _a : void 0,
        language: (_b = openAIOptions.language) != null ? _b : void 0,
        prompt: (_c = openAIOptions.prompt) != null ? _c : void 0,
        temperature: (_d = openAIOptions.temperature) != null ? _d : void 0,
        timestamp_granularities: (_e = openAIOptions.timestampGranularities) != null ? _e : void 0
      };
      for (const key in transcriptionModelOptions) {
        const value = transcriptionModelOptions[key];
        if (value !== void 0) {
          formData.append(key, String(value));
        }
      }
    }
    return {
      formData,
      warnings
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f;
    const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
    const { formData, warnings } = this.getArgs(options);
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse
    } = await (0, import_provider_utils7.postFormDataToApi)({
      url: this.config.url({
        path: "/audio/transcriptions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils7.combineHeaders)(this.config.headers(), options.headers),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils7.createJsonResponseHandler)(
        openaiTranscriptionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const language = response.language != null && response.language in languageMap ? languageMap[response.language] : void 0;
    return {
      text: response.text,
      segments: (_e = (_d = response.words) == null ? void 0 : _d.map((word) => ({
        text: word.word,
        startSecond: word.start,
        endSecond: word.end
      }))) != null ? _e : [],
      language,
      durationInSeconds: (_f = response.duration) != null ? _f : void 0,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse
      }
    };
  }
};
var openaiTranscriptionResponseSchema = import_zod6.z.object({
  text: import_zod6.z.string(),
  language: import_zod6.z.string().nullish(),
  duration: import_zod6.z.number().nullish(),
  words: import_zod6.z.array(
    import_zod6.z.object({
      word: import_zod6.z.string(),
      start: import_zod6.z.number(),
      end: import_zod6.z.number()
    })
  ).nullish()
});

// src/openai-speech-model.ts
var import_provider_utils8 = require("@ai-sdk/provider-utils");
var import_zod7 = require("zod");
var OpenAIProviderOptionsSchema = import_zod7.z.object({
  instructions: import_zod7.z.string().nullish(),
  speed: import_zod7.z.number().min(0.25).max(4).default(1).nullish()
});
var OpenAISpeechModel = class {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
    this.specificationVersion = "v1";
  }
  get provider() {
    return this.config.provider;
  }
  getArgs({
    text,
    voice = "alloy",
    outputFormat = "mp3",
    speed,
    instructions,
    providerOptions
  }) {
    const warnings = [];
    const openAIOptions = (0, import_provider_utils8.parseProviderOptions)({
      provider: "openai",
      providerOptions,
      schema: OpenAIProviderOptionsSchema
    });
    const requestBody = {
      model: this.modelId,
      input: text,
      voice,
      response_format: "mp3",
      speed,
      instructions
    };
    if (outputFormat) {
      if (["mp3", "opus", "aac", "flac", "wav", "pcm"].includes(outputFormat)) {
        requestBody.response_format = outputFormat;
      } else {
        warnings.push({
          type: "unsupported-setting",
          setting: "outputFormat",
          details: `Unsupported output format: ${outputFormat}. Using mp3 instead.`
        });
      }
    }
    if (openAIOptions) {
      const speechModelOptions = {};
      for (const key in speechModelOptions) {
        const value = speechModelOptions[key];
        if (value !== void 0) {
          requestBody[key] = value;
        }
      }
    }
    return {
      requestBody,
      warnings
    };
  }
  async doGenerate(options) {
    var _a, _b, _c;
    const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
    const { requestBody, warnings } = this.getArgs(options);
    const {
      value: audio,
      responseHeaders,
      rawValue: rawResponse
    } = await (0, import_provider_utils8.postJsonToApi)({
      url: this.config.url({
        path: "/audio/speech",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils8.combineHeaders)(this.config.headers(), options.headers),
      body: requestBody,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils8.createBinaryResponseHandler)(),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    return {
      audio,
      warnings,
      request: {
        body: JSON.stringify(requestBody)
      },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse
      }
    };
  }
};

// src/responses/openai-responses-language-model.ts
var import_provider9 = require("@ai-sdk/provider");
var import_provider_utils10 = require("@ai-sdk/provider-utils");
var import_zod8 = require("zod");

// src/responses/convert-to-openai-responses-messages.ts
var import_provider7 = require("@ai-sdk/provider");
var import_provider_utils9 = require("@ai-sdk/provider-utils");
function convertToOpenAIResponsesMessages({
  prompt,
  systemMessageMode
}) {
  const messages = [];
  const warnings = [];
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        switch (systemMessageMode) {
          case "system": {
            messages.push({ role: "system", content });
            break;
          }
          case "developer": {
            messages.push({ role: "developer", content });
            break;
          }
          case "remove": {
            warnings.push({
              type: "other",
              message: "system messages are removed for this model"
            });
            break;
          }
          default: {
            const _exhaustiveCheck = systemMessageMode;
            throw new Error(
              `Unsupported system message mode: ${_exhaustiveCheck}`
            );
          }
        }
        break;
      }
      case "user": {
        messages.push({
          role: "user",
          content: content.map((part, index) => {
            var _a, _b, _c, _d;
            switch (part.type) {
              case "text": {
                return { type: "input_text", text: part.text };
              }
              case "image": {
                return {
                  type: "input_image",
                  image_url: part.image instanceof URL ? part.image.toString() : `data:${(_a = part.mimeType) != null ? _a : "image/jpeg"};base64,${(0, import_provider_utils9.convertUint8ArrayToBase64)(part.image)}`,
                  // OpenAI specific extension: image detail
                  detail: (_c = (_b = part.providerMetadata) == null ? void 0 : _b.openai) == null ? void 0 : _c.imageDetail
                };
              }
              case "file": {
                if (part.data instanceof URL) {
                  throw new import_provider7.UnsupportedFunctionalityError({
                    functionality: "File URLs in user messages"
                  });
                }
                switch (part.mimeType) {
                  case "application/pdf": {
                    return {
                      type: "input_file",
                      filename: (_d = part.filename) != null ? _d : `part-${index}.pdf`,
                      file_data: `data:application/pdf;base64,${part.data}`
                    };
                  }
                  default: {
                    throw new import_provider7.UnsupportedFunctionalityError({
                      functionality: "Only PDF files are supported in user messages"
                    });
                  }
                }
              }
            }
          })
        });
        break;
      }
      case "assistant": {
        for (const part of content) {
          switch (part.type) {
            case "text": {
              messages.push({
                role: "assistant",
                content: [{ type: "output_text", text: part.text }]
              });
              break;
            }
            case "tool-call": {
              messages.push({
                type: "function_call",
                call_id: part.toolCallId,
                name: part.toolName,
                arguments: JSON.stringify(part.args)
              });
              break;
            }
          }
        }
        break;
      }
      case "tool": {
        for (const part of content) {
          messages.push({
            type: "function_call_output",
            call_id: part.toolCallId,
            output: JSON.stringify(part.result)
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
  return { messages, warnings };
}

// src/responses/map-openai-responses-finish-reason.ts
function mapOpenAIResponseFinishReason({
  finishReason,
  hasToolCalls
}) {
  switch (finishReason) {
    case void 0:
    case null:
      return hasToolCalls ? "tool-calls" : "stop";
    case "max_output_tokens":
      return "length";
    case "content_filter":
      return "content-filter";
    default:
      return hasToolCalls ? "tool-calls" : "unknown";
  }
}

// src/responses/openai-responses-prepare-tools.ts
var import_provider8 = require("@ai-sdk/provider");
function prepareResponsesTools({
  mode,
  strict
}) {
  var _a;
  const tools = ((_a = mode.tools) == null ? void 0 : _a.length) ? mode.tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, tool_choice: void 0, toolWarnings };
  }
  const toolChoice = mode.toolChoice;
  const openaiTools = [];
  for (const tool of tools) {
    switch (tool.type) {
      case "function":
        openaiTools.push({
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          strict: strict ? true : void 0
        });
        break;
      case "provider-defined":
        switch (tool.id) {
          case "openai.web_search_preview":
            openaiTools.push({
              type: "web_search_preview",
              search_context_size: tool.args.searchContextSize,
              user_location: tool.args.userLocation
            });
            break;
          default:
            toolWarnings.push({ type: "unsupported-tool", tool });
            break;
        }
        break;
      default:
        toolWarnings.push({ type: "unsupported-tool", tool });
        break;
    }
  }
  if (toolChoice == null) {
    return { tools: openaiTools, tool_choice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiTools, tool_choice: type, toolWarnings };
    case "tool": {
      if (toolChoice.toolName === "web_search_preview") {
        return {
          tools: openaiTools,
          tool_choice: {
            type: "web_search_preview"
          },
          toolWarnings
        };
      }
      return {
        tools: openaiTools,
        tool_choice: {
          type: "function",
          name: toolChoice.toolName
        },
        toolWarnings
      };
    }
    default: {
      const _exhaustiveCheck = type;
      throw new import_provider8.UnsupportedFunctionalityError({
        functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/responses/openai-responses-language-model.ts
var OpenAIResponsesLanguageModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v1";
    this.defaultObjectGenerationMode = "json";
    this.supportsStructuredOutputs = true;
    this.modelId = modelId;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  getArgs({
    mode,
    maxTokens,
    temperature,
    stopSequences,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    seed,
    prompt,
    providerMetadata,
    responseFormat
  }) {
    var _a, _b, _c;
    const warnings = [];
    const modelConfig = getResponsesModelConfig(this.modelId);
    const type = mode.type;
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if (seed != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "seed"
      });
    }
    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty"
      });
    }
    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty"
      });
    }
    if (stopSequences != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "stopSequences"
      });
    }
    const { messages, warnings: messageWarnings } = convertToOpenAIResponsesMessages({
      prompt,
      systemMessageMode: modelConfig.systemMessageMode
    });
    warnings.push(...messageWarnings);
    const openaiOptions = (0, import_provider_utils10.parseProviderOptions)({
      provider: "openai",
      providerOptions: providerMetadata,
      schema: openaiResponsesProviderOptionsSchema
    });
    const isStrict = (_a = openaiOptions == null ? void 0 : openaiOptions.strictSchemas) != null ? _a : true;
    const baseArgs = {
      model: this.modelId,
      input: messages,
      temperature,
      top_p: topP,
      max_output_tokens: maxTokens,
      ...(responseFormat == null ? void 0 : responseFormat.type) === "json" && {
        text: {
          format: responseFormat.schema != null ? {
            type: "json_schema",
            strict: isStrict,
            name: (_b = responseFormat.name) != null ? _b : "response",
            description: responseFormat.description,
            schema: responseFormat.schema
          } : { type: "json_object" }
        }
      },
      // provider options:
      metadata: openaiOptions == null ? void 0 : openaiOptions.metadata,
      parallel_tool_calls: openaiOptions == null ? void 0 : openaiOptions.parallelToolCalls,
      previous_response_id: openaiOptions == null ? void 0 : openaiOptions.previousResponseId,
      store: openaiOptions == null ? void 0 : openaiOptions.store,
      user: openaiOptions == null ? void 0 : openaiOptions.user,
      instructions: openaiOptions == null ? void 0 : openaiOptions.instructions,
      // model-specific settings:
      ...modelConfig.isReasoningModel && ((openaiOptions == null ? void 0 : openaiOptions.reasoningEffort) != null || (openaiOptions == null ? void 0 : openaiOptions.reasoningSummary) != null) && {
        reasoning: {
          ...(openaiOptions == null ? void 0 : openaiOptions.reasoningEffort) != null && {
            effort: openaiOptions.reasoningEffort
          },
          ...(openaiOptions == null ? void 0 : openaiOptions.reasoningSummary) != null && {
            summary: openaiOptions.reasoningSummary
          }
        }
      },
      ...modelConfig.requiredAutoTruncation && {
        truncation: "auto"
      }
    };
    if (modelConfig.isReasoningModel) {
      if (baseArgs.temperature != null) {
        baseArgs.temperature = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "temperature",
          details: "temperature is not supported for reasoning models"
        });
      }
      if (baseArgs.top_p != null) {
        baseArgs.top_p = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "topP",
          details: "topP is not supported for reasoning models"
        });
      }
    }
    switch (type) {
      case "regular": {
        const { tools, tool_choice, toolWarnings } = prepareResponsesTools({
          mode,
          strict: isStrict
          // TODO support provider options on tools
        });
        return {
          args: {
            ...baseArgs,
            tools,
            tool_choice
          },
          warnings: [...warnings, ...toolWarnings]
        };
      }
      case "object-json": {
        return {
          args: {
            ...baseArgs,
            text: {
              format: mode.schema != null ? {
                type: "json_schema",
                strict: isStrict,
                name: (_c = mode.name) != null ? _c : "response",
                description: mode.description,
                schema: mode.schema
              } : { type: "json_object" }
            }
          },
          warnings
        };
      }
      case "object-tool": {
        return {
          args: {
            ...baseArgs,
            tool_choice: { type: "function", name: mode.tool.name },
            tools: [
              {
                type: "function",
                name: mode.tool.name,
                description: mode.tool.description,
                parameters: mode.tool.parameters,
                strict: isStrict
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
    var _a, _b, _c, _d, _e, _f, _g;
    const { args: body, warnings } = this.getArgs(options);
    const url = this.config.url({
      path: "/responses",
      modelId: this.modelId
    });
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils10.postJsonToApi)({
      url,
      headers: (0, import_provider_utils10.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils10.createJsonResponseHandler)(
        import_zod8.z.object({
          id: import_zod8.z.string(),
          created_at: import_zod8.z.number(),
          error: import_zod8.z.object({
            message: import_zod8.z.string(),
            code: import_zod8.z.string()
          }).nullish(),
          model: import_zod8.z.string(),
          output: import_zod8.z.array(
            import_zod8.z.discriminatedUnion("type", [
              import_zod8.z.object({
                type: import_zod8.z.literal("message"),
                role: import_zod8.z.literal("assistant"),
                content: import_zod8.z.array(
                  import_zod8.z.object({
                    type: import_zod8.z.literal("output_text"),
                    text: import_zod8.z.string(),
                    annotations: import_zod8.z.array(
                      import_zod8.z.object({
                        type: import_zod8.z.literal("url_citation"),
                        start_index: import_zod8.z.number(),
                        end_index: import_zod8.z.number(),
                        url: import_zod8.z.string(),
                        title: import_zod8.z.string()
                      })
                    )
                  })
                )
              }),
              import_zod8.z.object({
                type: import_zod8.z.literal("function_call"),
                call_id: import_zod8.z.string(),
                name: import_zod8.z.string(),
                arguments: import_zod8.z.string()
              }),
              import_zod8.z.object({
                type: import_zod8.z.literal("web_search_call")
              }),
              import_zod8.z.object({
                type: import_zod8.z.literal("computer_call")
              }),
              import_zod8.z.object({
                type: import_zod8.z.literal("reasoning"),
                summary: import_zod8.z.array(
                  import_zod8.z.object({
                    type: import_zod8.z.literal("summary_text"),
                    text: import_zod8.z.string()
                  })
                )
              })
            ])
          ),
          incomplete_details: import_zod8.z.object({ reason: import_zod8.z.string() }).nullable(),
          usage: usageSchema
        })
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    if (response.error) {
      throw new import_provider9.APICallError({
        message: response.error.message,
        url,
        requestBodyValues: body,
        statusCode: 400,
        responseHeaders,
        responseBody: rawResponse,
        isRetryable: false
      });
    }
    const outputTextElements = response.output.filter((output) => output.type === "message").flatMap((output) => output.content).filter((content) => content.type === "output_text");
    const toolCalls = response.output.filter((output) => output.type === "function_call").map((output) => ({
      toolCallType: "function",
      toolCallId: output.call_id,
      toolName: output.name,
      args: output.arguments
    }));
    const reasoningSummary = (_b = (_a = response.output.find((item) => item.type === "reasoning")) == null ? void 0 : _a.summary) != null ? _b : null;
    return {
      text: outputTextElements.map((content) => content.text).join("\n"),
      sources: outputTextElements.flatMap(
        (content) => content.annotations.map((annotation) => {
          var _a2, _b2, _c2;
          return {
            sourceType: "url",
            id: (_c2 = (_b2 = (_a2 = this.config).generateId) == null ? void 0 : _b2.call(_a2)) != null ? _c2 : (0, import_provider_utils10.generateId)(),
            url: annotation.url,
            title: annotation.title
          };
        })
      ),
      finishReason: mapOpenAIResponseFinishReason({
        finishReason: (_c = response.incomplete_details) == null ? void 0 : _c.reason,
        hasToolCalls: toolCalls.length > 0
      }),
      toolCalls: toolCalls.length > 0 ? toolCalls : void 0,
      reasoning: reasoningSummary ? reasoningSummary.map((summary) => ({
        type: "text",
        text: summary.text
      })) : void 0,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens
      },
      rawCall: {
        rawPrompt: void 0,
        rawSettings: {}
      },
      rawResponse: {
        headers: responseHeaders,
        body: rawResponse
      },
      request: {
        body: JSON.stringify(body)
      },
      response: {
        id: response.id,
        timestamp: new Date(response.created_at * 1e3),
        modelId: response.model
      },
      providerMetadata: {
        openai: {
          responseId: response.id,
          cachedPromptTokens: (_e = (_d = response.usage.input_tokens_details) == null ? void 0 : _d.cached_tokens) != null ? _e : null,
          reasoningTokens: (_g = (_f = response.usage.output_tokens_details) == null ? void 0 : _f.reasoning_tokens) != null ? _g : null
        }
      },
      warnings
    };
  }
  async doStream(options) {
    const { args: body, warnings } = this.getArgs(options);
    const { responseHeaders, value: response } = await (0, import_provider_utils10.postJsonToApi)({
      url: this.config.url({
        path: "/responses",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils10.combineHeaders)(this.config.headers(), options.headers),
      body: {
        ...body,
        stream: true
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils10.createEventSourceResponseHandler)(
        openaiResponsesChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const self = this;
    let finishReason = "unknown";
    let promptTokens = NaN;
    let completionTokens = NaN;
    let cachedPromptTokens = null;
    let reasoningTokens = null;
    let responseId = null;
    const ongoingToolCalls = {};
    let hasToolCalls = false;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            if (!chunk.success) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if (isResponseOutputItemAddedChunk(value)) {
              if (value.item.type === "function_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: value.item.name,
                  toolCallId: value.item.call_id
                };
                controller.enqueue({
                  type: "tool-call-delta",
                  toolCallType: "function",
                  toolCallId: value.item.call_id,
                  toolName: value.item.name,
                  argsTextDelta: value.item.arguments
                });
              }
            } else if (isResponseFunctionCallArgumentsDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-call-delta",
                  toolCallType: "function",
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  argsTextDelta: value.delta
                });
              }
            } else if (isResponseCreatedChunk(value)) {
              responseId = value.response.id;
              controller.enqueue({
                type: "response-metadata",
                id: value.response.id,
                timestamp: new Date(value.response.created_at * 1e3),
                modelId: value.response.model
              });
            } else if (isTextDeltaChunk(value)) {
              controller.enqueue({
                type: "text-delta",
                textDelta: value.delta
              });
            } else if (isResponseReasoningSummaryTextDeltaChunk(value)) {
              controller.enqueue({
                type: "reasoning",
                textDelta: value.delta
              });
            } else if (isResponseOutputItemDoneChunk(value) && value.item.type === "function_call") {
              ongoingToolCalls[value.output_index] = void 0;
              hasToolCalls = true;
              controller.enqueue({
                type: "tool-call",
                toolCallType: "function",
                toolCallId: value.item.call_id,
                toolName: value.item.name,
                args: value.item.arguments
              });
            } else if (isResponseFinishedChunk(value)) {
              finishReason = mapOpenAIResponseFinishReason({
                finishReason: (_a = value.response.incomplete_details) == null ? void 0 : _a.reason,
                hasToolCalls
              });
              promptTokens = value.response.usage.input_tokens;
              completionTokens = value.response.usage.output_tokens;
              cachedPromptTokens = (_c = (_b = value.response.usage.input_tokens_details) == null ? void 0 : _b.cached_tokens) != null ? _c : cachedPromptTokens;
              reasoningTokens = (_e = (_d = value.response.usage.output_tokens_details) == null ? void 0 : _d.reasoning_tokens) != null ? _e : reasoningTokens;
            } else if (isResponseAnnotationAddedChunk(value)) {
              controller.enqueue({
                type: "source",
                source: {
                  sourceType: "url",
                  id: (_h = (_g = (_f = self.config).generateId) == null ? void 0 : _g.call(_f)) != null ? _h : (0, import_provider_utils10.generateId)(),
                  url: value.annotation.url,
                  title: value.annotation.title
                }
              });
            } else if (isErrorChunk(value)) {
              controller.enqueue({ type: "error", error: value });
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              usage: { promptTokens, completionTokens },
              ...(cachedPromptTokens != null || reasoningTokens != null) && {
                providerMetadata: {
                  openai: {
                    responseId,
                    cachedPromptTokens,
                    reasoningTokens
                  }
                }
              }
            });
          }
        })
      ),
      rawCall: {
        rawPrompt: void 0,
        rawSettings: {}
      },
      rawResponse: { headers: responseHeaders },
      request: { body: JSON.stringify(body) },
      warnings
    };
  }
};
var usageSchema = import_zod8.z.object({
  input_tokens: import_zod8.z.number(),
  input_tokens_details: import_zod8.z.object({ cached_tokens: import_zod8.z.number().nullish() }).nullish(),
  output_tokens: import_zod8.z.number(),
  output_tokens_details: import_zod8.z.object({ reasoning_tokens: import_zod8.z.number().nullish() }).nullish()
});
var textDeltaChunkSchema = import_zod8.z.object({
  type: import_zod8.z.literal("response.output_text.delta"),
  delta: import_zod8.z.string()
});
var responseFinishedChunkSchema = import_zod8.z.object({
  type: import_zod8.z.enum(["response.completed", "response.incomplete"]),
  response: import_zod8.z.object({
    incomplete_details: import_zod8.z.object({ reason: import_zod8.z.string() }).nullish(),
    usage: usageSchema
  })
});
var responseCreatedChunkSchema = import_zod8.z.object({
  type: import_zod8.z.literal("response.created"),
  response: import_zod8.z.object({
    id: import_zod8.z.string(),
    created_at: import_zod8.z.number(),
    model: import_zod8.z.string()
  })
});
var responseOutputItemDoneSchema = import_zod8.z.object({
  type: import_zod8.z.literal("response.output_item.done"),
  output_index: import_zod8.z.number(),
  item: import_zod8.z.discriminatedUnion("type", [
    import_zod8.z.object({
      type: import_zod8.z.literal("message")
    }),
    import_zod8.z.object({
      type: import_zod8.z.literal("function_call"),
      id: import_zod8.z.string(),
      call_id: import_zod8.z.string(),
      name: import_zod8.z.string(),
      arguments: import_zod8.z.string(),
      status: import_zod8.z.literal("completed")
    })
  ])
});
var responseFunctionCallArgumentsDeltaSchema = import_zod8.z.object({
  type: import_zod8.z.literal("response.function_call_arguments.delta"),
  item_id: import_zod8.z.string(),
  output_index: import_zod8.z.number(),
  delta: import_zod8.z.string()
});
var responseOutputItemAddedSchema = import_zod8.z.object({
  type: import_zod8.z.literal("response.output_item.added"),
  output_index: import_zod8.z.number(),
  item: import_zod8.z.discriminatedUnion("type", [
    import_zod8.z.object({
      type: import_zod8.z.literal("message")
    }),
    import_zod8.z.object({
      type: import_zod8.z.literal("function_call"),
      id: import_zod8.z.string(),
      call_id: import_zod8.z.string(),
      name: import_zod8.z.string(),
      arguments: import_zod8.z.string()
    })
  ])
});
var responseAnnotationAddedSchema = import_zod8.z.object({
  type: import_zod8.z.literal("response.output_text.annotation.added"),
  annotation: import_zod8.z.object({
    type: import_zod8.z.literal("url_citation"),
    url: import_zod8.z.string(),
    title: import_zod8.z.string()
  })
});
var responseReasoningSummaryTextDeltaSchema = import_zod8.z.object({
  type: import_zod8.z.literal("response.reasoning_summary_text.delta"),
  item_id: import_zod8.z.string(),
  output_index: import_zod8.z.number(),
  summary_index: import_zod8.z.number(),
  delta: import_zod8.z.string()
});
var errorChunkSchema = import_zod8.z.object({
  type: import_zod8.z.literal("error"),
  code: import_zod8.z.string(),
  message: import_zod8.z.string(),
  param: import_zod8.z.string().nullish(),
  sequence_number: import_zod8.z.number()
});
var openaiResponsesChunkSchema = import_zod8.z.union([
  textDeltaChunkSchema,
  responseFinishedChunkSchema,
  responseCreatedChunkSchema,
  responseOutputItemDoneSchema,
  responseFunctionCallArgumentsDeltaSchema,
  responseOutputItemAddedSchema,
  responseAnnotationAddedSchema,
  responseReasoningSummaryTextDeltaSchema,
  errorChunkSchema,
  import_zod8.z.object({ type: import_zod8.z.string() }).passthrough()
  // fallback for unknown chunks
]);
function isTextDeltaChunk(chunk) {
  return chunk.type === "response.output_text.delta";
}
function isResponseOutputItemDoneChunk(chunk) {
  return chunk.type === "response.output_item.done";
}
function isResponseFinishedChunk(chunk) {
  return chunk.type === "response.completed" || chunk.type === "response.incomplete";
}
function isResponseCreatedChunk(chunk) {
  return chunk.type === "response.created";
}
function isResponseFunctionCallArgumentsDeltaChunk(chunk) {
  return chunk.type === "response.function_call_arguments.delta";
}
function isResponseOutputItemAddedChunk(chunk) {
  return chunk.type === "response.output_item.added";
}
function isResponseAnnotationAddedChunk(chunk) {
  return chunk.type === "response.output_text.annotation.added";
}
function isResponseReasoningSummaryTextDeltaChunk(chunk) {
  return chunk.type === "response.reasoning_summary_text.delta";
}
function isErrorChunk(chunk) {
  return chunk.type === "error";
}
function getResponsesModelConfig(modelId) {
  if (modelId.startsWith("o") || modelId.startsWith("gpt-5")) {
    if (modelId.startsWith("o1-mini") || modelId.startsWith("o1-preview")) {
      return {
        isReasoningModel: true,
        systemMessageMode: "remove",
        requiredAutoTruncation: false
      };
    }
    return {
      isReasoningModel: true,
      systemMessageMode: "developer",
      requiredAutoTruncation: false
    };
  }
  return {
    isReasoningModel: false,
    systemMessageMode: "system",
    requiredAutoTruncation: false
  };
}
var openaiResponsesProviderOptionsSchema = import_zod8.z.object({
  metadata: import_zod8.z.any().nullish(),
  parallelToolCalls: import_zod8.z.boolean().nullish(),
  previousResponseId: import_zod8.z.string().nullish(),
  store: import_zod8.z.boolean().nullish(),
  user: import_zod8.z.string().nullish(),
  reasoningEffort: import_zod8.z.string().nullish(),
  strictSchemas: import_zod8.z.boolean().nullish(),
  instructions: import_zod8.z.string().nullish(),
  reasoningSummary: import_zod8.z.string().nullish()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OpenAIChatLanguageModel,
  OpenAICompletionLanguageModel,
  OpenAIEmbeddingModel,
  OpenAIImageModel,
  OpenAIResponsesLanguageModel,
  OpenAISpeechModel,
  OpenAITranscriptionModel,
  hasDefaultResponseFormat,
  modelMaxImagesPerCall
});
//# sourceMappingURL=index.js.map