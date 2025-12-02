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
  VERSION: () => VERSION,
  createOpenAI: () => createOpenAI,
  openai: () => openai
});
module.exports = __toCommonJS(src_exports);

// src/openai-provider.ts
var import_provider_utils30 = require("@ai-sdk/provider-utils");

// src/chat/openai-chat-language-model.ts
var import_provider3 = require("@ai-sdk/provider");
var import_provider_utils5 = require("@ai-sdk/provider-utils");

// src/openai-error.ts
var import_v4 = require("zod/v4");
var import_provider_utils = require("@ai-sdk/provider-utils");
var openaiErrorDataSchema = import_v4.z.object({
  error: import_v4.z.object({
    message: import_v4.z.string(),
    // The additional information below is handled loosely to support
    // OpenAI-compatible providers that have slightly different error
    // responses:
    type: import_v4.z.string().nullish(),
    param: import_v4.z.any().nullish(),
    code: import_v4.z.union([import_v4.z.string(), import_v4.z.number()]).nullish()
  })
});
var openaiFailedResponseHandler = (0, import_provider_utils.createJsonErrorResponseHandler)({
  errorSchema: openaiErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/chat/convert-to-openai-chat-messages.ts
var import_provider = require("@ai-sdk/provider");
var import_provider_utils2 = require("@ai-sdk/provider-utils");
function convertToOpenAIChatMessages({
  prompt,
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
            var _a, _b, _c;
            switch (part.type) {
              case "text": {
                return { type: "text", text: part.text };
              }
              case "file": {
                if (part.mediaType.startsWith("image/")) {
                  const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType;
                  return {
                    type: "image_url",
                    image_url: {
                      url: part.data instanceof URL ? part.data.toString() : `data:${mediaType};base64,${(0, import_provider_utils2.convertToBase64)(part.data)}`,
                      // OpenAI specific extension: image detail
                      detail: (_b = (_a = part.providerOptions) == null ? void 0 : _a.openai) == null ? void 0 : _b.imageDetail
                    }
                  };
                } else if (part.mediaType.startsWith("audio/")) {
                  if (part.data instanceof URL) {
                    throw new import_provider.UnsupportedFunctionalityError({
                      functionality: "audio file parts with URLs"
                    });
                  }
                  switch (part.mediaType) {
                    case "audio/wav": {
                      return {
                        type: "input_audio",
                        input_audio: {
                          data: (0, import_provider_utils2.convertToBase64)(part.data),
                          format: "wav"
                        }
                      };
                    }
                    case "audio/mp3":
                    case "audio/mpeg": {
                      return {
                        type: "input_audio",
                        input_audio: {
                          data: (0, import_provider_utils2.convertToBase64)(part.data),
                          format: "mp3"
                        }
                      };
                    }
                    default: {
                      throw new import_provider.UnsupportedFunctionalityError({
                        functionality: `audio content parts with media type ${part.mediaType}`
                      });
                    }
                  }
                } else if (part.mediaType === "application/pdf") {
                  if (part.data instanceof URL) {
                    throw new import_provider.UnsupportedFunctionalityError({
                      functionality: "PDF file parts with URLs"
                    });
                  }
                  return {
                    type: "file",
                    file: typeof part.data === "string" && part.data.startsWith("file-") ? { file_id: part.data } : {
                      filename: (_c = part.filename) != null ? _c : `part-${index}.pdf`,
                      file_data: `data:application/pdf;base64,${(0, import_provider_utils2.convertToBase64)(part.data)}`
                    }
                  };
                } else {
                  throw new import_provider.UnsupportedFunctionalityError({
                    functionality: `file part media type ${part.mediaType}`
                  });
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
                  arguments: JSON.stringify(part.input)
                }
              });
              break;
            }
          }
        }
        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : void 0
        });
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          const output = toolResponse.output;
          let contentValue;
          switch (output.type) {
            case "text":
            case "error-text":
              contentValue = output.value;
              break;
            case "content":
            case "json":
            case "error-json":
              contentValue = JSON.stringify(output.value);
              break;
          }
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: contentValue
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

// src/chat/get-response-metadata.ts
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

// src/chat/map-openai-finish-reason.ts
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

// src/chat/openai-chat-api.ts
var import_provider_utils3 = require("@ai-sdk/provider-utils");
var import_v42 = require("zod/v4");
var openaiChatResponseSchema = (0, import_provider_utils3.lazyValidator)(
  () => (0, import_provider_utils3.zodSchema)(
    import_v42.z.object({
      id: import_v42.z.string().nullish(),
      created: import_v42.z.number().nullish(),
      model: import_v42.z.string().nullish(),
      choices: import_v42.z.array(
        import_v42.z.object({
          message: import_v42.z.object({
            role: import_v42.z.literal("assistant").nullish(),
            content: import_v42.z.string().nullish(),
            tool_calls: import_v42.z.array(
              import_v42.z.object({
                id: import_v42.z.string().nullish(),
                type: import_v42.z.literal("function"),
                function: import_v42.z.object({
                  name: import_v42.z.string(),
                  arguments: import_v42.z.string()
                })
              })
            ).nullish(),
            annotations: import_v42.z.array(
              import_v42.z.object({
                type: import_v42.z.literal("url_citation"),
                start_index: import_v42.z.number(),
                end_index: import_v42.z.number(),
                url: import_v42.z.string(),
                title: import_v42.z.string()
              })
            ).nullish()
          }),
          index: import_v42.z.number(),
          logprobs: import_v42.z.object({
            content: import_v42.z.array(
              import_v42.z.object({
                token: import_v42.z.string(),
                logprob: import_v42.z.number(),
                top_logprobs: import_v42.z.array(
                  import_v42.z.object({
                    token: import_v42.z.string(),
                    logprob: import_v42.z.number()
                  })
                )
              })
            ).nullish()
          }).nullish(),
          finish_reason: import_v42.z.string().nullish()
        })
      ),
      usage: import_v42.z.object({
        prompt_tokens: import_v42.z.number().nullish(),
        completion_tokens: import_v42.z.number().nullish(),
        total_tokens: import_v42.z.number().nullish(),
        prompt_tokens_details: import_v42.z.object({
          cached_tokens: import_v42.z.number().nullish()
        }).nullish(),
        completion_tokens_details: import_v42.z.object({
          reasoning_tokens: import_v42.z.number().nullish(),
          accepted_prediction_tokens: import_v42.z.number().nullish(),
          rejected_prediction_tokens: import_v42.z.number().nullish()
        }).nullish()
      }).nullish()
    })
  )
);
var openaiChatChunkSchema = (0, import_provider_utils3.lazyValidator)(
  () => (0, import_provider_utils3.zodSchema)(
    import_v42.z.union([
      import_v42.z.object({
        id: import_v42.z.string().nullish(),
        created: import_v42.z.number().nullish(),
        model: import_v42.z.string().nullish(),
        choices: import_v42.z.array(
          import_v42.z.object({
            delta: import_v42.z.object({
              role: import_v42.z.enum(["assistant"]).nullish(),
              content: import_v42.z.string().nullish(),
              tool_calls: import_v42.z.array(
                import_v42.z.object({
                  index: import_v42.z.number(),
                  id: import_v42.z.string().nullish(),
                  type: import_v42.z.literal("function").nullish(),
                  function: import_v42.z.object({
                    name: import_v42.z.string().nullish(),
                    arguments: import_v42.z.string().nullish()
                  })
                })
              ).nullish(),
              annotations: import_v42.z.array(
                import_v42.z.object({
                  type: import_v42.z.literal("url_citation"),
                  start_index: import_v42.z.number(),
                  end_index: import_v42.z.number(),
                  url: import_v42.z.string(),
                  title: import_v42.z.string()
                })
              ).nullish()
            }).nullish(),
            logprobs: import_v42.z.object({
              content: import_v42.z.array(
                import_v42.z.object({
                  token: import_v42.z.string(),
                  logprob: import_v42.z.number(),
                  top_logprobs: import_v42.z.array(
                    import_v42.z.object({
                      token: import_v42.z.string(),
                      logprob: import_v42.z.number()
                    })
                  )
                })
              ).nullish()
            }).nullish(),
            finish_reason: import_v42.z.string().nullish(),
            index: import_v42.z.number()
          })
        ),
        usage: import_v42.z.object({
          prompt_tokens: import_v42.z.number().nullish(),
          completion_tokens: import_v42.z.number().nullish(),
          total_tokens: import_v42.z.number().nullish(),
          prompt_tokens_details: import_v42.z.object({
            cached_tokens: import_v42.z.number().nullish()
          }).nullish(),
          completion_tokens_details: import_v42.z.object({
            reasoning_tokens: import_v42.z.number().nullish(),
            accepted_prediction_tokens: import_v42.z.number().nullish(),
            rejected_prediction_tokens: import_v42.z.number().nullish()
          }).nullish()
        }).nullish()
      }),
      openaiErrorDataSchema
    ])
  )
);

// src/chat/openai-chat-options.ts
var import_provider_utils4 = require("@ai-sdk/provider-utils");
var import_v43 = require("zod/v4");
var openaiChatLanguageModelOptions = (0, import_provider_utils4.lazyValidator)(
  () => (0, import_provider_utils4.zodSchema)(
    import_v43.z.object({
      /**
       * Modify the likelihood of specified tokens appearing in the completion.
       *
       * Accepts a JSON object that maps tokens (specified by their token ID in
       * the GPT tokenizer) to an associated bias value from -100 to 100.
       */
      logitBias: import_v43.z.record(import_v43.z.coerce.number(), import_v43.z.number()).optional(),
      /**
       * Return the log probabilities of the tokens.
       *
       * Setting to true will return the log probabilities of the tokens that
       * were generated.
       *
       * Setting to a number will return the log probabilities of the top n
       * tokens that were generated.
       */
      logprobs: import_v43.z.union([import_v43.z.boolean(), import_v43.z.number()]).optional(),
      /**
       * Whether to enable parallel function calling during tool use. Default to true.
       */
      parallelToolCalls: import_v43.z.boolean().optional(),
      /**
       * A unique identifier representing your end-user, which can help OpenAI to
       * monitor and detect abuse.
       */
      user: import_v43.z.string().optional(),
      /**
       * Reasoning effort for reasoning models. Defaults to `medium`.
       */
      reasoningEffort: import_v43.z.enum(["minimal", "low", "medium", "high"]).optional(),
      /**
       * Maximum number of completion tokens to generate. Useful for reasoning models.
       */
      maxCompletionTokens: import_v43.z.number().optional(),
      /**
       * Whether to enable persistence in responses API.
       */
      store: import_v43.z.boolean().optional(),
      /**
       * Metadata to associate with the request.
       */
      metadata: import_v43.z.record(import_v43.z.string().max(64), import_v43.z.string().max(512)).optional(),
      /**
       * Parameters for prediction mode.
       */
      prediction: import_v43.z.record(import_v43.z.string(), import_v43.z.any()).optional(),
      /**
       * Whether to use structured outputs.
       *
       * @default true
       */
      structuredOutputs: import_v43.z.boolean().optional(),
      /**
       * Service tier for the request.
       * - 'auto': Default service tier. The request will be processed with the service tier configured in the
       *           Project settings. Unless otherwise configured, the Project will use 'default'.
       * - 'flex': 50% cheaper processing at the cost of increased latency. Only available for o3 and o4-mini models.
       * - 'priority': Higher-speed processing with predictably low latency at premium cost. Available for Enterprise customers.
       * - 'default': The request will be processed with the standard pricing and performance for the selected model.
       *
       * @default 'auto'
       */
      serviceTier: import_v43.z.enum(["auto", "flex", "priority", "default"]).optional(),
      /**
       * Whether to use strict JSON schema validation.
       *
       * @default false
       */
      strictJsonSchema: import_v43.z.boolean().optional(),
      /**
       * Controls the verbosity of the model's responses.
       * Lower values will result in more concise responses, while higher values will result in more verbose responses.
       */
      textVerbosity: import_v43.z.enum(["low", "medium", "high"]).optional(),
      /**
       * A cache key for prompt caching. Allows manual control over prompt caching behavior.
       * Useful for improving cache hit rates and working around automatic caching issues.
       */
      promptCacheKey: import_v43.z.string().optional(),
      /**
       * A stable identifier used to help detect users of your application
       * that may be violating OpenAI's usage policies. The IDs should be a
       * string that uniquely identifies each user. We recommend hashing their
       * username or email address, in order to avoid sending us any identifying
       * information.
       */
      safetyIdentifier: import_v43.z.string().optional()
    })
  )
);

// src/chat/openai-chat-prepare-tools.ts
var import_provider2 = require("@ai-sdk/provider");
function prepareChatTools({
  tools,
  toolChoice,
  structuredOutputs,
  strictJsonSchema
}) {
  tools = (tools == null ? void 0 : tools.length) ? tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, toolChoice: void 0, toolWarnings };
  }
  const openaiTools2 = [];
  for (const tool of tools) {
    switch (tool.type) {
      case "function":
        openaiTools2.push({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
            strict: structuredOutputs ? strictJsonSchema : void 0
          }
        });
        break;
      default:
        toolWarnings.push({ type: "unsupported-tool", tool });
        break;
    }
  }
  if (toolChoice == null) {
    return { tools: openaiTools2, toolChoice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiTools2, toolChoice: type, toolWarnings };
    case "tool":
      return {
        tools: openaiTools2,
        toolChoice: {
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
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/chat/openai-chat-language-model.ts
var OpenAIChatLanguageModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    this.supportedUrls = {
      "image/*": [/^https?:\/\/.*$/]
    };
    this.modelId = modelId;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
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
    var _a, _b, _c, _d;
    const warnings = [];
    const openaiOptions = (_a = await (0, import_provider_utils5.parseProviderOptions)({
      provider: "openai",
      providerOptions,
      schema: openaiChatLanguageModelOptions
    })) != null ? _a : {};
    const structuredOutputs = (_b = openaiOptions.structuredOutputs) != null ? _b : true;
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if ((responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null && !structuredOutputs) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format schema is only supported with structuredOutputs"
      });
    }
    const { messages, warnings: messageWarnings } = convertToOpenAIChatMessages(
      {
        prompt,
        systemMessageMode: getSystemMessageMode(this.modelId)
      }
    );
    warnings.push(...messageWarnings);
    const strictJsonSchema = (_c = openaiOptions.strictJsonSchema) != null ? _c : false;
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      logit_bias: openaiOptions.logitBias,
      logprobs: openaiOptions.logprobs === true || typeof openaiOptions.logprobs === "number" ? true : void 0,
      top_logprobs: typeof openaiOptions.logprobs === "number" ? openaiOptions.logprobs : typeof openaiOptions.logprobs === "boolean" ? openaiOptions.logprobs ? 0 : void 0 : void 0,
      user: openaiOptions.user,
      parallel_tool_calls: openaiOptions.parallelToolCalls,
      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? structuredOutputs && responseFormat.schema != null ? {
        type: "json_schema",
        json_schema: {
          schema: responseFormat.schema,
          strict: strictJsonSchema,
          name: (_d = responseFormat.name) != null ? _d : "response",
          description: responseFormat.description
        }
      } : { type: "json_object" } : void 0,
      stop: stopSequences,
      seed,
      verbosity: openaiOptions.textVerbosity,
      // openai specific settings:
      // TODO AI SDK 6: remove, we auto-map maxOutputTokens now
      max_completion_tokens: openaiOptions.maxCompletionTokens,
      store: openaiOptions.store,
      metadata: openaiOptions.metadata,
      prediction: openaiOptions.prediction,
      reasoning_effort: openaiOptions.reasoningEffort,
      service_tier: openaiOptions.serviceTier,
      prompt_cache_key: openaiOptions.promptCacheKey,
      safety_identifier: openaiOptions.safetyIdentifier,
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
    if (openaiOptions.serviceTier === "flex" && !supportsFlexProcessing(this.modelId)) {
      warnings.push({
        type: "unsupported-setting",
        setting: "serviceTier",
        details: "flex processing is only available for o3, o4-mini, and gpt-5 models"
      });
      baseArgs.service_tier = void 0;
    }
    if (openaiOptions.serviceTier === "priority" && !supportsPriorityProcessing(this.modelId)) {
      warnings.push({
        type: "unsupported-setting",
        setting: "serviceTier",
        details: "priority processing is only available for supported models (gpt-4, gpt-5, gpt-5-mini, o3, o4-mini) and requires Enterprise access. gpt-5-nano is not supported"
      });
      baseArgs.service_tier = void 0;
    }
    const {
      tools: openaiTools2,
      toolChoice: openaiToolChoice,
      toolWarnings
    } = prepareChatTools({
      tools,
      toolChoice,
      structuredOutputs,
      strictJsonSchema
    });
    return {
      args: {
        ...baseArgs,
        tools: openaiTools2,
        tool_choice: openaiToolChoice
      },
      warnings: [...warnings, ...toolWarnings]
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    const { args: body, warnings } = await this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils5.postJsonToApi)({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils5.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils5.createJsonResponseHandler)(
        openaiChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const choice = response.choices[0];
    const content = [];
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: "text", text });
    }
    for (const toolCall of (_a = choice.message.tool_calls) != null ? _a : []) {
      content.push({
        type: "tool-call",
        toolCallId: (_b = toolCall.id) != null ? _b : (0, import_provider_utils5.generateId)(),
        toolName: toolCall.function.name,
        input: toolCall.function.arguments
      });
    }
    for (const annotation of (_c = choice.message.annotations) != null ? _c : []) {
      content.push({
        type: "source",
        sourceType: "url",
        id: (0, import_provider_utils5.generateId)(),
        url: annotation.url,
        title: annotation.title
      });
    }
    const completionTokenDetails = (_d = response.usage) == null ? void 0 : _d.completion_tokens_details;
    const promptTokenDetails = (_e = response.usage) == null ? void 0 : _e.prompt_tokens_details;
    const providerMetadata = { openai: {} };
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens) != null) {
      providerMetadata.openai.acceptedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens;
    }
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens) != null) {
      providerMetadata.openai.rejectedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens;
    }
    if (((_f = choice.logprobs) == null ? void 0 : _f.content) != null) {
      providerMetadata.openai.logprobs = choice.logprobs.content;
    }
    return {
      content,
      finishReason: mapOpenAIFinishReason(choice.finish_reason),
      usage: {
        inputTokens: (_h = (_g = response.usage) == null ? void 0 : _g.prompt_tokens) != null ? _h : void 0,
        outputTokens: (_j = (_i = response.usage) == null ? void 0 : _i.completion_tokens) != null ? _j : void 0,
        totalTokens: (_l = (_k = response.usage) == null ? void 0 : _k.total_tokens) != null ? _l : void 0,
        reasoningTokens: (_m = completionTokenDetails == null ? void 0 : completionTokenDetails.reasoning_tokens) != null ? _m : void 0,
        cachedInputTokens: (_n = promptTokenDetails == null ? void 0 : promptTokenDetails.cached_tokens) != null ? _n : void 0
      },
      request: { body },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse
      },
      warnings,
      providerMetadata
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };
    const { responseHeaders, value: response } = await (0, import_provider_utils5.postJsonToApi)({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils5.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils5.createEventSourceResponseHandler)(
        openaiChatChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const toolCalls = [];
    let finishReason = "unknown";
    const usage = {
      inputTokens: void 0,
      outputTokens: void 0,
      totalTokens: void 0
    };
    let isFirstChunk = true;
    let isActiveText = false;
    const providerMetadata = { openai: {} };
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
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
              usage.inputTokens = (_a = value.usage.prompt_tokens) != null ? _a : void 0;
              usage.outputTokens = (_b = value.usage.completion_tokens) != null ? _b : void 0;
              usage.totalTokens = (_c = value.usage.total_tokens) != null ? _c : void 0;
              usage.reasoningTokens = (_e = (_d = value.usage.completion_tokens_details) == null ? void 0 : _d.reasoning_tokens) != null ? _e : void 0;
              usage.cachedInputTokens = (_g = (_f = value.usage.prompt_tokens_details) == null ? void 0 : _f.cached_tokens) != null ? _g : void 0;
              if (((_h = value.usage.completion_tokens_details) == null ? void 0 : _h.accepted_prediction_tokens) != null) {
                providerMetadata.openai.acceptedPredictionTokens = (_i = value.usage.completion_tokens_details) == null ? void 0 : _i.accepted_prediction_tokens;
              }
              if (((_j = value.usage.completion_tokens_details) == null ? void 0 : _j.rejected_prediction_tokens) != null) {
                providerMetadata.openai.rejectedPredictionTokens = (_k = value.usage.completion_tokens_details) == null ? void 0 : _k.rejected_prediction_tokens;
              }
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapOpenAIFinishReason(choice.finish_reason);
            }
            if (((_l = choice == null ? void 0 : choice.logprobs) == null ? void 0 : _l.content) != null) {
              providerMetadata.openai.logprobs = choice.logprobs.content;
            }
            if ((choice == null ? void 0 : choice.delta) == null) {
              return;
            }
            const delta = choice.delta;
            if (delta.content != null) {
              if (!isActiveText) {
                controller.enqueue({ type: "text-start", id: "0" });
                isActiveText = true;
              }
              controller.enqueue({
                type: "text-delta",
                id: "0",
                delta: delta.content
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
                  if (((_m = toolCallDelta.function) == null ? void 0 : _m.name) == null) {
                    throw new import_provider3.InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`
                    });
                  }
                  controller.enqueue({
                    type: "tool-input-start",
                    id: toolCallDelta.id,
                    toolName: toolCallDelta.function.name
                  });
                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: "function",
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: (_n = toolCallDelta.function.arguments) != null ? _n : ""
                    },
                    hasFinished: false
                  };
                  const toolCall2 = toolCalls[index];
                  if (((_o = toolCall2.function) == null ? void 0 : _o.name) != null && ((_p = toolCall2.function) == null ? void 0 : _p.arguments) != null) {
                    if (toolCall2.function.arguments.length > 0) {
                      controller.enqueue({
                        type: "tool-input-delta",
                        id: toolCall2.id,
                        delta: toolCall2.function.arguments
                      });
                    }
                    if ((0, import_provider_utils5.isParsableJson)(toolCall2.function.arguments)) {
                      controller.enqueue({
                        type: "tool-input-end",
                        id: toolCall2.id
                      });
                      controller.enqueue({
                        type: "tool-call",
                        toolCallId: (_q = toolCall2.id) != null ? _q : (0, import_provider_utils5.generateId)(),
                        toolName: toolCall2.function.name,
                        input: toolCall2.function.arguments
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
                if (((_r = toolCallDelta.function) == null ? void 0 : _r.arguments) != null) {
                  toolCall.function.arguments += (_t = (_s = toolCallDelta.function) == null ? void 0 : _s.arguments) != null ? _t : "";
                }
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.id,
                  delta: (_u = toolCallDelta.function.arguments) != null ? _u : ""
                });
                if (((_v = toolCall.function) == null ? void 0 : _v.name) != null && ((_w = toolCall.function) == null ? void 0 : _w.arguments) != null && (0, import_provider_utils5.isParsableJson)(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCall.id
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: (_x = toolCall.id) != null ? _x : (0, import_provider_utils5.generateId)(),
                    toolName: toolCall.function.name,
                    input: toolCall.function.arguments
                  });
                  toolCall.hasFinished = true;
                }
              }
            }
            if (delta.annotations != null) {
              for (const annotation of delta.annotations) {
                controller.enqueue({
                  type: "source",
                  sourceType: "url",
                  id: (0, import_provider_utils5.generateId)(),
                  url: annotation.url,
                  title: annotation.title
                });
              }
            }
          },
          flush(controller) {
            if (isActiveText) {
              controller.enqueue({ type: "text-end", id: "0" });
            }
            controller.enqueue({
              type: "finish",
              finishReason,
              usage,
              ...providerMetadata != null ? { providerMetadata } : {}
            });
          }
        })
      ),
      request: { body },
      response: { headers: responseHeaders }
    };
  }
};
function isReasoningModel(modelId) {
  return (modelId.startsWith("o") || modelId.startsWith("gpt-5")) && !modelId.startsWith("gpt-5-chat");
}
function supportsFlexProcessing(modelId) {
  return modelId.startsWith("o3") || modelId.startsWith("o4-mini") || modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-chat");
}
function supportsPriorityProcessing(modelId) {
  return modelId.startsWith("gpt-4") || modelId.startsWith("gpt-5-mini") || modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-nano") && !modelId.startsWith("gpt-5-chat") || modelId.startsWith("o3") || modelId.startsWith("o4-mini");
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

// src/completion/openai-completion-language-model.ts
var import_provider_utils8 = require("@ai-sdk/provider-utils");

// src/completion/convert-to-openai-completion-prompt.ts
var import_provider4 = require("@ai-sdk/provider");
function convertToOpenAICompletionPrompt({
  prompt,
  user = "user",
  assistant = "assistant"
}) {
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
          }
        }).filter(Boolean).join("");
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

// src/completion/get-response-metadata.ts
function getResponseMetadata2({
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

// src/completion/map-openai-finish-reason.ts
function mapOpenAIFinishReason2(finishReason) {
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

// src/completion/openai-completion-api.ts
var import_v44 = require("zod/v4");
var import_provider_utils6 = require("@ai-sdk/provider-utils");
var openaiCompletionResponseSchema = (0, import_provider_utils6.lazyValidator)(
  () => (0, import_provider_utils6.zodSchema)(
    import_v44.z.object({
      id: import_v44.z.string().nullish(),
      created: import_v44.z.number().nullish(),
      model: import_v44.z.string().nullish(),
      choices: import_v44.z.array(
        import_v44.z.object({
          text: import_v44.z.string(),
          finish_reason: import_v44.z.string(),
          logprobs: import_v44.z.object({
            tokens: import_v44.z.array(import_v44.z.string()),
            token_logprobs: import_v44.z.array(import_v44.z.number()),
            top_logprobs: import_v44.z.array(import_v44.z.record(import_v44.z.string(), import_v44.z.number())).nullish()
          }).nullish()
        })
      ),
      usage: import_v44.z.object({
        prompt_tokens: import_v44.z.number(),
        completion_tokens: import_v44.z.number(),
        total_tokens: import_v44.z.number()
      }).nullish()
    })
  )
);
var openaiCompletionChunkSchema = (0, import_provider_utils6.lazyValidator)(
  () => (0, import_provider_utils6.zodSchema)(
    import_v44.z.union([
      import_v44.z.object({
        id: import_v44.z.string().nullish(),
        created: import_v44.z.number().nullish(),
        model: import_v44.z.string().nullish(),
        choices: import_v44.z.array(
          import_v44.z.object({
            text: import_v44.z.string(),
            finish_reason: import_v44.z.string().nullish(),
            index: import_v44.z.number(),
            logprobs: import_v44.z.object({
              tokens: import_v44.z.array(import_v44.z.string()),
              token_logprobs: import_v44.z.array(import_v44.z.number()),
              top_logprobs: import_v44.z.array(import_v44.z.record(import_v44.z.string(), import_v44.z.number())).nullish()
            }).nullish()
          })
        ),
        usage: import_v44.z.object({
          prompt_tokens: import_v44.z.number(),
          completion_tokens: import_v44.z.number(),
          total_tokens: import_v44.z.number()
        }).nullish()
      }),
      openaiErrorDataSchema
    ])
  )
);

// src/completion/openai-completion-options.ts
var import_provider_utils7 = require("@ai-sdk/provider-utils");
var import_v45 = require("zod/v4");
var openaiCompletionProviderOptions = (0, import_provider_utils7.lazyValidator)(
  () => (0, import_provider_utils7.zodSchema)(
    import_v45.z.object({
      /**
      Echo back the prompt in addition to the completion.
         */
      echo: import_v45.z.boolean().optional(),
      /**
      Modify the likelihood of specified tokens appearing in the completion.
      
      Accepts a JSON object that maps tokens (specified by their token ID in
      the GPT tokenizer) to an associated bias value from -100 to 100. You
      can use this tokenizer tool to convert text to token IDs. Mathematically,
      the bias is added to the logits generated by the model prior to sampling.
      The exact effect will vary per model, but values between -1 and 1 should
      decrease or increase likelihood of selection; values like -100 or 100
      should result in a ban or exclusive selection of the relevant token.
      
      As an example, you can pass {"50256": -100} to prevent the <|endoftext|>
      token from being generated.
       */
      logitBias: import_v45.z.record(import_v45.z.string(), import_v45.z.number()).optional(),
      /**
      The suffix that comes after a completion of inserted text.
       */
      suffix: import_v45.z.string().optional(),
      /**
      A unique identifier representing your end-user, which can help OpenAI to
      monitor and detect abuse. Learn more.
       */
      user: import_v45.z.string().optional(),
      /**
      Return the log probabilities of the tokens. Including logprobs will increase
      the response size and can slow down response times. However, it can
      be useful to better understand how the model is behaving.
      Setting to true will return the log probabilities of the tokens that
      were generated.
      Setting to a number will return the log probabilities of the top n
      tokens that were generated.
         */
      logprobs: import_v45.z.union([import_v45.z.boolean(), import_v45.z.number()]).optional()
    })
  )
);

// src/completion/openai-completion-language-model.ts
var OpenAICompletionLanguageModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    this.supportedUrls = {
      // No URLs are supported for completion models.
    };
    this.modelId = modelId;
    this.config = config;
  }
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences: userStopSequences,
    responseFormat,
    tools,
    toolChoice,
    seed,
    providerOptions
  }) {
    const warnings = [];
    const openaiOptions = {
      ...await (0, import_provider_utils8.parseProviderOptions)({
        provider: "openai",
        providerOptions,
        schema: openaiCompletionProviderOptions
      }),
      ...await (0, import_provider_utils8.parseProviderOptions)({
        provider: this.providerOptionsName,
        providerOptions,
        schema: openaiCompletionProviderOptions
      })
    };
    if (topK != null) {
      warnings.push({ type: "unsupported-setting", setting: "topK" });
    }
    if (tools == null ? void 0 : tools.length) {
      warnings.push({ type: "unsupported-setting", setting: "tools" });
    }
    if (toolChoice != null) {
      warnings.push({ type: "unsupported-setting", setting: "toolChoice" });
    }
    if (responseFormat != null && responseFormat.type !== "text") {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format is not supported."
      });
    }
    const { prompt: completionPrompt, stopSequences } = convertToOpenAICompletionPrompt({ prompt });
    const stop = [...stopSequences != null ? stopSequences : [], ...userStopSequences != null ? userStopSequences : []];
    return {
      args: {
        // model id:
        model: this.modelId,
        // model specific settings:
        echo: openaiOptions.echo,
        logit_bias: openaiOptions.logitBias,
        logprobs: (openaiOptions == null ? void 0 : openaiOptions.logprobs) === true ? 0 : (openaiOptions == null ? void 0 : openaiOptions.logprobs) === false ? void 0 : openaiOptions == null ? void 0 : openaiOptions.logprobs,
        suffix: openaiOptions.suffix,
        user: openaiOptions.user,
        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        seed,
        // prompt:
        prompt: completionPrompt,
        // stop sequences:
        stop: stop.length > 0 ? stop : void 0
      },
      warnings
    };
  }
  async doGenerate(options) {
    var _a, _b, _c;
    const { args, warnings } = await this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils8.postJsonToApi)({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils8.combineHeaders)(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils8.createJsonResponseHandler)(
        openaiCompletionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const choice = response.choices[0];
    const providerMetadata = { openai: {} };
    if (choice.logprobs != null) {
      providerMetadata.openai.logprobs = choice.logprobs;
    }
    return {
      content: [{ type: "text", text: choice.text }],
      usage: {
        inputTokens: (_a = response.usage) == null ? void 0 : _a.prompt_tokens,
        outputTokens: (_b = response.usage) == null ? void 0 : _b.completion_tokens,
        totalTokens: (_c = response.usage) == null ? void 0 : _c.total_tokens
      },
      finishReason: mapOpenAIFinishReason2(choice.finish_reason),
      request: { body: args },
      response: {
        ...getResponseMetadata2(response),
        headers: responseHeaders,
        body: rawResponse
      },
      providerMetadata,
      warnings
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };
    const { responseHeaders, value: response } = await (0, import_provider_utils8.postJsonToApi)({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils8.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils8.createEventSourceResponseHandler)(
        openaiCompletionChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    let finishReason = "unknown";
    const providerMetadata = { openai: {} };
    const usage = {
      inputTokens: void 0,
      outputTokens: void 0,
      totalTokens: void 0
    };
    let isFirstChunk = true;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
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
                ...getResponseMetadata2(value)
              });
              controller.enqueue({ type: "text-start", id: "0" });
            }
            if (value.usage != null) {
              usage.inputTokens = value.usage.prompt_tokens;
              usage.outputTokens = value.usage.completion_tokens;
              usage.totalTokens = value.usage.total_tokens;
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapOpenAIFinishReason2(choice.finish_reason);
            }
            if ((choice == null ? void 0 : choice.logprobs) != null) {
              providerMetadata.openai.logprobs = choice.logprobs;
            }
            if ((choice == null ? void 0 : choice.text) != null && choice.text.length > 0) {
              controller.enqueue({
                type: "text-delta",
                id: "0",
                delta: choice.text
              });
            }
          },
          flush(controller) {
            if (!isFirstChunk) {
              controller.enqueue({ type: "text-end", id: "0" });
            }
            controller.enqueue({
              type: "finish",
              finishReason,
              providerMetadata,
              usage
            });
          }
        })
      ),
      request: { body },
      response: { headers: responseHeaders }
    };
  }
};

// src/embedding/openai-embedding-model.ts
var import_provider5 = require("@ai-sdk/provider");
var import_provider_utils11 = require("@ai-sdk/provider-utils");

// src/embedding/openai-embedding-options.ts
var import_provider_utils9 = require("@ai-sdk/provider-utils");
var import_v46 = require("zod/v4");
var openaiEmbeddingProviderOptions = (0, import_provider_utils9.lazyValidator)(
  () => (0, import_provider_utils9.zodSchema)(
    import_v46.z.object({
      /**
      The number of dimensions the resulting output embeddings should have.
      Only supported in text-embedding-3 and later models.
         */
      dimensions: import_v46.z.number().optional(),
      /**
      A unique identifier representing your end-user, which can help OpenAI to
      monitor and detect abuse. Learn more.
      */
      user: import_v46.z.string().optional()
    })
  )
);

// src/embedding/openai-embedding-api.ts
var import_provider_utils10 = require("@ai-sdk/provider-utils");
var import_v47 = require("zod/v4");
var openaiTextEmbeddingResponseSchema = (0, import_provider_utils10.lazyValidator)(
  () => (0, import_provider_utils10.zodSchema)(
    import_v47.z.object({
      data: import_v47.z.array(import_v47.z.object({ embedding: import_v47.z.array(import_v47.z.number()) })),
      usage: import_v47.z.object({ prompt_tokens: import_v47.z.number() }).nullish()
    })
  )
);

// src/embedding/openai-embedding-model.ts
var OpenAIEmbeddingModel = class {
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
    var _a;
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new import_provider5.TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      });
    }
    const openaiOptions = (_a = await (0, import_provider_utils11.parseProviderOptions)({
      provider: "openai",
      providerOptions,
      schema: openaiEmbeddingProviderOptions
    })) != null ? _a : {};
    const {
      responseHeaders,
      value: response,
      rawValue
    } = await (0, import_provider_utils11.postJsonToApi)({
      url: this.config.url({
        path: "/embeddings",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils11.combineHeaders)(this.config.headers(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: "float",
        dimensions: openaiOptions.dimensions,
        user: openaiOptions.user
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils11.createJsonResponseHandler)(
        openaiTextEmbeddingResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      embeddings: response.data.map((item) => item.embedding),
      usage: response.usage ? { tokens: response.usage.prompt_tokens } : void 0,
      response: { headers: responseHeaders, body: rawValue }
    };
  }
};

// src/image/openai-image-model.ts
var import_provider_utils13 = require("@ai-sdk/provider-utils");

// src/image/openai-image-api.ts
var import_provider_utils12 = require("@ai-sdk/provider-utils");
var import_v48 = require("zod/v4");
var openaiImageResponseSchema = (0, import_provider_utils12.lazyValidator)(
  () => (0, import_provider_utils12.zodSchema)(
    import_v48.z.object({
      data: import_v48.z.array(
        import_v48.z.object({
          b64_json: import_v48.z.string(),
          revised_prompt: import_v48.z.string().optional()
        })
      )
    })
  )
);

// src/image/openai-image-options.ts
var modelMaxImagesPerCall = {
  "dall-e-3": 1,
  "dall-e-2": 10,
  "gpt-image-1": 10,
  "gpt-image-1-mini": 10
};
var hasDefaultResponseFormat = /* @__PURE__ */ new Set([
  "gpt-image-1",
  "gpt-image-1-mini"
]);

// src/image/openai-image-model.ts
var OpenAIImageModel = class {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
    this.specificationVersion = "v2";
  }
  get maxImagesPerCall() {
    var _a;
    return (_a = modelMaxImagesPerCall[this.modelId]) != null ? _a : 1;
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
    const { value: response, responseHeaders } = await (0, import_provider_utils13.postJsonToApi)({
      url: this.config.url({
        path: "/images/generations",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils13.combineHeaders)(this.config.headers(), headers),
      body: {
        model: this.modelId,
        prompt,
        n,
        size,
        ...(_d = providerOptions.openai) != null ? _d : {},
        ...!hasDefaultResponseFormat.has(this.modelId) ? { response_format: "b64_json" } : {}
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils13.createJsonResponseHandler)(
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
      },
      providerMetadata: {
        openai: {
          images: response.data.map(
            (item) => item.revised_prompt ? {
              revisedPrompt: item.revised_prompt
            } : null
          )
        }
      }
    };
  }
};

// src/tool/code-interpreter.ts
var import_provider_utils14 = require("@ai-sdk/provider-utils");
var import_v49 = require("zod/v4");
var codeInterpreterInputSchema = (0, import_provider_utils14.lazySchema)(
  () => (0, import_provider_utils14.zodSchema)(
    import_v49.z.object({
      code: import_v49.z.string().nullish(),
      containerId: import_v49.z.string()
    })
  )
);
var codeInterpreterOutputSchema = (0, import_provider_utils14.lazySchema)(
  () => (0, import_provider_utils14.zodSchema)(
    import_v49.z.object({
      outputs: import_v49.z.array(
        import_v49.z.discriminatedUnion("type", [
          import_v49.z.object({ type: import_v49.z.literal("logs"), logs: import_v49.z.string() }),
          import_v49.z.object({ type: import_v49.z.literal("image"), url: import_v49.z.string() })
        ])
      ).nullish()
    })
  )
);
var codeInterpreterArgsSchema = (0, import_provider_utils14.lazySchema)(
  () => (0, import_provider_utils14.zodSchema)(
    import_v49.z.object({
      container: import_v49.z.union([
        import_v49.z.string(),
        import_v49.z.object({
          fileIds: import_v49.z.array(import_v49.z.string()).optional()
        })
      ]).optional()
    })
  )
);
var codeInterpreterToolFactory = (0, import_provider_utils14.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "openai.code_interpreter",
  name: "code_interpreter",
  inputSchema: codeInterpreterInputSchema,
  outputSchema: codeInterpreterOutputSchema
});
var codeInterpreter = (args = {}) => {
  return codeInterpreterToolFactory(args);
};

// src/tool/file-search.ts
var import_provider_utils15 = require("@ai-sdk/provider-utils");
var import_v410 = require("zod/v4");
var comparisonFilterSchema = import_v410.z.object({
  key: import_v410.z.string(),
  type: import_v410.z.enum(["eq", "ne", "gt", "gte", "lt", "lte"]),
  value: import_v410.z.union([import_v410.z.string(), import_v410.z.number(), import_v410.z.boolean()])
});
var compoundFilterSchema = import_v410.z.object({
  type: import_v410.z.enum(["and", "or"]),
  filters: import_v410.z.array(
    import_v410.z.union([comparisonFilterSchema, import_v410.z.lazy(() => compoundFilterSchema)])
  )
});
var fileSearchArgsSchema = (0, import_provider_utils15.lazySchema)(
  () => (0, import_provider_utils15.zodSchema)(
    import_v410.z.object({
      vectorStoreIds: import_v410.z.array(import_v410.z.string()),
      maxNumResults: import_v410.z.number().optional(),
      ranking: import_v410.z.object({
        ranker: import_v410.z.string().optional(),
        scoreThreshold: import_v410.z.number().optional()
      }).optional(),
      filters: import_v410.z.union([comparisonFilterSchema, compoundFilterSchema]).optional()
    })
  )
);
var fileSearchOutputSchema = (0, import_provider_utils15.lazySchema)(
  () => (0, import_provider_utils15.zodSchema)(
    import_v410.z.object({
      queries: import_v410.z.array(import_v410.z.string()),
      results: import_v410.z.array(
        import_v410.z.object({
          attributes: import_v410.z.record(import_v410.z.string(), import_v410.z.unknown()),
          fileId: import_v410.z.string(),
          filename: import_v410.z.string(),
          score: import_v410.z.number(),
          text: import_v410.z.string()
        })
      ).nullable()
    })
  )
);
var fileSearch = (0, import_provider_utils15.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "openai.file_search",
  name: "file_search",
  inputSchema: import_v410.z.object({}),
  outputSchema: fileSearchOutputSchema
});

// src/tool/image-generation.ts
var import_provider_utils16 = require("@ai-sdk/provider-utils");
var import_v411 = require("zod/v4");
var imageGenerationArgsSchema = (0, import_provider_utils16.lazySchema)(
  () => (0, import_provider_utils16.zodSchema)(
    import_v411.z.object({
      background: import_v411.z.enum(["auto", "opaque", "transparent"]).optional(),
      inputFidelity: import_v411.z.enum(["low", "high"]).optional(),
      inputImageMask: import_v411.z.object({
        fileId: import_v411.z.string().optional(),
        imageUrl: import_v411.z.string().optional()
      }).optional(),
      model: import_v411.z.string().optional(),
      moderation: import_v411.z.enum(["auto"]).optional(),
      outputCompression: import_v411.z.number().int().min(0).max(100).optional(),
      outputFormat: import_v411.z.enum(["png", "jpeg", "webp"]).optional(),
      partialImages: import_v411.z.number().int().min(0).max(3).optional(),
      quality: import_v411.z.enum(["auto", "low", "medium", "high"]).optional(),
      size: import_v411.z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]).optional()
    }).strict()
  )
);
var imageGenerationInputSchema = (0, import_provider_utils16.lazySchema)(() => (0, import_provider_utils16.zodSchema)(import_v411.z.object({})));
var imageGenerationOutputSchema = (0, import_provider_utils16.lazySchema)(
  () => (0, import_provider_utils16.zodSchema)(import_v411.z.object({ result: import_v411.z.string() }))
);
var imageGenerationToolFactory = (0, import_provider_utils16.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "openai.image_generation",
  name: "image_generation",
  inputSchema: imageGenerationInputSchema,
  outputSchema: imageGenerationOutputSchema
});
var imageGeneration = (args = {}) => {
  return imageGenerationToolFactory(args);
};

// src/tool/local-shell.ts
var import_provider_utils17 = require("@ai-sdk/provider-utils");
var import_v412 = require("zod/v4");
var localShellInputSchema = (0, import_provider_utils17.lazySchema)(
  () => (0, import_provider_utils17.zodSchema)(
    import_v412.z.object({
      action: import_v412.z.object({
        type: import_v412.z.literal("exec"),
        command: import_v412.z.array(import_v412.z.string()),
        timeoutMs: import_v412.z.number().optional(),
        user: import_v412.z.string().optional(),
        workingDirectory: import_v412.z.string().optional(),
        env: import_v412.z.record(import_v412.z.string(), import_v412.z.string()).optional()
      })
    })
  )
);
var localShellOutputSchema = (0, import_provider_utils17.lazySchema)(
  () => (0, import_provider_utils17.zodSchema)(import_v412.z.object({ output: import_v412.z.string() }))
);
var localShell = (0, import_provider_utils17.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "openai.local_shell",
  name: "local_shell",
  inputSchema: localShellInputSchema,
  outputSchema: localShellOutputSchema
});

// src/tool/web-search.ts
var import_provider_utils18 = require("@ai-sdk/provider-utils");
var import_v413 = require("zod/v4");
var webSearchArgsSchema = (0, import_provider_utils18.lazySchema)(
  () => (0, import_provider_utils18.zodSchema)(
    import_v413.z.object({
      filters: import_v413.z.object({ allowedDomains: import_v413.z.array(import_v413.z.string()).optional() }).optional(),
      searchContextSize: import_v413.z.enum(["low", "medium", "high"]).optional(),
      userLocation: import_v413.z.object({
        type: import_v413.z.literal("approximate"),
        country: import_v413.z.string().optional(),
        city: import_v413.z.string().optional(),
        region: import_v413.z.string().optional(),
        timezone: import_v413.z.string().optional()
      }).optional()
    })
  )
);
var webSearchInputSchema = (0, import_provider_utils18.lazySchema)(() => (0, import_provider_utils18.zodSchema)(import_v413.z.object({})));
var webSearchOutputSchema = (0, import_provider_utils18.lazySchema)(
  () => (0, import_provider_utils18.zodSchema)(
    import_v413.z.object({
      action: import_v413.z.discriminatedUnion("type", [
        import_v413.z.object({
          type: import_v413.z.literal("search"),
          query: import_v413.z.string().optional()
        }),
        import_v413.z.object({
          type: import_v413.z.literal("openPage"),
          url: import_v413.z.string()
        }),
        import_v413.z.object({
          type: import_v413.z.literal("find"),
          url: import_v413.z.string(),
          pattern: import_v413.z.string()
        })
      ])
    })
  )
);
var webSearchToolFactory = (0, import_provider_utils18.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "openai.web_search",
  name: "web_search",
  inputSchema: webSearchInputSchema,
  outputSchema: webSearchOutputSchema
});
var webSearch = (args = {}) => webSearchToolFactory(args);

// src/tool/web-search-preview.ts
var import_provider_utils19 = require("@ai-sdk/provider-utils");
var import_v414 = require("zod/v4");
var webSearchPreviewArgsSchema = (0, import_provider_utils19.lazySchema)(
  () => (0, import_provider_utils19.zodSchema)(
    import_v414.z.object({
      searchContextSize: import_v414.z.enum(["low", "medium", "high"]).optional(),
      userLocation: import_v414.z.object({
        type: import_v414.z.literal("approximate"),
        country: import_v414.z.string().optional(),
        city: import_v414.z.string().optional(),
        region: import_v414.z.string().optional(),
        timezone: import_v414.z.string().optional()
      }).optional()
    })
  )
);
var webSearchPreviewInputSchema = (0, import_provider_utils19.lazySchema)(
  () => (0, import_provider_utils19.zodSchema)(import_v414.z.object({}))
);
var webSearchPreviewOutputSchema = (0, import_provider_utils19.lazySchema)(
  () => (0, import_provider_utils19.zodSchema)(
    import_v414.z.object({
      action: import_v414.z.discriminatedUnion("type", [
        import_v414.z.object({
          type: import_v414.z.literal("search"),
          query: import_v414.z.string().optional()
        }),
        import_v414.z.object({
          type: import_v414.z.literal("openPage"),
          url: import_v414.z.string()
        }),
        import_v414.z.object({
          type: import_v414.z.literal("find"),
          url: import_v414.z.string(),
          pattern: import_v414.z.string()
        })
      ])
    })
  )
);
var webSearchPreview = (0, import_provider_utils19.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "openai.web_search_preview",
  name: "web_search_preview",
  inputSchema: webSearchPreviewInputSchema,
  outputSchema: webSearchPreviewOutputSchema
});

// src/openai-tools.ts
var openaiTools = {
  /**
   * The Code Interpreter tool allows models to write and run Python code in a
   * sandboxed environment to solve complex problems in domains like data analysis,
   * coding, and math.
   *
   * @param container - The container to use for the code interpreter.
   *
   * Must have name `code_interpreter`.
   */
  codeInterpreter,
  /**
   * File search is a tool available in the Responses API. It enables models to
   * retrieve information in a knowledge base of previously uploaded files through
   * semantic and keyword search.
   *
   * Must have name `file_search`.
   *
   * @param vectorStoreIds - The vector store IDs to use for the file search.
   * @param maxNumResults - The maximum number of results to return.
   * @param ranking - The ranking options to use for the file search.
   * @param filters - The filters to use for the file search.
   */
  fileSearch,
  /**
   * The image generation tool allows you to generate images using a text prompt,
   * and optionally image inputs. It leverages the GPT Image model,
   * and automatically optimizes text inputs for improved performance.
   *
   * Must have name `image_generation`.
   *
   * @param size - Image dimensions (e.g., 1024x1024, 1024x1536)
   * @param quality - Rendering quality (e.g. low, medium, high)
   * @param format - File output format
   * @param compression - Compression level (0-100%) for JPEG and WebP formats
   * @param background - Transparent or opaque
   */
  imageGeneration,
  /**
   * Local shell is a tool that allows agents to run shell commands locally
   * on a machine you or the user provides.
   *
   * Supported models: `gpt-5-codex` and `codex-mini-latest`
   *
   * Must have name `local_shell`.
   */
  localShell,
  /**
   * Web search allows models to access up-to-date information from the internet
   * and provide answers with sourced citations.
   *
   * Must have name `web_search_preview`.
   *
   * @param searchContextSize - The search context size to use for the web search.
   * @param userLocation - The user location to use for the web search.
   *
   * @deprecated Use `webSearch` instead.
   */
  webSearchPreview,
  /**
   * Web search allows models to access up-to-date information from the internet
   * and provide answers with sourced citations.
   *
   * Must have name `web_search`.
   *
   * @param filters - The filters to use for the web search.
   * @param searchContextSize - The search context size to use for the web search.
   * @param userLocation - The user location to use for the web search.
   */
  webSearch
};

// src/responses/openai-responses-language-model.ts
var import_provider8 = require("@ai-sdk/provider");
var import_provider_utils24 = require("@ai-sdk/provider-utils");

// src/responses/convert-to-openai-responses-input.ts
var import_provider6 = require("@ai-sdk/provider");
var import_provider_utils20 = require("@ai-sdk/provider-utils");
var import_v415 = require("zod/v4");
function isFileId(data, prefixes) {
  if (!prefixes) return false;
  return prefixes.some((prefix) => data.startsWith(prefix));
}
async function convertToOpenAIResponsesInput({
  prompt,
  systemMessageMode,
  fileIdPrefixes,
  store,
  hasLocalShellTool = false
}) {
  var _a, _b, _c, _d;
  const input = [];
  const warnings = [];
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        switch (systemMessageMode) {
          case "system": {
            input.push({ role: "system", content });
            break;
          }
          case "developer": {
            input.push({ role: "developer", content });
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
        input.push({
          role: "user",
          content: content.map((part, index) => {
            var _a2, _b2, _c2;
            switch (part.type) {
              case "text": {
                return { type: "input_text", text: part.text };
              }
              case "file": {
                if (part.mediaType.startsWith("image/")) {
                  const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType;
                  return {
                    type: "input_image",
                    ...part.data instanceof URL ? { image_url: part.data.toString() } : typeof part.data === "string" && isFileId(part.data, fileIdPrefixes) ? { file_id: part.data } : {
                      image_url: `data:${mediaType};base64,${(0, import_provider_utils20.convertToBase64)(part.data)}`
                    },
                    detail: (_b2 = (_a2 = part.providerOptions) == null ? void 0 : _a2.openai) == null ? void 0 : _b2.imageDetail
                  };
                } else if (part.mediaType === "application/pdf") {
                  if (part.data instanceof URL) {
                    return {
                      type: "input_file",
                      file_url: part.data.toString()
                    };
                  }
                  return {
                    type: "input_file",
                    ...typeof part.data === "string" && isFileId(part.data, fileIdPrefixes) ? { file_id: part.data } : {
                      filename: (_c2 = part.filename) != null ? _c2 : `part-${index}.pdf`,
                      file_data: `data:application/pdf;base64,${(0, import_provider_utils20.convertToBase64)(part.data)}`
                    }
                  };
                } else {
                  throw new import_provider6.UnsupportedFunctionalityError({
                    functionality: `file part media type ${part.mediaType}`
                  });
                }
              }
            }
          })
        });
        break;
      }
      case "assistant": {
        const reasoningMessages = {};
        const toolCallParts = {};
        for (const part of content) {
          switch (part.type) {
            case "text": {
              const id = (_b = (_a = part.providerOptions) == null ? void 0 : _a.openai) == null ? void 0 : _b.itemId;
              if (store && id != null) {
                input.push({ type: "item_reference", id });
                break;
              }
              input.push({
                role: "assistant",
                content: [{ type: "output_text", text: part.text }],
                id
              });
              break;
            }
            case "tool-call": {
              toolCallParts[part.toolCallId] = part;
              if (part.providerExecuted) {
                break;
              }
              const id = (_d = (_c = part.providerOptions) == null ? void 0 : _c.openai) == null ? void 0 : _d.itemId;
              if (store && id != null) {
                input.push({ type: "item_reference", id });
                break;
              }
              if (hasLocalShellTool && part.toolName === "local_shell") {
                const parsedInput = await (0, import_provider_utils20.validateTypes)({
                  value: part.input,
                  schema: localShellInputSchema
                });
                input.push({
                  type: "local_shell_call",
                  call_id: part.toolCallId,
                  id,
                  action: {
                    type: "exec",
                    command: parsedInput.action.command,
                    timeout_ms: parsedInput.action.timeoutMs,
                    user: parsedInput.action.user,
                    working_directory: parsedInput.action.workingDirectory,
                    env: parsedInput.action.env
                  }
                });
                break;
              }
              input.push({
                type: "function_call",
                call_id: part.toolCallId,
                name: part.toolName,
                arguments: JSON.stringify(part.input),
                id
              });
              break;
            }
            // assistant tool result parts are from provider-executed tools:
            case "tool-result": {
              if (store) {
                input.push({ type: "item_reference", id: part.toolCallId });
              } else {
                warnings.push({
                  type: "other",
                  message: `Results for OpenAI tool ${part.toolName} are not sent to the API when store is false`
                });
              }
              break;
            }
            case "reasoning": {
              const providerOptions = await (0, import_provider_utils20.parseProviderOptions)({
                provider: "openai",
                providerOptions: part.providerOptions,
                schema: openaiResponsesReasoningProviderOptionsSchema
              });
              const reasoningId = providerOptions == null ? void 0 : providerOptions.itemId;
              if (reasoningId != null) {
                const reasoningMessage = reasoningMessages[reasoningId];
                if (store) {
                  if (reasoningMessage === void 0) {
                    input.push({ type: "item_reference", id: reasoningId });
                    reasoningMessages[reasoningId] = {
                      type: "reasoning",
                      id: reasoningId,
                      summary: []
                    };
                  }
                } else {
                  const summaryParts = [];
                  if (part.text.length > 0) {
                    summaryParts.push({
                      type: "summary_text",
                      text: part.text
                    });
                  } else if (reasoningMessage !== void 0) {
                    warnings.push({
                      type: "other",
                      message: `Cannot append empty reasoning part to existing reasoning sequence. Skipping reasoning part: ${JSON.stringify(part)}.`
                    });
                  }
                  if (reasoningMessage === void 0) {
                    reasoningMessages[reasoningId] = {
                      type: "reasoning",
                      id: reasoningId,
                      encrypted_content: providerOptions == null ? void 0 : providerOptions.reasoningEncryptedContent,
                      summary: summaryParts
                    };
                    input.push(reasoningMessages[reasoningId]);
                  } else {
                    reasoningMessage.summary.push(...summaryParts);
                    if ((providerOptions == null ? void 0 : providerOptions.reasoningEncryptedContent) != null) {
                      reasoningMessage.encrypted_content = providerOptions.reasoningEncryptedContent;
                    }
                  }
                }
              } else {
                warnings.push({
                  type: "other",
                  message: `Non-OpenAI reasoning parts are not supported. Skipping reasoning part: ${JSON.stringify(part)}.`
                });
              }
              break;
            }
          }
        }
        break;
      }
      case "tool": {
        for (const part of content) {
          const output = part.output;
          if (hasLocalShellTool && part.toolName === "local_shell" && output.type === "json") {
            const parsedOutput = await (0, import_provider_utils20.validateTypes)({
              value: output.value,
              schema: localShellOutputSchema
            });
            input.push({
              type: "local_shell_call_output",
              call_id: part.toolCallId,
              output: parsedOutput.output
            });
            break;
          }
          let contentValue;
          switch (output.type) {
            case "text":
            case "error-text":
              contentValue = output.value;
              break;
            case "json":
            case "error-json":
              contentValue = JSON.stringify(output.value);
              break;
            case "content":
              contentValue = output.value.map((item) => {
                switch (item.type) {
                  case "text": {
                    return { type: "input_text", text: item.text };
                  }
                  case "media": {
                    return item.mediaType.startsWith("image/") ? {
                      type: "input_image",
                      image_url: `data:${item.mediaType};base64,${item.data}`
                    } : {
                      type: "input_file",
                      filename: "data",
                      file_data: `data:${item.mediaType};base64,${item.data}`
                    };
                  }
                }
              });
              break;
          }
          input.push({
            type: "function_call_output",
            call_id: part.toolCallId,
            output: contentValue
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
  return { input, warnings };
}
var openaiResponsesReasoningProviderOptionsSchema = import_v415.z.object({
  itemId: import_v415.z.string().nullish(),
  reasoningEncryptedContent: import_v415.z.string().nullish()
});

// src/responses/map-openai-responses-finish-reason.ts
function mapOpenAIResponseFinishReason({
  finishReason,
  hasFunctionCall
}) {
  switch (finishReason) {
    case void 0:
    case null:
      return hasFunctionCall ? "tool-calls" : "stop";
    case "max_output_tokens":
      return "length";
    case "content_filter":
      return "content-filter";
    default:
      return hasFunctionCall ? "tool-calls" : "unknown";
  }
}

// src/responses/openai-responses-api.ts
var import_provider_utils21 = require("@ai-sdk/provider-utils");
var import_v416 = require("zod/v4");
var openaiResponsesChunkSchema = (0, import_provider_utils21.lazyValidator)(
  () => (0, import_provider_utils21.zodSchema)(
    import_v416.z.union([
      import_v416.z.object({
        type: import_v416.z.literal("response.output_text.delta"),
        item_id: import_v416.z.string(),
        delta: import_v416.z.string(),
        logprobs: import_v416.z.array(
          import_v416.z.object({
            token: import_v416.z.string(),
            logprob: import_v416.z.number(),
            top_logprobs: import_v416.z.array(
              import_v416.z.object({
                token: import_v416.z.string(),
                logprob: import_v416.z.number()
              })
            )
          })
        ).nullish()
      }),
      import_v416.z.object({
        type: import_v416.z.enum(["response.completed", "response.incomplete"]),
        response: import_v416.z.object({
          incomplete_details: import_v416.z.object({ reason: import_v416.z.string() }).nullish(),
          usage: import_v416.z.object({
            input_tokens: import_v416.z.number(),
            input_tokens_details: import_v416.z.object({ cached_tokens: import_v416.z.number().nullish() }).nullish(),
            output_tokens: import_v416.z.number(),
            output_tokens_details: import_v416.z.object({ reasoning_tokens: import_v416.z.number().nullish() }).nullish()
          }),
          service_tier: import_v416.z.string().nullish()
        })
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.created"),
        response: import_v416.z.object({
          id: import_v416.z.string(),
          created_at: import_v416.z.number(),
          model: import_v416.z.string(),
          service_tier: import_v416.z.string().nullish()
        })
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.output_item.added"),
        output_index: import_v416.z.number(),
        item: import_v416.z.discriminatedUnion("type", [
          import_v416.z.object({
            type: import_v416.z.literal("message"),
            id: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("reasoning"),
            id: import_v416.z.string(),
            encrypted_content: import_v416.z.string().nullish()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("function_call"),
            id: import_v416.z.string(),
            call_id: import_v416.z.string(),
            name: import_v416.z.string(),
            arguments: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("web_search_call"),
            id: import_v416.z.string(),
            status: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("computer_call"),
            id: import_v416.z.string(),
            status: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("file_search_call"),
            id: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("image_generation_call"),
            id: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("code_interpreter_call"),
            id: import_v416.z.string(),
            container_id: import_v416.z.string(),
            code: import_v416.z.string().nullable(),
            outputs: import_v416.z.array(
              import_v416.z.discriminatedUnion("type", [
                import_v416.z.object({ type: import_v416.z.literal("logs"), logs: import_v416.z.string() }),
                import_v416.z.object({ type: import_v416.z.literal("image"), url: import_v416.z.string() })
              ])
            ).nullable(),
            status: import_v416.z.string()
          })
        ])
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.output_item.done"),
        output_index: import_v416.z.number(),
        item: import_v416.z.discriminatedUnion("type", [
          import_v416.z.object({
            type: import_v416.z.literal("message"),
            id: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("reasoning"),
            id: import_v416.z.string(),
            encrypted_content: import_v416.z.string().nullish()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("function_call"),
            id: import_v416.z.string(),
            call_id: import_v416.z.string(),
            name: import_v416.z.string(),
            arguments: import_v416.z.string(),
            status: import_v416.z.literal("completed")
          }),
          import_v416.z.object({
            type: import_v416.z.literal("code_interpreter_call"),
            id: import_v416.z.string(),
            code: import_v416.z.string().nullable(),
            container_id: import_v416.z.string(),
            outputs: import_v416.z.array(
              import_v416.z.discriminatedUnion("type", [
                import_v416.z.object({ type: import_v416.z.literal("logs"), logs: import_v416.z.string() }),
                import_v416.z.object({ type: import_v416.z.literal("image"), url: import_v416.z.string() })
              ])
            ).nullable()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("image_generation_call"),
            id: import_v416.z.string(),
            result: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("web_search_call"),
            id: import_v416.z.string(),
            status: import_v416.z.string(),
            action: import_v416.z.discriminatedUnion("type", [
              import_v416.z.object({
                type: import_v416.z.literal("search"),
                query: import_v416.z.string().nullish()
              }),
              import_v416.z.object({
                type: import_v416.z.literal("open_page"),
                url: import_v416.z.string()
              }),
              import_v416.z.object({
                type: import_v416.z.literal("find"),
                url: import_v416.z.string(),
                pattern: import_v416.z.string()
              })
            ])
          }),
          import_v416.z.object({
            type: import_v416.z.literal("file_search_call"),
            id: import_v416.z.string(),
            queries: import_v416.z.array(import_v416.z.string()),
            results: import_v416.z.array(
              import_v416.z.object({
                attributes: import_v416.z.record(import_v416.z.string(), import_v416.z.unknown()),
                file_id: import_v416.z.string(),
                filename: import_v416.z.string(),
                score: import_v416.z.number(),
                text: import_v416.z.string()
              })
            ).nullish()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("local_shell_call"),
            id: import_v416.z.string(),
            call_id: import_v416.z.string(),
            action: import_v416.z.object({
              type: import_v416.z.literal("exec"),
              command: import_v416.z.array(import_v416.z.string()),
              timeout_ms: import_v416.z.number().optional(),
              user: import_v416.z.string().optional(),
              working_directory: import_v416.z.string().optional(),
              env: import_v416.z.record(import_v416.z.string(), import_v416.z.string()).optional()
            })
          }),
          import_v416.z.object({
            type: import_v416.z.literal("computer_call"),
            id: import_v416.z.string(),
            status: import_v416.z.literal("completed")
          })
        ])
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.function_call_arguments.delta"),
        item_id: import_v416.z.string(),
        output_index: import_v416.z.number(),
        delta: import_v416.z.string()
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.image_generation_call.partial_image"),
        item_id: import_v416.z.string(),
        output_index: import_v416.z.number(),
        partial_image_b64: import_v416.z.string()
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.code_interpreter_call_code.delta"),
        item_id: import_v416.z.string(),
        output_index: import_v416.z.number(),
        delta: import_v416.z.string()
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.code_interpreter_call_code.done"),
        item_id: import_v416.z.string(),
        output_index: import_v416.z.number(),
        code: import_v416.z.string()
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.output_text.annotation.added"),
        annotation: import_v416.z.discriminatedUnion("type", [
          import_v416.z.object({
            type: import_v416.z.literal("url_citation"),
            url: import_v416.z.string(),
            title: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("file_citation"),
            file_id: import_v416.z.string(),
            filename: import_v416.z.string().nullish(),
            index: import_v416.z.number().nullish(),
            start_index: import_v416.z.number().nullish(),
            end_index: import_v416.z.number().nullish(),
            quote: import_v416.z.string().nullish()
          })
        ])
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.reasoning_summary_part.added"),
        item_id: import_v416.z.string(),
        summary_index: import_v416.z.number()
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.reasoning_summary_text.delta"),
        item_id: import_v416.z.string(),
        summary_index: import_v416.z.number(),
        delta: import_v416.z.string()
      }),
      import_v416.z.object({
        type: import_v416.z.literal("response.reasoning_summary_part.done"),
        item_id: import_v416.z.string(),
        summary_index: import_v416.z.number()
      }),
      import_v416.z.object({
        type: import_v416.z.literal("error"),
        code: import_v416.z.string(),
        message: import_v416.z.string(),
        param: import_v416.z.string().nullish(),
        sequence_number: import_v416.z.number()
      }),
      import_v416.z.object({ type: import_v416.z.string() }).loose().transform((value) => ({
        type: "unknown_chunk",
        message: value.type
      }))
      // fallback for unknown chunks
    ])
  )
);
var openaiResponsesResponseSchema = (0, import_provider_utils21.lazyValidator)(
  () => (0, import_provider_utils21.zodSchema)(
    import_v416.z.object({
      id: import_v416.z.string(),
      created_at: import_v416.z.number(),
      error: import_v416.z.object({
        code: import_v416.z.string(),
        message: import_v416.z.string()
      }).nullish(),
      model: import_v416.z.string(),
      output: import_v416.z.array(
        import_v416.z.discriminatedUnion("type", [
          import_v416.z.object({
            type: import_v416.z.literal("message"),
            role: import_v416.z.literal("assistant"),
            id: import_v416.z.string(),
            content: import_v416.z.array(
              import_v416.z.object({
                type: import_v416.z.literal("output_text"),
                text: import_v416.z.string(),
                logprobs: import_v416.z.array(
                  import_v416.z.object({
                    token: import_v416.z.string(),
                    logprob: import_v416.z.number(),
                    top_logprobs: import_v416.z.array(
                      import_v416.z.object({
                        token: import_v416.z.string(),
                        logprob: import_v416.z.number()
                      })
                    )
                  })
                ).nullish(),
                annotations: import_v416.z.array(
                  import_v416.z.discriminatedUnion("type", [
                    import_v416.z.object({
                      type: import_v416.z.literal("url_citation"),
                      start_index: import_v416.z.number(),
                      end_index: import_v416.z.number(),
                      url: import_v416.z.string(),
                      title: import_v416.z.string()
                    }),
                    import_v416.z.object({
                      type: import_v416.z.literal("file_citation"),
                      file_id: import_v416.z.string(),
                      filename: import_v416.z.string().nullish(),
                      index: import_v416.z.number().nullish(),
                      start_index: import_v416.z.number().nullish(),
                      end_index: import_v416.z.number().nullish(),
                      quote: import_v416.z.string().nullish()
                    }),
                    import_v416.z.object({
                      type: import_v416.z.literal("container_file_citation")
                    })
                  ])
                )
              })
            )
          }),
          import_v416.z.object({
            type: import_v416.z.literal("web_search_call"),
            id: import_v416.z.string(),
            status: import_v416.z.string(),
            action: import_v416.z.discriminatedUnion("type", [
              import_v416.z.object({
                type: import_v416.z.literal("search"),
                query: import_v416.z.string().nullish()
              }),
              import_v416.z.object({
                type: import_v416.z.literal("open_page"),
                url: import_v416.z.string()
              }),
              import_v416.z.object({
                type: import_v416.z.literal("find"),
                url: import_v416.z.string(),
                pattern: import_v416.z.string()
              })
            ])
          }),
          import_v416.z.object({
            type: import_v416.z.literal("file_search_call"),
            id: import_v416.z.string(),
            queries: import_v416.z.array(import_v416.z.string()),
            results: import_v416.z.array(
              import_v416.z.object({
                attributes: import_v416.z.record(import_v416.z.string(), import_v416.z.unknown()),
                file_id: import_v416.z.string(),
                filename: import_v416.z.string(),
                score: import_v416.z.number(),
                text: import_v416.z.string()
              })
            ).nullish()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("code_interpreter_call"),
            id: import_v416.z.string(),
            code: import_v416.z.string().nullable(),
            container_id: import_v416.z.string(),
            outputs: import_v416.z.array(
              import_v416.z.discriminatedUnion("type", [
                import_v416.z.object({ type: import_v416.z.literal("logs"), logs: import_v416.z.string() }),
                import_v416.z.object({ type: import_v416.z.literal("image"), url: import_v416.z.string() })
              ])
            ).nullable()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("image_generation_call"),
            id: import_v416.z.string(),
            result: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("local_shell_call"),
            id: import_v416.z.string(),
            call_id: import_v416.z.string(),
            action: import_v416.z.object({
              type: import_v416.z.literal("exec"),
              command: import_v416.z.array(import_v416.z.string()),
              timeout_ms: import_v416.z.number().optional(),
              user: import_v416.z.string().optional(),
              working_directory: import_v416.z.string().optional(),
              env: import_v416.z.record(import_v416.z.string(), import_v416.z.string()).optional()
            })
          }),
          import_v416.z.object({
            type: import_v416.z.literal("function_call"),
            call_id: import_v416.z.string(),
            name: import_v416.z.string(),
            arguments: import_v416.z.string(),
            id: import_v416.z.string()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("computer_call"),
            id: import_v416.z.string(),
            status: import_v416.z.string().optional()
          }),
          import_v416.z.object({
            type: import_v416.z.literal("reasoning"),
            id: import_v416.z.string(),
            encrypted_content: import_v416.z.string().nullish(),
            summary: import_v416.z.array(
              import_v416.z.object({
                type: import_v416.z.literal("summary_text"),
                text: import_v416.z.string()
              })
            )
          })
        ])
      ),
      service_tier: import_v416.z.string().nullish(),
      incomplete_details: import_v416.z.object({ reason: import_v416.z.string() }).nullish(),
      usage: import_v416.z.object({
        input_tokens: import_v416.z.number(),
        input_tokens_details: import_v416.z.object({ cached_tokens: import_v416.z.number().nullish() }).nullish(),
        output_tokens: import_v416.z.number(),
        output_tokens_details: import_v416.z.object({ reasoning_tokens: import_v416.z.number().nullish() }).nullish()
      })
    })
  )
);

// src/responses/openai-responses-options.ts
var import_provider_utils22 = require("@ai-sdk/provider-utils");
var import_v417 = require("zod/v4");
var TOP_LOGPROBS_MAX = 20;
var openaiResponsesReasoningModelIds = [
  "o1",
  "o1-2024-12-17",
  "o3-mini",
  "o3-mini-2025-01-31",
  "o3",
  "o3-2025-04-16",
  "o4-mini",
  "o4-mini-2025-04-16",
  "codex-mini-latest",
  "computer-use-preview",
  "gpt-5",
  "gpt-5-2025-08-07",
  "gpt-5-codex",
  "gpt-5-mini",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano",
  "gpt-5-nano-2025-08-07",
  "gpt-5-pro",
  "gpt-5-pro-2025-10-06"
];
var openaiResponsesModelIds = [
  "gpt-4.1",
  "gpt-4.1-2025-04-14",
  "gpt-4.1-mini",
  "gpt-4.1-mini-2025-04-14",
  "gpt-4.1-nano",
  "gpt-4.1-nano-2025-04-14",
  "gpt-4o",
  "gpt-4o-2024-05-13",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-11-20",
  "gpt-4o-audio-preview",
  "gpt-4o-audio-preview-2024-10-01",
  "gpt-4o-audio-preview-2024-12-17",
  "gpt-4o-search-preview",
  "gpt-4o-search-preview-2025-03-11",
  "gpt-4o-mini-search-preview",
  "gpt-4o-mini-search-preview-2025-03-11",
  "gpt-4o-mini",
  "gpt-4o-mini-2024-07-18",
  "gpt-4-turbo",
  "gpt-4-turbo-2024-04-09",
  "gpt-4-turbo-preview",
  "gpt-4-0125-preview",
  "gpt-4-1106-preview",
  "gpt-4",
  "gpt-4-0613",
  "gpt-4.5-preview",
  "gpt-4.5-preview-2025-02-27",
  "gpt-3.5-turbo-0125",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-1106",
  "chatgpt-4o-latest",
  "gpt-5-chat-latest",
  ...openaiResponsesReasoningModelIds
];
var openaiResponsesProviderOptionsSchema = (0, import_provider_utils22.lazyValidator)(
  () => (0, import_provider_utils22.zodSchema)(
    import_v417.z.object({
      include: import_v417.z.array(
        import_v417.z.enum([
          "reasoning.encrypted_content",
          // handled internally by default, only needed for unknown reasoning models
          "file_search_call.results",
          "message.output_text.logprobs"
        ])
      ).nullish(),
      instructions: import_v417.z.string().nullish(),
      /**
       * Return the log probabilities of the tokens.
       *
       * Setting to true will return the log probabilities of the tokens that
       * were generated.
       *
       * Setting to a number will return the log probabilities of the top n
       * tokens that were generated.
       *
       * @see https://platform.openai.com/docs/api-reference/responses/create
       * @see https://cookbook.openai.com/examples/using_logprobs
       */
      logprobs: import_v417.z.union([import_v417.z.boolean(), import_v417.z.number().min(1).max(TOP_LOGPROBS_MAX)]).optional(),
      /**
       * The maximum number of total calls to built-in tools that can be processed in a response.
       * This maximum number applies across all built-in tool calls, not per individual tool.
       * Any further attempts to call a tool by the model will be ignored.
       */
      maxToolCalls: import_v417.z.number().nullish(),
      metadata: import_v417.z.any().nullish(),
      parallelToolCalls: import_v417.z.boolean().nullish(),
      previousResponseId: import_v417.z.string().nullish(),
      promptCacheKey: import_v417.z.string().nullish(),
      reasoningEffort: import_v417.z.string().nullish(),
      reasoningSummary: import_v417.z.string().nullish(),
      safetyIdentifier: import_v417.z.string().nullish(),
      serviceTier: import_v417.z.enum(["auto", "flex", "priority", "default"]).nullish(),
      store: import_v417.z.boolean().nullish(),
      strictJsonSchema: import_v417.z.boolean().nullish(),
      textVerbosity: import_v417.z.enum(["low", "medium", "high"]).nullish(),
      truncation: import_v417.z.enum(["auto", "disabled"]).nullish(),
      user: import_v417.z.string().nullish()
    })
  )
);

// src/responses/openai-responses-prepare-tools.ts
var import_provider7 = require("@ai-sdk/provider");
var import_provider_utils23 = require("@ai-sdk/provider-utils");
async function prepareResponsesTools({
  tools,
  toolChoice,
  strictJsonSchema
}) {
  tools = (tools == null ? void 0 : tools.length) ? tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, toolChoice: void 0, toolWarnings };
  }
  const openaiTools2 = [];
  for (const tool of tools) {
    switch (tool.type) {
      case "function":
        openaiTools2.push({
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: strictJsonSchema
        });
        break;
      case "provider-defined": {
        switch (tool.id) {
          case "openai.file_search": {
            const args = await (0, import_provider_utils23.validateTypes)({
              value: tool.args,
              schema: fileSearchArgsSchema
            });
            openaiTools2.push({
              type: "file_search",
              vector_store_ids: args.vectorStoreIds,
              max_num_results: args.maxNumResults,
              ranking_options: args.ranking ? {
                ranker: args.ranking.ranker,
                score_threshold: args.ranking.scoreThreshold
              } : void 0,
              filters: args.filters
            });
            break;
          }
          case "openai.local_shell": {
            openaiTools2.push({
              type: "local_shell"
            });
            break;
          }
          case "openai.web_search_preview": {
            const args = await (0, import_provider_utils23.validateTypes)({
              value: tool.args,
              schema: webSearchPreviewArgsSchema
            });
            openaiTools2.push({
              type: "web_search_preview",
              search_context_size: args.searchContextSize,
              user_location: args.userLocation
            });
            break;
          }
          case "openai.web_search": {
            const args = await (0, import_provider_utils23.validateTypes)({
              value: tool.args,
              schema: webSearchArgsSchema
            });
            openaiTools2.push({
              type: "web_search",
              filters: args.filters != null ? { allowed_domains: args.filters.allowedDomains } : void 0,
              search_context_size: args.searchContextSize,
              user_location: args.userLocation
            });
            break;
          }
          case "openai.code_interpreter": {
            const args = await (0, import_provider_utils23.validateTypes)({
              value: tool.args,
              schema: codeInterpreterArgsSchema
            });
            openaiTools2.push({
              type: "code_interpreter",
              container: args.container == null ? { type: "auto", file_ids: void 0 } : typeof args.container === "string" ? args.container : { type: "auto", file_ids: args.container.fileIds }
            });
            break;
          }
          case "openai.image_generation": {
            const args = await (0, import_provider_utils23.validateTypes)({
              value: tool.args,
              schema: imageGenerationArgsSchema
            });
            openaiTools2.push({
              type: "image_generation",
              background: args.background,
              input_fidelity: args.inputFidelity,
              input_image_mask: args.inputImageMask ? {
                file_id: args.inputImageMask.fileId,
                image_url: args.inputImageMask.imageUrl
              } : void 0,
              model: args.model,
              size: args.size,
              quality: args.quality,
              moderation: args.moderation,
              output_format: args.outputFormat,
              output_compression: args.outputCompression
            });
            break;
          }
        }
        break;
      }
      default:
        toolWarnings.push({ type: "unsupported-tool", tool });
        break;
    }
  }
  if (toolChoice == null) {
    return { tools: openaiTools2, toolChoice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiTools2, toolChoice: type, toolWarnings };
    case "tool":
      return {
        tools: openaiTools2,
        toolChoice: toolChoice.toolName === "code_interpreter" || toolChoice.toolName === "file_search" || toolChoice.toolName === "image_generation" || toolChoice.toolName === "web_search_preview" || toolChoice.toolName === "web_search" ? { type: toolChoice.toolName } : { type: "function", name: toolChoice.toolName },
        toolWarnings
      };
    default: {
      const _exhaustiveCheck = type;
      throw new import_provider7.UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/responses/openai-responses-language-model.ts
var OpenAIResponsesLanguageModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    this.supportedUrls = {
      "image/*": [/^https?:\/\/.*$/],
      "application/pdf": [/^https?:\/\/.*$/]
    };
    this.modelId = modelId;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    maxOutputTokens,
    temperature,
    stopSequences,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    seed,
    prompt,
    providerOptions,
    tools,
    toolChoice,
    responseFormat
  }) {
    var _a, _b, _c, _d;
    const warnings = [];
    const modelConfig = getResponsesModelConfig(this.modelId);
    if (topK != null) {
      warnings.push({ type: "unsupported-setting", setting: "topK" });
    }
    if (seed != null) {
      warnings.push({ type: "unsupported-setting", setting: "seed" });
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
      warnings.push({ type: "unsupported-setting", setting: "stopSequences" });
    }
    const openaiOptions = await (0, import_provider_utils24.parseProviderOptions)({
      provider: "openai",
      providerOptions,
      schema: openaiResponsesProviderOptionsSchema
    });
    const { input, warnings: inputWarnings } = await convertToOpenAIResponsesInput({
      prompt,
      systemMessageMode: modelConfig.systemMessageMode,
      fileIdPrefixes: this.config.fileIdPrefixes,
      store: (_a = openaiOptions == null ? void 0 : openaiOptions.store) != null ? _a : true,
      hasLocalShellTool: hasOpenAITool("openai.local_shell")
    });
    warnings.push(...inputWarnings);
    const strictJsonSchema = (_b = openaiOptions == null ? void 0 : openaiOptions.strictJsonSchema) != null ? _b : false;
    let include = openaiOptions == null ? void 0 : openaiOptions.include;
    function addInclude(key) {
      if (include == null) {
        include = [key];
      } else if (!include.includes(key)) {
        include = [...include, key];
      }
    }
    function hasOpenAITool(id) {
      return (tools == null ? void 0 : tools.find(
        (tool) => tool.type === "provider-defined" && tool.id === id
      )) != null;
    }
    const topLogprobs = typeof (openaiOptions == null ? void 0 : openaiOptions.logprobs) === "number" ? openaiOptions == null ? void 0 : openaiOptions.logprobs : (openaiOptions == null ? void 0 : openaiOptions.logprobs) === true ? TOP_LOGPROBS_MAX : void 0;
    if (topLogprobs) {
      addInclude("message.output_text.logprobs");
    }
    const webSearchToolName = (_c = tools == null ? void 0 : tools.find(
      (tool) => tool.type === "provider-defined" && (tool.id === "openai.web_search" || tool.id === "openai.web_search_preview")
    )) == null ? void 0 : _c.name;
    if (webSearchToolName) {
      addInclude("web_search_call.action.sources");
    }
    if (hasOpenAITool("openai.code_interpreter")) {
      addInclude("code_interpreter_call.outputs");
    }
    const store = openaiOptions == null ? void 0 : openaiOptions.store;
    if (store === false && modelConfig.isReasoningModel) {
      addInclude("reasoning.encrypted_content");
    }
    const baseArgs = {
      model: this.modelId,
      input,
      temperature,
      top_p: topP,
      max_output_tokens: maxOutputTokens,
      ...((responseFormat == null ? void 0 : responseFormat.type) === "json" || (openaiOptions == null ? void 0 : openaiOptions.textVerbosity)) && {
        text: {
          ...(responseFormat == null ? void 0 : responseFormat.type) === "json" && {
            format: responseFormat.schema != null ? {
              type: "json_schema",
              strict: strictJsonSchema,
              name: (_d = responseFormat.name) != null ? _d : "response",
              description: responseFormat.description,
              schema: responseFormat.schema
            } : { type: "json_object" }
          },
          ...(openaiOptions == null ? void 0 : openaiOptions.textVerbosity) && {
            verbosity: openaiOptions.textVerbosity
          }
        }
      },
      // provider options:
      max_tool_calls: openaiOptions == null ? void 0 : openaiOptions.maxToolCalls,
      metadata: openaiOptions == null ? void 0 : openaiOptions.metadata,
      parallel_tool_calls: openaiOptions == null ? void 0 : openaiOptions.parallelToolCalls,
      previous_response_id: openaiOptions == null ? void 0 : openaiOptions.previousResponseId,
      store,
      user: openaiOptions == null ? void 0 : openaiOptions.user,
      instructions: openaiOptions == null ? void 0 : openaiOptions.instructions,
      service_tier: openaiOptions == null ? void 0 : openaiOptions.serviceTier,
      include,
      prompt_cache_key: openaiOptions == null ? void 0 : openaiOptions.promptCacheKey,
      safety_identifier: openaiOptions == null ? void 0 : openaiOptions.safetyIdentifier,
      top_logprobs: topLogprobs,
      truncation: openaiOptions == null ? void 0 : openaiOptions.truncation,
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
    } else {
      if ((openaiOptions == null ? void 0 : openaiOptions.reasoningEffort) != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "reasoningEffort",
          details: "reasoningEffort is not supported for non-reasoning models"
        });
      }
      if ((openaiOptions == null ? void 0 : openaiOptions.reasoningSummary) != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "reasoningSummary",
          details: "reasoningSummary is not supported for non-reasoning models"
        });
      }
    }
    if ((openaiOptions == null ? void 0 : openaiOptions.serviceTier) === "flex" && !modelConfig.supportsFlexProcessing) {
      warnings.push({
        type: "unsupported-setting",
        setting: "serviceTier",
        details: "flex processing is only available for o3, o4-mini, and gpt-5 models"
      });
      delete baseArgs.service_tier;
    }
    if ((openaiOptions == null ? void 0 : openaiOptions.serviceTier) === "priority" && !modelConfig.supportsPriorityProcessing) {
      warnings.push({
        type: "unsupported-setting",
        setting: "serviceTier",
        details: "priority processing is only available for supported models (gpt-4, gpt-5, gpt-5-mini, o3, o4-mini) and requires Enterprise access. gpt-5-nano is not supported"
      });
      delete baseArgs.service_tier;
    }
    const {
      tools: openaiTools2,
      toolChoice: openaiToolChoice,
      toolWarnings
    } = await prepareResponsesTools({
      tools,
      toolChoice,
      strictJsonSchema
    });
    return {
      webSearchToolName,
      args: {
        ...baseArgs,
        tools: openaiTools2,
        tool_choice: openaiToolChoice
      },
      warnings: [...warnings, ...toolWarnings],
      store
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
    const {
      args: body,
      warnings,
      webSearchToolName
    } = await this.getArgs(options);
    const url = this.config.url({
      path: "/responses",
      modelId: this.modelId
    });
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils24.postJsonToApi)({
      url,
      headers: (0, import_provider_utils24.combineHeaders)(this.config.headers(), options.headers),
      body,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils24.createJsonResponseHandler)(
        openaiResponsesResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    if (response.error) {
      throw new import_provider8.APICallError({
        message: response.error.message,
        url,
        requestBodyValues: body,
        statusCode: 400,
        responseHeaders,
        responseBody: rawResponse,
        isRetryable: false
      });
    }
    const content = [];
    const logprobs = [];
    let hasFunctionCall = false;
    for (const part of response.output) {
      switch (part.type) {
        case "reasoning": {
          if (part.summary.length === 0) {
            part.summary.push({ type: "summary_text", text: "" });
          }
          for (const summary of part.summary) {
            content.push({
              type: "reasoning",
              text: summary.text,
              providerMetadata: {
                openai: {
                  itemId: part.id,
                  reasoningEncryptedContent: (_a = part.encrypted_content) != null ? _a : null
                }
              }
            });
          }
          break;
        }
        case "image_generation_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "image_generation",
            input: "{}",
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "image_generation",
            result: {
              result: part.result
            },
            providerExecuted: true
          });
          break;
        }
        case "local_shell_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: "local_shell",
            input: JSON.stringify({
              action: part.action
            }),
            providerMetadata: {
              openai: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "message": {
          for (const contentPart of part.content) {
            if (((_c = (_b = options.providerOptions) == null ? void 0 : _b.openai) == null ? void 0 : _c.logprobs) && contentPart.logprobs) {
              logprobs.push(contentPart.logprobs);
            }
            content.push({
              type: "text",
              text: contentPart.text,
              providerMetadata: {
                openai: {
                  itemId: part.id
                }
              }
            });
            for (const annotation of contentPart.annotations) {
              if (annotation.type === "url_citation") {
                content.push({
                  type: "source",
                  sourceType: "url",
                  id: (_f = (_e = (_d = this.config).generateId) == null ? void 0 : _e.call(_d)) != null ? _f : (0, import_provider_utils24.generateId)(),
                  url: annotation.url,
                  title: annotation.title
                });
              } else if (annotation.type === "file_citation") {
                content.push({
                  type: "source",
                  sourceType: "document",
                  id: (_i = (_h = (_g = this.config).generateId) == null ? void 0 : _h.call(_g)) != null ? _i : (0, import_provider_utils24.generateId)(),
                  mediaType: "text/plain",
                  title: (_k = (_j = annotation.quote) != null ? _j : annotation.filename) != null ? _k : "Document",
                  filename: (_l = annotation.filename) != null ? _l : annotation.file_id
                });
              }
            }
          }
          break;
        }
        case "function_call": {
          hasFunctionCall = true;
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: part.name,
            input: part.arguments,
            providerMetadata: {
              openai: {
                itemId: part.id
              }
            }
          });
          break;
        }
        case "web_search_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: webSearchToolName != null ? webSearchToolName : "web_search",
            input: JSON.stringify({}),
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: webSearchToolName != null ? webSearchToolName : "web_search",
            result: mapWebSearchOutput(part.action),
            providerExecuted: true
          });
          break;
        }
        case "computer_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "computer_use",
            input: "",
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "computer_use",
            result: {
              type: "computer_use_tool_result",
              status: part.status || "completed"
            },
            providerExecuted: true
          });
          break;
        }
        case "file_search_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "file_search",
            input: "{}",
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "file_search",
            result: {
              queries: part.queries,
              results: (_n = (_m = part.results) == null ? void 0 : _m.map((result) => ({
                attributes: result.attributes,
                fileId: result.file_id,
                filename: result.filename,
                score: result.score,
                text: result.text
              }))) != null ? _n : null
            },
            providerExecuted: true
          });
          break;
        }
        case "code_interpreter_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "code_interpreter",
            input: JSON.stringify({
              code: part.code,
              containerId: part.container_id
            }),
            providerExecuted: true
          });
          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "code_interpreter",
            result: {
              outputs: part.outputs
            },
            providerExecuted: true
          });
          break;
        }
      }
    }
    const providerMetadata = {
      openai: { responseId: response.id }
    };
    if (logprobs.length > 0) {
      providerMetadata.openai.logprobs = logprobs;
    }
    if (typeof response.service_tier === "string") {
      providerMetadata.openai.serviceTier = response.service_tier;
    }
    return {
      content,
      finishReason: mapOpenAIResponseFinishReason({
        finishReason: (_o = response.incomplete_details) == null ? void 0 : _o.reason,
        hasFunctionCall
      }),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        reasoningTokens: (_q = (_p = response.usage.output_tokens_details) == null ? void 0 : _p.reasoning_tokens) != null ? _q : void 0,
        cachedInputTokens: (_s = (_r = response.usage.input_tokens_details) == null ? void 0 : _r.cached_tokens) != null ? _s : void 0
      },
      request: { body },
      response: {
        id: response.id,
        timestamp: new Date(response.created_at * 1e3),
        modelId: response.model,
        headers: responseHeaders,
        body: rawResponse
      },
      providerMetadata,
      warnings
    };
  }
  async doStream(options) {
    const {
      args: body,
      warnings,
      webSearchToolName,
      store
    } = await this.getArgs(options);
    const { responseHeaders, value: response } = await (0, import_provider_utils24.postJsonToApi)({
      url: this.config.url({
        path: "/responses",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils24.combineHeaders)(this.config.headers(), options.headers),
      body: {
        ...body,
        stream: true
      },
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils24.createEventSourceResponseHandler)(
        openaiResponsesChunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const self = this;
    let finishReason = "unknown";
    const usage = {
      inputTokens: void 0,
      outputTokens: void 0,
      totalTokens: void 0
    };
    const logprobs = [];
    let responseId = null;
    const ongoingToolCalls = {};
    let hasFunctionCall = false;
    const activeReasoning = {};
    let serviceTier;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
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
                  type: "tool-input-start",
                  id: value.item.call_id,
                  toolName: value.item.name
                });
              } else if (value.item.type === "web_search_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: webSearchToolName != null ? webSearchToolName : "web_search",
                  toolCallId: value.item.id
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: webSearchToolName != null ? webSearchToolName : "web_search",
                  providerExecuted: true
                });
                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.id
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "web_search",
                  input: JSON.stringify({}),
                  providerExecuted: true
                });
              } else if (value.item.type === "computer_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: "computer_use",
                  toolCallId: value.item.id
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: "computer_use",
                  providerExecuted: true
                });
              } else if (value.item.type === "code_interpreter_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: "code_interpreter",
                  toolCallId: value.item.id,
                  codeInterpreter: {
                    containerId: value.item.container_id
                  }
                };
                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: "code_interpreter",
                  providerExecuted: true
                });
                controller.enqueue({
                  type: "tool-input-delta",
                  id: value.item.id,
                  delta: `{"containerId":"${value.item.container_id}","code":"`
                });
              } else if (value.item.type === "file_search_call") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "file_search",
                  input: "{}",
                  providerExecuted: true
                });
              } else if (value.item.type === "image_generation_call") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "image_generation",
                  input: "{}",
                  providerExecuted: true
                });
              } else if (value.item.type === "message") {
                controller.enqueue({
                  type: "text-start",
                  id: value.item.id,
                  providerMetadata: {
                    openai: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (isResponseOutputItemAddedChunk(value) && value.item.type === "reasoning") {
                activeReasoning[value.item.id] = {
                  encryptedContent: value.item.encrypted_content,
                  summaryParts: { 0: "active" }
                };
                controller.enqueue({
                  type: "reasoning-start",
                  id: `${value.item.id}:0`,
                  providerMetadata: {
                    openai: {
                      itemId: value.item.id,
                      reasoningEncryptedContent: (_a = value.item.encrypted_content) != null ? _a : null
                    }
                  }
                });
              }
            } else if (isResponseOutputItemDoneChunk(value)) {
              if (value.item.type === "function_call") {
                ongoingToolCalls[value.output_index] = void 0;
                hasFunctionCall = true;
                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.call_id
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName: value.item.name,
                  input: value.item.arguments,
                  providerMetadata: {
                    openai: {
                      itemId: value.item.id
                    }
                  }
                });
              } else if (value.item.type === "web_search_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "web_search",
                  result: mapWebSearchOutput(value.item.action),
                  providerExecuted: true
                });
              } else if (value.item.type === "computer_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.id
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "computer_use",
                  input: "",
                  providerExecuted: true
                });
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "computer_use",
                  result: {
                    type: "computer_use_tool_result",
                    status: value.item.status || "completed"
                  },
                  providerExecuted: true
                });
              } else if (value.item.type === "file_search_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "file_search",
                  result: {
                    queries: value.item.queries,
                    results: (_c = (_b = value.item.results) == null ? void 0 : _b.map((result) => ({
                      attributes: result.attributes,
                      fileId: result.file_id,
                      filename: result.filename,
                      score: result.score,
                      text: result.text
                    }))) != null ? _c : null
                  },
                  providerExecuted: true
                });
              } else if (value.item.type === "code_interpreter_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "code_interpreter",
                  result: {
                    outputs: value.item.outputs
                  },
                  providerExecuted: true
                });
              } else if (value.item.type === "image_generation_call") {
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "image_generation",
                  result: {
                    result: value.item.result
                  },
                  providerExecuted: true
                });
              } else if (value.item.type === "local_shell_call") {
                ongoingToolCalls[value.output_index] = void 0;
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName: "local_shell",
                  input: JSON.stringify({
                    action: {
                      type: "exec",
                      command: value.item.action.command,
                      timeoutMs: value.item.action.timeout_ms,
                      user: value.item.action.user,
                      workingDirectory: value.item.action.working_directory,
                      env: value.item.action.env
                    }
                  }),
                  providerMetadata: {
                    openai: { itemId: value.item.id }
                  }
                });
              } else if (value.item.type === "message") {
                controller.enqueue({
                  type: "text-end",
                  id: value.item.id
                });
              } else if (value.item.type === "reasoning") {
                const activeReasoningPart = activeReasoning[value.item.id];
                const summaryPartIndices = Object.entries(
                  activeReasoningPart.summaryParts
                ).filter(
                  ([_, status]) => status === "active" || status === "can-conclude"
                ).map(([summaryIndex]) => summaryIndex);
                for (const summaryIndex of summaryPartIndices) {
                  controller.enqueue({
                    type: "reasoning-end",
                    id: `${value.item.id}:${summaryIndex}`,
                    providerMetadata: {
                      openai: {
                        itemId: value.item.id,
                        reasoningEncryptedContent: (_d = value.item.encrypted_content) != null ? _d : null
                      }
                    }
                  });
                }
                delete activeReasoning[value.item.id];
              }
            } else if (isResponseFunctionCallArgumentsDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: value.delta
                });
              }
            } else if (isResponseCodeInterpreterCallCodeDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  // The delta is code, which is embedding in a JSON string.
                  // To escape it, we use JSON.stringify and slice to remove the outer quotes.
                  delta: JSON.stringify(value.delta).slice(1, -1)
                });
              }
            } else if (isResponseCodeInterpreterCallCodeDoneChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index];
              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: '"}'
                });
                controller.enqueue({
                  type: "tool-input-end",
                  id: toolCall.toolCallId
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: toolCall.toolCallId,
                  toolName: "code_interpreter",
                  input: JSON.stringify({
                    code: value.code,
                    containerId: toolCall.codeInterpreter.containerId
                  }),
                  providerExecuted: true
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
                id: value.item_id,
                delta: value.delta
              });
              if (((_f = (_e = options.providerOptions) == null ? void 0 : _e.openai) == null ? void 0 : _f.logprobs) && value.logprobs) {
                logprobs.push(value.logprobs);
              }
            } else if (value.type === "response.reasoning_summary_part.added") {
              if (value.summary_index > 0) {
                const activeReasoningPart = activeReasoning[value.item_id];
                activeReasoningPart.summaryParts[value.summary_index] = "active";
                for (const summaryIndex of Object.keys(
                  activeReasoningPart.summaryParts
                )) {
                  if (activeReasoningPart.summaryParts[summaryIndex] === "can-conclude") {
                    controller.enqueue({
                      type: "reasoning-end",
                      id: `${value.item_id}:${summaryIndex}`,
                      providerMetadata: { openai: { itemId: value.item_id } }
                    });
                    activeReasoningPart.summaryParts[summaryIndex] = "concluded";
                  }
                }
                controller.enqueue({
                  type: "reasoning-start",
                  id: `${value.item_id}:${value.summary_index}`,
                  providerMetadata: {
                    openai: {
                      itemId: value.item_id,
                      reasoningEncryptedContent: (_h = (_g = activeReasoning[value.item_id]) == null ? void 0 : _g.encryptedContent) != null ? _h : null
                    }
                  }
                });
              }
            } else if (value.type === "response.reasoning_summary_text.delta") {
              controller.enqueue({
                type: "reasoning-delta",
                id: `${value.item_id}:${value.summary_index}`,
                delta: value.delta,
                providerMetadata: {
                  openai: {
                    itemId: value.item_id
                  }
                }
              });
            } else if (value.type === "response.reasoning_summary_part.done") {
              if (store) {
                controller.enqueue({
                  type: "reasoning-end",
                  id: `${value.item_id}:${value.summary_index}`,
                  providerMetadata: {
                    openai: { itemId: value.item_id }
                  }
                });
                activeReasoning[value.item_id].summaryParts[value.summary_index] = "concluded";
              } else {
                activeReasoning[value.item_id].summaryParts[value.summary_index] = "can-conclude";
              }
            } else if (isResponseFinishedChunk(value)) {
              finishReason = mapOpenAIResponseFinishReason({
                finishReason: (_i = value.response.incomplete_details) == null ? void 0 : _i.reason,
                hasFunctionCall
              });
              usage.inputTokens = value.response.usage.input_tokens;
              usage.outputTokens = value.response.usage.output_tokens;
              usage.totalTokens = value.response.usage.input_tokens + value.response.usage.output_tokens;
              usage.reasoningTokens = (_k = (_j = value.response.usage.output_tokens_details) == null ? void 0 : _j.reasoning_tokens) != null ? _k : void 0;
              usage.cachedInputTokens = (_m = (_l = value.response.usage.input_tokens_details) == null ? void 0 : _l.cached_tokens) != null ? _m : void 0;
              if (typeof value.response.service_tier === "string") {
                serviceTier = value.response.service_tier;
              }
            } else if (isResponseAnnotationAddedChunk(value)) {
              if (value.annotation.type === "url_citation") {
                controller.enqueue({
                  type: "source",
                  sourceType: "url",
                  id: (_p = (_o = (_n = self.config).generateId) == null ? void 0 : _o.call(_n)) != null ? _p : (0, import_provider_utils24.generateId)(),
                  url: value.annotation.url,
                  title: value.annotation.title
                });
              } else if (value.annotation.type === "file_citation") {
                controller.enqueue({
                  type: "source",
                  sourceType: "document",
                  id: (_s = (_r = (_q = self.config).generateId) == null ? void 0 : _r.call(_q)) != null ? _s : (0, import_provider_utils24.generateId)(),
                  mediaType: "text/plain",
                  title: (_u = (_t = value.annotation.quote) != null ? _t : value.annotation.filename) != null ? _u : "Document",
                  filename: (_v = value.annotation.filename) != null ? _v : value.annotation.file_id
                });
              }
            } else if (isErrorChunk(value)) {
              controller.enqueue({ type: "error", error: value });
            }
          },
          flush(controller) {
            const providerMetadata = {
              openai: {
                responseId
              }
            };
            if (logprobs.length > 0) {
              providerMetadata.openai.logprobs = logprobs;
            }
            if (serviceTier !== void 0) {
              providerMetadata.openai.serviceTier = serviceTier;
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
      request: { body },
      response: { headers: responseHeaders }
    };
  }
};
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
function isResponseCodeInterpreterCallCodeDeltaChunk(chunk) {
  return chunk.type === "response.code_interpreter_call_code.delta";
}
function isResponseCodeInterpreterCallCodeDoneChunk(chunk) {
  return chunk.type === "response.code_interpreter_call_code.done";
}
function isResponseOutputItemAddedChunk(chunk) {
  return chunk.type === "response.output_item.added";
}
function isResponseAnnotationAddedChunk(chunk) {
  return chunk.type === "response.output_text.annotation.added";
}
function isErrorChunk(chunk) {
  return chunk.type === "error";
}
function getResponsesModelConfig(modelId) {
  const supportsFlexProcessing2 = modelId.startsWith("o3") || modelId.startsWith("o4-mini") || modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-chat");
  const supportsPriorityProcessing2 = modelId.startsWith("gpt-4") || modelId.startsWith("gpt-5-mini") || modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-nano") && !modelId.startsWith("gpt-5-chat") || modelId.startsWith("o3") || modelId.startsWith("o4-mini");
  const defaults = {
    systemMessageMode: "system",
    supportsFlexProcessing: supportsFlexProcessing2,
    supportsPriorityProcessing: supportsPriorityProcessing2
  };
  if (modelId.startsWith("gpt-5-chat")) {
    return {
      ...defaults,
      isReasoningModel: false
    };
  }
  if (modelId.startsWith("o") || modelId.startsWith("gpt-5") || modelId.startsWith("codex-") || modelId.startsWith("computer-use")) {
    if (modelId.startsWith("o1-mini") || modelId.startsWith("o1-preview")) {
      return {
        ...defaults,
        isReasoningModel: true,
        systemMessageMode: "remove"
      };
    }
    return {
      ...defaults,
      isReasoningModel: true,
      systemMessageMode: "developer"
    };
  }
  return {
    ...defaults,
    isReasoningModel: false
  };
}
function mapWebSearchOutput(action) {
  var _a;
  switch (action.type) {
    case "search":
      return { action: { type: "search", query: (_a = action.query) != null ? _a : void 0 } };
    case "open_page":
      return { action: { type: "openPage", url: action.url } };
    case "find":
      return {
        action: { type: "find", url: action.url, pattern: action.pattern }
      };
  }
}

// src/speech/openai-speech-model.ts
var import_provider_utils26 = require("@ai-sdk/provider-utils");

// src/speech/openai-speech-options.ts
var import_provider_utils25 = require("@ai-sdk/provider-utils");
var import_v418 = require("zod/v4");
var openaiSpeechProviderOptionsSchema = (0, import_provider_utils25.lazyValidator)(
  () => (0, import_provider_utils25.zodSchema)(
    import_v418.z.object({
      instructions: import_v418.z.string().nullish(),
      speed: import_v418.z.number().min(0.25).max(4).default(1).nullish()
    })
  )
);

// src/speech/openai-speech-model.ts
var OpenAISpeechModel = class {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
    this.specificationVersion = "v2";
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    text,
    voice = "alloy",
    outputFormat = "mp3",
    speed,
    instructions,
    language,
    providerOptions
  }) {
    const warnings = [];
    const openAIOptions = await (0, import_provider_utils26.parseProviderOptions)({
      provider: "openai",
      providerOptions,
      schema: openaiSpeechProviderOptionsSchema
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
    if (language) {
      warnings.push({
        type: "unsupported-setting",
        setting: "language",
        details: `OpenAI speech models do not support language selection. Language parameter "${language}" was ignored.`
      });
    }
    return {
      requestBody,
      warnings
    };
  }
  async doGenerate(options) {
    var _a, _b, _c;
    const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
    const { requestBody, warnings } = await this.getArgs(options);
    const {
      value: audio,
      responseHeaders,
      rawValue: rawResponse
    } = await (0, import_provider_utils26.postJsonToApi)({
      url: this.config.url({
        path: "/audio/speech",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils26.combineHeaders)(this.config.headers(), options.headers),
      body: requestBody,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils26.createBinaryResponseHandler)(),
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

// src/transcription/openai-transcription-model.ts
var import_provider_utils29 = require("@ai-sdk/provider-utils");

// src/transcription/openai-transcription-api.ts
var import_provider_utils27 = require("@ai-sdk/provider-utils");
var import_v419 = require("zod/v4");
var openaiTranscriptionResponseSchema = (0, import_provider_utils27.lazyValidator)(
  () => (0, import_provider_utils27.zodSchema)(
    import_v419.z.object({
      text: import_v419.z.string(),
      language: import_v419.z.string().nullish(),
      duration: import_v419.z.number().nullish(),
      words: import_v419.z.array(
        import_v419.z.object({
          word: import_v419.z.string(),
          start: import_v419.z.number(),
          end: import_v419.z.number()
        })
      ).nullish(),
      segments: import_v419.z.array(
        import_v419.z.object({
          id: import_v419.z.number(),
          seek: import_v419.z.number(),
          start: import_v419.z.number(),
          end: import_v419.z.number(),
          text: import_v419.z.string(),
          tokens: import_v419.z.array(import_v419.z.number()),
          temperature: import_v419.z.number(),
          avg_logprob: import_v419.z.number(),
          compression_ratio: import_v419.z.number(),
          no_speech_prob: import_v419.z.number()
        })
      ).nullish()
    })
  )
);

// src/transcription/openai-transcription-options.ts
var import_provider_utils28 = require("@ai-sdk/provider-utils");
var import_v420 = require("zod/v4");
var openAITranscriptionProviderOptions = (0, import_provider_utils28.lazyValidator)(
  () => (0, import_provider_utils28.zodSchema)(
    import_v420.z.object({
      /**
       * Additional information to include in the transcription response.
       */
      include: import_v420.z.array(import_v420.z.string()).optional(),
      /**
       * The language of the input audio in ISO-639-1 format.
       */
      language: import_v420.z.string().optional(),
      /**
       * An optional text to guide the model's style or continue a previous audio segment.
       */
      prompt: import_v420.z.string().optional(),
      /**
       * The sampling temperature, between 0 and 1.
       * @default 0
       */
      temperature: import_v420.z.number().min(0).max(1).default(0).optional(),
      /**
       * The timestamp granularities to populate for this transcription.
       * @default ['segment']
       */
      timestampGranularities: import_v420.z.array(import_v420.z.enum(["word", "segment"])).default(["segment"]).optional()
    })
  )
);

// src/transcription/openai-transcription-model.ts
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
    this.specificationVersion = "v2";
  }
  get provider() {
    return this.config.provider;
  }
  async getArgs({
    audio,
    mediaType,
    providerOptions
  }) {
    const warnings = [];
    const openAIOptions = await (0, import_provider_utils29.parseProviderOptions)({
      provider: "openai",
      providerOptions,
      schema: openAITranscriptionProviderOptions
    });
    const formData = new FormData();
    const blob = audio instanceof Uint8Array ? new Blob([audio]) : new Blob([(0, import_provider_utils29.convertBase64ToUint8Array)(audio)]);
    formData.append("model", this.modelId);
    const fileExtension = (0, import_provider_utils29.mediaTypeToExtension)(mediaType);
    formData.append(
      "file",
      new File([blob], "audio", { type: mediaType }),
      `audio.${fileExtension}`
    );
    if (openAIOptions) {
      const transcriptionModelOptions = {
        include: openAIOptions.include,
        language: openAIOptions.language,
        prompt: openAIOptions.prompt,
        // https://platform.openai.com/docs/api-reference/audio/createTranscription#audio_createtranscription-response_format
        // prefer verbose_json to get segments for models that support it
        response_format: [
          "gpt-4o-transcribe",
          "gpt-4o-mini-transcribe"
        ].includes(this.modelId) ? "json" : "verbose_json",
        temperature: openAIOptions.temperature,
        timestamp_granularities: openAIOptions.timestampGranularities
      };
      for (const [key, value] of Object.entries(transcriptionModelOptions)) {
        if (value != null) {
          if (Array.isArray(value)) {
            for (const item of value) {
              formData.append(`${key}[]`, String(item));
            }
          } else {
            formData.append(key, String(value));
          }
        }
      }
    }
    return {
      formData,
      warnings
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
    const { formData, warnings } = await this.getArgs(options);
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse
    } = await (0, import_provider_utils29.postFormDataToApi)({
      url: this.config.url({
        path: "/audio/transcriptions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils29.combineHeaders)(this.config.headers(), options.headers),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils29.createJsonResponseHandler)(
        openaiTranscriptionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const language = response.language != null && response.language in languageMap ? languageMap[response.language] : void 0;
    return {
      text: response.text,
      segments: (_g = (_f = (_d = response.segments) == null ? void 0 : _d.map((segment) => ({
        text: segment.text,
        startSecond: segment.start,
        endSecond: segment.end
      }))) != null ? _f : (_e = response.words) == null ? void 0 : _e.map((word) => ({
        text: word.word,
        startSecond: word.start,
        endSecond: word.end
      }))) != null ? _g : [],
      language,
      durationInSeconds: (_h = response.duration) != null ? _h : void 0,
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

// src/version.ts
var VERSION = true ? "2.0.53" : "0.0.0-test";

// src/openai-provider.ts
function createOpenAI(options = {}) {
  var _a, _b;
  const baseURL = (_a = (0, import_provider_utils30.withoutTrailingSlash)(
    (0, import_provider_utils30.loadOptionalSetting)({
      settingValue: options.baseURL,
      environmentVariableName: "OPENAI_BASE_URL"
    })
  )) != null ? _a : "https://api.openai.com/v1";
  const providerName = (_b = options.name) != null ? _b : "openai";
  const getHeaders = () => (0, import_provider_utils30.withUserAgentSuffix)(
    {
      Authorization: `Bearer ${(0, import_provider_utils30.loadApiKey)({
        apiKey: options.apiKey,
        environmentVariableName: "OPENAI_API_KEY",
        description: "OpenAI"
      })}`,
      "OpenAI-Organization": options.organization,
      "OpenAI-Project": options.project,
      ...options.headers
    },
    `ai-sdk/openai/${VERSION}`
  );
  const createChatModel = (modelId) => new OpenAIChatLanguageModel(modelId, {
    provider: `${providerName}.chat`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createCompletionModel = (modelId) => new OpenAICompletionLanguageModel(modelId, {
    provider: `${providerName}.completion`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createEmbeddingModel = (modelId) => new OpenAIEmbeddingModel(modelId, {
    provider: `${providerName}.embedding`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createImageModel = (modelId) => new OpenAIImageModel(modelId, {
    provider: `${providerName}.image`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createTranscriptionModel = (modelId) => new OpenAITranscriptionModel(modelId, {
    provider: `${providerName}.transcription`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createSpeechModel = (modelId) => new OpenAISpeechModel(modelId, {
    provider: `${providerName}.speech`,
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createLanguageModel = (modelId) => {
    if (new.target) {
      throw new Error(
        "The OpenAI model function cannot be called with the new keyword."
      );
    }
    return createResponsesModel(modelId);
  };
  const createResponsesModel = (modelId) => {
    return new OpenAIResponsesLanguageModel(modelId, {
      provider: `${providerName}.responses`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      fileIdPrefixes: ["file-"]
    });
  };
  const provider = function(modelId) {
    return createLanguageModel(modelId);
  };
  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;
  provider.responses = createResponsesModel;
  provider.embedding = createEmbeddingModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;
  provider.speech = createSpeechModel;
  provider.speechModel = createSpeechModel;
  provider.tools = openaiTools;
  return provider;
}
var openai = createOpenAI();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VERSION,
  createOpenAI,
  openai
});
//# sourceMappingURL=index.js.map