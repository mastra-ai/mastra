// src/groq-provider.ts
import {
  NoSuchModelError
} from "@ai-sdk/provider";
import {
  loadApiKey,
  withoutTrailingSlash
} from "@ai-sdk/provider-utils";

// src/groq-chat-language-model.ts
import {
  InvalidResponseDataError
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  parseProviderOptions,
  postJsonToApi
} from "@ai-sdk/provider-utils";
import { z as z2 } from "zod";

// src/convert-to-groq-chat-messages.ts
import {
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils";
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
            var _a;
            switch (part.type) {
              case "text": {
                return { type: "text", text: part.text };
              }
              case "image": {
                return {
                  type: "image_url",
                  image_url: {
                    url: part.image instanceof URL ? part.image.toString() : `data:${(_a = part.mimeType) != null ? _a : "image/jpeg"};base64,${convertUint8ArrayToBase64(part.image)}`
                  }
                };
              }
              case "file": {
                throw new UnsupportedFunctionalityError({
                  functionality: "File content parts in user messages"
                });
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
        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : void 0
        });
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: JSON.stringify(toolResponse.result)
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

// src/groq-error.ts
import { z } from "zod";
import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
var groqErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string()
  })
});
var groqFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: groqErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/groq-prepare-tools.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";
function prepareTools({
  mode
}) {
  var _a;
  const tools = ((_a = mode.tools) == null ? void 0 : _a.length) ? mode.tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, tool_choice: void 0, toolWarnings };
  }
  const toolChoice = mode.toolChoice;
  const groqTools = [];
  for (const tool of tools) {
    if (tool.type === "provider-defined") {
      toolWarnings.push({ type: "unsupported-tool", tool });
    } else {
      groqTools.push({
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
    return { tools: groqTools, tool_choice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: groqTools, tool_choice: type, toolWarnings };
    case "tool":
      return {
        tools: groqTools,
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
      throw new UnsupportedFunctionalityError2({
        functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`
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
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.supportsStructuredOutputs = false;
    this.defaultObjectGenerationMode = "json";
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
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
    stream,
    providerMetadata
  }) {
    const type = mode.type;
    const warnings = [];
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if (responseFormat != null && responseFormat.type === "json" && responseFormat.schema != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format schema is not supported"
      });
    }
    const groqOptions = parseProviderOptions({
      provider: "groq",
      providerOptions: providerMetadata,
      schema: z2.object({
        reasoningFormat: z2.enum(["parsed", "raw", "hidden"]).nullish()
      })
    });
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      user: this.settings.user,
      parallel_tool_calls: this.settings.parallelToolCalls,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stop: stopSequences,
      seed,
      // response format:
      response_format: (
        // json object response format is not supported for streaming:
        stream === false && (responseFormat == null ? void 0 : responseFormat.type) === "json" ? { type: "json_object" } : void 0
      ),
      // provider options:
      reasoning_format: groqOptions == null ? void 0 : groqOptions.reasoningFormat,
      // messages:
      messages: convertToGroqChatMessages(prompt)
    };
    switch (type) {
      case "regular": {
        const { tools, tool_choice, toolWarnings } = prepareTools({ mode });
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
            response_format: (
              // json object response format is not supported for streaming:
              stream === false ? { type: "json_object" } : void 0
            )
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
    var _a, _b, _c, _d, _e, _f, _g;
    const { args, warnings } = this.getArgs({ ...options, stream: false });
    const body = JSON.stringify(args);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        groqChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { messages: rawPrompt, ...rawSettings } = args;
    const choice = response.choices[0];
    return {
      text: (_a = choice.message.content) != null ? _a : void 0,
      reasoning: (_b = choice.message.reasoning) != null ? _b : void 0,
      toolCalls: (_c = choice.message.tool_calls) == null ? void 0 : _c.map((toolCall) => {
        var _a2;
        return {
          toolCallType: "function",
          toolCallId: (_a2 = toolCall.id) != null ? _a2 : generateId(),
          toolName: toolCall.function.name,
          args: toolCall.function.arguments
        };
      }),
      finishReason: mapGroqFinishReason(choice.finish_reason),
      usage: {
        promptTokens: (_e = (_d = response.usage) == null ? void 0 : _d.prompt_tokens) != null ? _e : NaN,
        completionTokens: (_g = (_f = response.usage) == null ? void 0 : _f.completion_tokens) != null ? _g : NaN
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders, body: rawResponse },
      response: getResponseMetadata(response),
      warnings,
      request: { body }
    };
  }
  async doStream(options) {
    const { args, warnings } = this.getArgs({ ...options, stream: true });
    const body = JSON.stringify({ ...args, stream: true });
    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: {
        ...args,
        stream: true
      },
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(groqChatChunkSchema),
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
    let isFirstChunk = true;
    let providerMetadata;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
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
              usage = {
                promptTokens: (_b = value.x_groq.usage.prompt_tokens) != null ? _b : void 0,
                completionTokens: (_c = value.x_groq.usage.completion_tokens) != null ? _c : void 0
              };
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
              controller.enqueue({
                type: "reasoning",
                textDelta: delta.reasoning
              });
            }
            if (delta.content != null && delta.content.length > 0) {
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
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`
                    });
                  }
                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`
                    });
                  }
                  if (((_d = toolCallDelta.function) == null ? void 0 : _d.name) == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`
                    });
                  }
                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: "function",
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: (_e = toolCallDelta.function.arguments) != null ? _e : ""
                    },
                    hasFinished: false
                  };
                  const toolCall2 = toolCalls[index];
                  if (((_f = toolCall2.function) == null ? void 0 : _f.name) != null && ((_g = toolCall2.function) == null ? void 0 : _g.arguments) != null) {
                    if (toolCall2.function.arguments.length > 0) {
                      controller.enqueue({
                        type: "tool-call-delta",
                        toolCallType: "function",
                        toolCallId: toolCall2.id,
                        toolName: toolCall2.function.name,
                        argsTextDelta: toolCall2.function.arguments
                      });
                    }
                    if (isParsableJson(toolCall2.function.arguments)) {
                      controller.enqueue({
                        type: "tool-call",
                        toolCallType: "function",
                        toolCallId: (_h = toolCall2.id) != null ? _h : generateId(),
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
                if (((_i = toolCallDelta.function) == null ? void 0 : _i.arguments) != null) {
                  toolCall.function.arguments += (_k = (_j = toolCallDelta.function) == null ? void 0 : _j.arguments) != null ? _k : "";
                }
                controller.enqueue({
                  type: "tool-call-delta",
                  toolCallType: "function",
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  argsTextDelta: (_l = toolCallDelta.function.arguments) != null ? _l : ""
                });
                if (((_m = toolCall.function) == null ? void 0 : _m.name) != null && ((_n = toolCall.function) == null ? void 0 : _n.arguments) != null && isParsableJson(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallType: "function",
                    toolCallId: (_o = toolCall.id) != null ? _o : generateId(),
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
      warnings,
      request: { body }
    };
  }
};
var groqChatResponseSchema = z2.object({
  id: z2.string().nullish(),
  created: z2.number().nullish(),
  model: z2.string().nullish(),
  choices: z2.array(
    z2.object({
      message: z2.object({
        content: z2.string().nullish(),
        reasoning: z2.string().nullish(),
        tool_calls: z2.array(
          z2.object({
            id: z2.string().nullish(),
            type: z2.literal("function"),
            function: z2.object({
              name: z2.string(),
              arguments: z2.string()
            })
          })
        ).nullish()
      }),
      index: z2.number(),
      finish_reason: z2.string().nullish()
    })
  ),
  usage: z2.object({
    prompt_tokens: z2.number().nullish(),
    completion_tokens: z2.number().nullish()
  }).nullish()
});
var groqChatChunkSchema = z2.union([
  z2.object({
    id: z2.string().nullish(),
    created: z2.number().nullish(),
    model: z2.string().nullish(),
    choices: z2.array(
      z2.object({
        delta: z2.object({
          content: z2.string().nullish(),
          reasoning: z2.string().nullish(),
          tool_calls: z2.array(
            z2.object({
              index: z2.number(),
              id: z2.string().nullish(),
              type: z2.literal("function").optional(),
              function: z2.object({
                name: z2.string().nullish(),
                arguments: z2.string().nullish()
              })
            })
          ).nullish()
        }).nullish(),
        finish_reason: z2.string().nullable().optional(),
        index: z2.number()
      })
    ),
    x_groq: z2.object({
      usage: z2.object({
        prompt_tokens: z2.number().nullish(),
        completion_tokens: z2.number().nullish()
      }).nullish()
    }).nullish()
  }),
  groqErrorDataSchema
]);

// src/groq-transcription-model.ts
import {
  combineHeaders as combineHeaders2,
  convertBase64ToUint8Array,
  createJsonResponseHandler as createJsonResponseHandler2,
  parseProviderOptions as parseProviderOptions2,
  postFormDataToApi
} from "@ai-sdk/provider-utils";
import { z as z3 } from "zod";
var groqProviderOptionsSchema = z3.object({
  language: z3.string().nullish(),
  prompt: z3.string().nullish(),
  responseFormat: z3.string().nullish(),
  temperature: z3.number().min(0).max(1).nullish(),
  timestampGranularities: z3.array(z3.string()).nullish()
});
var GroqTranscriptionModel = class {
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
    const groqOptions = parseProviderOptions2({
      provider: "groq",
      providerOptions,
      schema: groqProviderOptionsSchema
    });
    const formData = new FormData();
    const blob = audio instanceof Uint8Array ? new Blob([audio]) : new Blob([convertBase64ToUint8Array(audio)]);
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
    const { formData, warnings } = this.getArgs(options);
    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse
    } = await postFormDataToApi({
      url: this.config.url({
        path: "/audio/transcriptions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers(), options.headers),
      formData,
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
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
var groqTranscriptionResponseSchema = z3.object({
  task: z3.string(),
  language: z3.string(),
  duration: z3.number(),
  text: z3.string(),
  segments: z3.array(
    z3.object({
      id: z3.number(),
      seek: z3.number(),
      start: z3.number(),
      end: z3.number(),
      text: z3.string(),
      tokens: z3.array(z3.number()),
      temperature: z3.number(),
      avg_logprob: z3.number(),
      compression_ratio: z3.number(),
      no_speech_prob: z3.number()
    })
  ),
  x_groq: z3.object({
    id: z3.string()
  })
});

// src/groq-provider.ts
function createGroq(options = {}) {
  var _a;
  const baseURL = (_a = withoutTrailingSlash(options.baseURL)) != null ? _a : "https://api.groq.com/openai/v1";
  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: "GROQ_API_KEY",
      description: "Groq"
    })}`,
    ...options.headers
  });
  const createChatModel = (modelId, settings = {}) => new GroqChatLanguageModel(modelId, settings, {
    provider: "groq.chat",
    url: ({ path }) => `${baseURL}${path}`,
    headers: getHeaders,
    fetch: options.fetch
  });
  const createLanguageModel = (modelId, settings) => {
    if (new.target) {
      throw new Error(
        "The Groq model function cannot be called with the new keyword."
      );
    }
    return createChatModel(modelId, settings);
  };
  const createTranscriptionModel = (modelId) => {
    return new GroqTranscriptionModel(modelId, {
      provider: "groq.transcription",
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch
    });
  };
  const provider = function(modelId, settings) {
    return createLanguageModel(modelId, settings);
  };
  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.textEmbeddingModel = (modelId) => {
    throw new NoSuchModelError({ modelId, modelType: "textEmbeddingModel" });
  };
  provider.transcription = createTranscriptionModel;
  return provider;
}
var groq = createGroq();
export {
  createGroq,
  groq
};
//# sourceMappingURL=index.mjs.map