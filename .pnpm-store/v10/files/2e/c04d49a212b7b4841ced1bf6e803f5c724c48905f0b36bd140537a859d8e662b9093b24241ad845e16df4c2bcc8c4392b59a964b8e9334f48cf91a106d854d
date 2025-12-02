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
  browserSearch: () => browserSearch,
  createGroq: () => createGroq,
  groq: () => groq
});
module.exports = __toCommonJS(src_exports);

// src/groq-provider.ts
var import_provider4 = require("@ai-sdk/provider");
var import_provider_utils6 = require("@ai-sdk/provider-utils");

// src/groq-chat-language-model.ts
var import_provider3 = require("@ai-sdk/provider");
var import_provider_utils3 = require("@ai-sdk/provider-utils");
var import_v43 = require("zod/v4");

// src/convert-to-groq-chat-messages.ts
var import_provider = require("@ai-sdk/provider");
var import_provider_utils = require("@ai-sdk/provider-utils");
function convertToGroqChatMessages(prompt) {
  const messages = [];
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        messages.push({ role: "system", content });
        break;
      }
      case "user": {
        if (content.length === 1 && content[0].type === "text") {
          messages.push({ role: "user", content: content[0].text });
          break;
        }
        messages.push({
          role: "user",
          content: content.map((part) => {
            switch (part.type) {
              case "text": {
                return { type: "text", text: part.text };
              }
              case "file": {
                if (!part.mediaType.startsWith("image/")) {
                  throw new import_provider.UnsupportedFunctionalityError({
                    functionality: "Non-image file content parts"
                  });
                }
                const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType;
                return {
                  type: "image_url",
                  image_url: {
                    url: part.data instanceof URL ? part.data.toString() : `data:${mediaType};base64,${(0, import_provider_utils.convertToBase64)(part.data)}`
                  }
                };
              }
            }
          })
        });
        break;
      }
      case "assistant": {
        let text = "";
        let reasoning = "";
        const toolCalls = [];
        for (const part of content) {
          switch (part.type) {
            // groq supports reasoning for tool-calls in multi-turn conversations
            // https://github.com/vercel/ai/issues/7860
            case "reasoning": {
              reasoning += part.text;
              break;
            }
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
          ...reasoning.length > 0 ? { reasoning } : null,
          ...toolCalls.length > 0 ? { tool_calls: toolCalls } : null
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

// src/groq-chat-options.ts
var import_v4 = require("zod/v4");
var groqProviderOptions = import_v4.z.object({
  reasoningFormat: import_v4.z.enum(["parsed", "raw", "hidden"]).optional(),
  reasoningEffort: import_v4.z.string().optional(),
  /**
   * Whether to enable parallel function calling during tool use. Default to true.
   */
  parallelToolCalls: import_v4.z.boolean().optional(),
  /**
   * A unique identifier representing your end-user, which can help OpenAI to
   * monitor and detect abuse. Learn more.
   */
  user: import_v4.z.string().optional(),
  /**
   * Whether to use structured outputs.
   *
   * @default true
   */
  structuredOutputs: import_v4.z.boolean().optional()
});

// src/groq-error.ts
var import_v42 = require("zod/v4");
var import_provider_utils2 = require("@ai-sdk/provider-utils");
var groqErrorDataSchema = import_v42.z.object({
  error: import_v42.z.object({
    message: import_v42.z.string(),
    type: import_v42.z.string()
  })
});
var groqFailedResponseHandler = (0, import_provider_utils2.createJsonErrorResponseHandler)({
  errorSchema: groqErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/groq-prepare-tools.ts
var import_provider2 = require("@ai-sdk/provider");

// src/groq-browser-search-models.ts
var BROWSER_SEARCH_SUPPORTED_MODELS = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b"
];
function isBrowserSearchSupportedModel(modelId) {
  return BROWSER_SEARCH_SUPPORTED_MODELS.includes(modelId);
}
function getSupportedModelsString() {
  return BROWSER_SEARCH_SUPPORTED_MODELS.join(", ");
}

// src/groq-prepare-tools.ts
function prepareTools({
  tools,
  toolChoice,
  modelId
}) {
  tools = (tools == null ? void 0 : tools.length) ? tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, toolChoice: void 0, toolWarnings };
  }
  const groqTools2 = [];
  for (const tool of tools) {
    if (tool.type === "provider-defined") {
      if (tool.id === "groq.browser_search") {
        if (!isBrowserSearchSupportedModel(modelId)) {
          toolWarnings.push({
            type: "unsupported-tool",
            tool,
            details: `Browser search is only supported on the following models: ${getSupportedModelsString()}. Current model: ${modelId}`
          });
        } else {
          groqTools2.push({
            type: "browser_search"
          });
        }
      } else {
        toolWarnings.push({ type: "unsupported-tool", tool });
      }
    } else {
      groqTools2.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      });
    }
  }
  if (toolChoice == null) {
    return { tools: groqTools2, toolChoice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: groqTools2, toolChoice: type, toolWarnings };
    case "tool":
      return {
        tools: groqTools2,
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

// src/map-groq-finish-reason.ts
function mapGroqFinishReason(finishReason) {
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

// src/groq-chat-language-model.ts
var GroqChatLanguageModel = class {
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
    stream,
    tools,
    toolChoice,
    providerOptions
  }) {
    var _a, _b;
    const warnings = [];
    const groqOptions = await (0, import_provider_utils3.parseProviderOptions)({
      provider: "groq",
      providerOptions,
      schema: groqProviderOptions
    });
    const structuredOutputs = (_a = groqOptions == null ? void 0 : groqOptions.structuredOutputs) != null ? _a : true;
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
    const {
      tools: groqTools2,
      toolChoice: groqToolChoice,
      toolWarnings
    } = prepareTools({ tools, toolChoice, modelId: this.modelId });
    return {
      args: {
        // model id:
        model: this.modelId,
        // model specific settings:
        user: groqOptions == null ? void 0 : groqOptions.user,
        parallel_tool_calls: groqOptions == null ? void 0 : groqOptions.parallelToolCalls,
        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stop: stopSequences,
        seed,
        // response format:
        response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? structuredOutputs && responseFormat.schema != null ? {
          type: "json_schema",
          json_schema: {
            schema: responseFormat.schema,
            name: (_b = responseFormat.name) != null ? _b : "response",
            description: responseFormat.description
          }
        } : { type: "json_object" } : void 0,
        // provider options:
        reasoning_format: groqOptions == null ? void 0 : groqOptions.reasoningFormat,
        reasoning_effort: groqOptions == null ? void 0 : groqOptions.reasoningEffort,
        // messages:
        messages: convertToGroqChatMessages(prompt),
        // tools:
        tools: groqTools2,
        tool_choice: groqToolChoice
      },
      warnings: [...warnings, ...toolWarnings]
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g;
    const { args, warnings } = await this.getArgs({
      ...options,
      stream: false
    });
    const body = JSON.stringify(args);
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
      body: args,
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils3.createJsonResponseHandler)(
        groqChatResponseSchema
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
    const reasoning = choice.message.reasoning;
    if (reasoning != null && reasoning.length > 0) {
      content.push({
        type: "reasoning",
        text: reasoning
      });
    }
    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool-call",
          toolCallId: (_a = toolCall.id) != null ? _a : (0, import_provider_utils3.generateId)(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments
        });
      }
    }
    return {
      content,
      finishReason: mapGroqFinishReason(choice.finish_reason),
      usage: {
        inputTokens: (_c = (_b = response.usage) == null ? void 0 : _b.prompt_tokens) != null ? _c : void 0,
        outputTokens: (_e = (_d = response.usage) == null ? void 0 : _d.completion_tokens) != null ? _e : void 0,
        totalTokens: (_g = (_f = response.usage) == null ? void 0 : _f.total_tokens) != null ? _g : void 0
      },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse
      },
      warnings,
      request: { body }
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs({ ...options, stream: true });
    const body = JSON.stringify({ ...args, stream: true });
    const { responseHeaders, value: response } = await (0, import_provider_utils3.postJsonToApi)({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils3.combineHeaders)(this.config.headers(), options.headers),
      body: {
        ...args,
        stream: true
      },
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils3.createEventSourceResponseHandler)(groqChatChunkSchema),
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
    let isActiveReasoning = false;
    let providerMetadata;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
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
            if (((_a = value.x_groq) == null ? void 0 : _a.usage) != null) {
              usage.inputTokens = (_b = value.x_groq.usage.prompt_tokens) != null ? _b : void 0;
              usage.outputTokens = (_c = value.x_groq.usage.completion_tokens) != null ? _c : void 0;
              usage.totalTokens = (_d = value.x_groq.usage.total_tokens) != null ? _d : void 0;
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapGroqFinishReason(choice.finish_reason);
            }
            if ((choice == null ? void 0 : choice.delta) == null) {
              return;
            }
            const delta = choice.delta;
            if (delta.reasoning != null && delta.reasoning.length > 0) {
              if (!isActiveReasoning) {
                controller.enqueue({
                  type: "reasoning-start",
                  id: "reasoning-0"
                });
                isActiveReasoning = true;
              }
              controller.enqueue({
                type: "reasoning-delta",
                id: "reasoning-0",
                delta: delta.reasoning
              });
            }
            if (delta.content != null && delta.content.length > 0) {
              if (!isActiveText) {
                controller.enqueue({ type: "text-start", id: "txt-0" });
                isActiveText = true;
              }
              controller.enqueue({
                type: "text-delta",
                id: "txt-0",
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
                  if (((_e = toolCallDelta.function) == null ? void 0 : _e.name) == null) {
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
                      arguments: (_f = toolCallDelta.function.arguments) != null ? _f : ""
                    },
                    hasFinished: false
                  };
                  const toolCall2 = toolCalls[index];
                  if (((_g = toolCall2.function) == null ? void 0 : _g.name) != null && ((_h = toolCall2.function) == null ? void 0 : _h.arguments) != null) {
                    if (toolCall2.function.arguments.length > 0) {
                      controller.enqueue({
                        type: "tool-input-delta",
                        id: toolCall2.id,
                        delta: toolCall2.function.arguments
                      });
                    }
                    if ((0, import_provider_utils3.isParsableJson)(toolCall2.function.arguments)) {
                      controller.enqueue({
                        type: "tool-input-end",
                        id: toolCall2.id
                      });
                      controller.enqueue({
                        type: "tool-call",
                        toolCallId: (_i = toolCall2.id) != null ? _i : (0, import_provider_utils3.generateId)(),
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
                if (((_j = toolCallDelta.function) == null ? void 0 : _j.arguments) != null) {
                  toolCall.function.arguments += (_l = (_k = toolCallDelta.function) == null ? void 0 : _k.arguments) != null ? _l : "";
                }
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.id,
                  delta: (_m = toolCallDelta.function.arguments) != null ? _m : ""
                });
                if (((_n = toolCall.function) == null ? void 0 : _n.name) != null && ((_o = toolCall.function) == null ? void 0 : _o.arguments) != null && (0, import_provider_utils3.isParsableJson)(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCall.id
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: (_p = toolCall.id) != null ? _p : (0, import_provider_utils3.generateId)(),
                    toolName: toolCall.function.name,
                    input: toolCall.function.arguments
                  });
                  toolCall.hasFinished = true;
                }
              }
            }
          },
          flush(controller) {
            if (isActiveReasoning) {
              controller.enqueue({ type: "reasoning-end", id: "reasoning-0" });
            }
            if (isActiveText) {
              controller.enqueue({ type: "text-end", id: "txt-0" });
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
var groqChatResponseSchema = import_v43.z.object({
  id: import_v43.z.string().nullish(),
  created: import_v43.z.number().nullish(),
  model: import_v43.z.string().nullish(),
  choices: import_v43.z.array(
    import_v43.z.object({
      message: import_v43.z.object({
        content: import_v43.z.string().nullish(),
        reasoning: import_v43.z.string().nullish(),
        tool_calls: import_v43.z.array(
          import_v43.z.object({
            id: import_v43.z.string().nullish(),
            type: import_v43.z.literal("function"),
            function: import_v43.z.object({
              name: import_v43.z.string(),
              arguments: import_v43.z.string()
            })
          })
        ).nullish()
      }),
      index: import_v43.z.number(),
      finish_reason: import_v43.z.string().nullish()
    })
  ),
  usage: import_v43.z.object({
    prompt_tokens: import_v43.z.number().nullish(),
    completion_tokens: import_v43.z.number().nullish(),
    total_tokens: import_v43.z.number().nullish()
  }).nullish()
});
var groqChatChunkSchema = import_v43.z.union([
  import_v43.z.object({
    id: import_v43.z.string().nullish(),
    created: import_v43.z.number().nullish(),
    model: import_v43.z.string().nullish(),
    choices: import_v43.z.array(
      import_v43.z.object({
        delta: import_v43.z.object({
          content: import_v43.z.string().nullish(),
          reasoning: import_v43.z.string().nullish(),
          tool_calls: import_v43.z.array(
            import_v43.z.object({
              index: import_v43.z.number(),
              id: import_v43.z.string().nullish(),
              type: import_v43.z.literal("function").optional(),
              function: import_v43.z.object({
                name: import_v43.z.string().nullish(),
                arguments: import_v43.z.string().nullish()
              })
            })
          ).nullish()
        }).nullish(),
        finish_reason: import_v43.z.string().nullable().optional(),
        index: import_v43.z.number()
      })
    ),
    x_groq: import_v43.z.object({
      usage: import_v43.z.object({
        prompt_tokens: import_v43.z.number().nullish(),
        completion_tokens: import_v43.z.number().nullish(),
        total_tokens: import_v43.z.number().nullish()
      }).nullish()
    }).nullish()
  }),
  groqErrorDataSchema
]);

// src/groq-transcription-model.ts
var import_provider_utils4 = require("@ai-sdk/provider-utils");
var import_v44 = require("zod/v4");
var groqProviderOptionsSchema = import_v44.z.object({
  language: import_v44.z.string().nullish(),
  prompt: import_v44.z.string().nullish(),
  responseFormat: import_v44.z.string().nullish(),
  temperature: import_v44.z.number().min(0).max(1).nullish(),
  timestampGranularities: import_v44.z.array(import_v44.z.string()).nullish()
});
var GroqTranscriptionModel = class {
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
    var _a, _b, _c, _d, _e;
    const warnings = [];
    const groqOptions = await (0, import_provider_utils4.parseProviderOptions)({
      provider: "groq",
      providerOptions,
      schema: groqProviderOptionsSchema
    });
    const formData = new FormData();
    const blob = audio instanceof Uint8Array ? new Blob([audio]) : new Blob([(0, import_provider_utils4.convertBase64ToUint8Array)(audio)]);
    formData.append("model", this.modelId);
    formData.append("file", new File([blob], "audio", { type: mediaType }));
    if (groqOptions) {
      const transcriptionModelOptions = {
        language: (_a = groqOptions.language) != null ? _a : void 0,
        prompt: (_b = groqOptions.prompt) != null ? _b : void 0,
        response_format: (_c = groqOptions.responseFormat) != null ? _c : void 0,
        temperature: (_d = groqOptions.temperature) != null ? _d : void 0,
        timestamp_granularities: (_e = groqOptions.timestampGranularities) != null ? _e : void 0
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
    var _a, _b, _c, _d, _e;
    const currentDate = (_c = (_b = (_a = this.config._internal) == null ? void 0 : _a.currentDate) == null ? void 0 : _b.call(_a)) != null ? _c : /* @__PURE__ */ new Date();
    const { formData, warnings } = await this.getArgs(options);
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse
    } = await (0, import_provider_utils4.postFormDataToApi)({
      url: this.config.url({
        path: "/audio/transcriptions",
        modelId: this.modelId
      }),
      headers: (0, import_provider_utils4.combineHeaders)(this.config.headers(), options.headers),
      formData,
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils4.createJsonResponseHandler)(
        groqTranscriptionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    return {
      text: response.text,
      segments: (_e = (_d = response.segments) == null ? void 0 : _d.map((segment) => ({
        text: segment.text,
        startSecond: segment.start,
        endSecond: segment.end
      }))) != null ? _e : [],
      language: response.language,
      durationInSeconds: response.duration,
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
var groqTranscriptionResponseSchema = import_v44.z.object({
  task: import_v44.z.string(),
  language: import_v44.z.string(),
  duration: import_v44.z.number(),
  text: import_v44.z.string(),
  segments: import_v44.z.array(
    import_v44.z.object({
      id: import_v44.z.number(),
      seek: import_v44.z.number(),
      start: import_v44.z.number(),
      end: import_v44.z.number(),
      text: import_v44.z.string(),
      tokens: import_v44.z.array(import_v44.z.number()),
      temperature: import_v44.z.number(),
      avg_logprob: import_v44.z.number(),
      compression_ratio: import_v44.z.number(),
      no_speech_prob: import_v44.z.number()
    })
  ),
  x_groq: import_v44.z.object({
    id: import_v44.z.string()
  })
});

// src/tool/browser-search.ts
var import_provider_utils5 = require("@ai-sdk/provider-utils");
var import_v45 = require("zod/v4");
var browserSearch = (0, import_provider_utils5.createProviderDefinedToolFactory)({
  id: "groq.browser_search",
  name: "browser_search",
  inputSchema: import_v45.z.object({})
});

// src/groq-tools.ts
var groqTools = {
  browserSearch
};

// src/groq-provider.ts
function createGroq(options = {}) {
  var _a;
  const baseURL = (_a = (0, import_provider_utils6.withoutTrailingSlash)(options.baseURL)) != null ? _a : "https://api.groq.com/openai/v1";
  const getHeaders = () => ({
    Authorization: `Bearer ${(0, import_provider_utils6.loadApiKey)({
      apiKey: options.apiKey,
      environmentVariableName: "GROQ_API_KEY",
      description: "Groq"
    })}`,
    ...options.headers
  });
  const createChatModel = (modelId) => new GroqChatLanguageModel(modelId, {
    provider: "groq.chat",
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createLanguageModel = (modelId) => {
    if (new.target) {
      throw new Error(
        "The Groq model function cannot be called with the new keyword."
      );
    }
    return createChatModel(modelId);
  };
  const createTranscriptionModel = (modelId) => {
    return new GroqTranscriptionModel(modelId, {
      provider: "groq.transcription",
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch
    });
  };
  const provider = function(modelId) {
    return createLanguageModel(modelId);
  };
  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.textEmbeddingModel = (modelId) => {
    throw new import_provider4.NoSuchModelError({ modelId, modelType: "textEmbeddingModel" });
  };
  provider.imageModel = (modelId) => {
    throw new import_provider4.NoSuchModelError({ modelId, modelType: "imageModel" });
  };
  provider.transcription = createTranscriptionModel;
  provider.tools = groqTools;
  return provider;
}
var groq = createGroq();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  browserSearch,
  createGroq,
  groq
});
//# sourceMappingURL=index.js.map