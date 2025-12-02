// src/chat/openai-compatible-chat-language-model.ts
import {
  InvalidResponseDataError
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  parseProviderOptions,
  postJsonToApi
} from "@ai-sdk/provider-utils";
import { z as z3 } from "zod/v4";

// src/chat/convert-to-openai-compatible-chat-messages.ts
import {
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import { convertToBase64 } from "@ai-sdk/provider-utils";
function getOpenAIMetadata(message) {
  var _a, _b;
  return (_b = (_a = message == null ? void 0 : message.providerOptions) == null ? void 0 : _a.openaiCompatible) != null ? _b : {};
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
            const partMetadata = getOpenAIMetadata(part);
            switch (part.type) {
              case "text": {
                return { type: "text", text: part.text, ...partMetadata };
              }
              case "file": {
                if (part.mediaType.startsWith("image/")) {
                  const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType;
                  return {
                    type: "image_url",
                    image_url: {
                      url: part.data instanceof URL ? part.data.toString() : `data:${mediaType};base64,${convertToBase64(part.data)}`
                    },
                    ...partMetadata
                  };
                } else {
                  throw new UnsupportedFunctionalityError({
                    functionality: `file part media type ${part.mediaType}`
                  });
                }
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
                  arguments: JSON.stringify(part.input)
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
          const toolResponseMetadata = getOpenAIMetadata(toolResponse);
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: contentValue,
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

// src/chat/map-openai-compatible-finish-reason.ts
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

// src/chat/openai-compatible-chat-options.ts
import { z } from "zod/v4";
var openaiCompatibleProviderOptions = z.object({
  /**
   * A unique identifier representing your end-user, which can help the provider to
   * monitor and detect abuse.
   */
  user: z.string().optional(),
  /**
   * Reasoning effort for reasoning models. Defaults to `medium`.
   */
  reasoningEffort: z.string().optional(),
  /**
   * Controls the verbosity of the generated text. Defaults to `medium`.
   */
  textVerbosity: z.string().optional()
});

// src/openai-compatible-error.ts
import { z as z2 } from "zod/v4";
var openaiCompatibleErrorDataSchema = z2.object({
  error: z2.object({
    message: z2.string(),
    // The additional information below is handled loosely to support
    // OpenAI-compatible providers that have slightly different error
    // responses:
    type: z2.string().nullish(),
    param: z2.any().nullish(),
    code: z2.union([z2.string(), z2.number()]).nullish()
  })
});
var defaultOpenAICompatibleErrorStructure = {
  errorSchema: openaiCompatibleErrorDataSchema,
  errorToMessage: (data) => data.error.message
};

// src/chat/openai-compatible-prepare-tools.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";
function prepareTools({
  tools,
  toolChoice
}) {
  tools = (tools == null ? void 0 : tools.length) ? tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, toolChoice: void 0, toolWarnings };
  }
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
          parameters: tool.inputSchema
        }
      });
    }
  }
  if (toolChoice == null) {
    return { tools: openaiCompatTools, toolChoice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: openaiCompatTools, toolChoice: type, toolWarnings };
    case "tool":
      return {
        tools: openaiCompatTools,
        toolChoice: {
          type: "function",
          function: { name: toolChoice.toolName }
        },
        toolWarnings
      };
    default: {
      const _exhaustiveCheck = type;
      throw new UnsupportedFunctionalityError2({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/chat/openai-compatible-chat-language-model.ts
var OpenAICompatibleChatLanguageModel = class {
  // type inferred via constructor
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    var _a, _b;
    this.modelId = modelId;
    this.config = config;
    const errorStructure = (_a = config.errorStructure) != null ? _a : defaultOpenAICompatibleErrorStructure;
    this.chunkSchema = createOpenAICompatibleChatChunkSchema(
      errorStructure.errorSchema
    );
    this.failedResponseHandler = createJsonErrorResponseHandler(errorStructure);
    this.supportsStructuredOutputs = (_b = config.supportsStructuredOutputs) != null ? _b : false;
  }
  get provider() {
    return this.config.provider;
  }
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
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
    providerOptions,
    stopSequences,
    responseFormat,
    seed,
    toolChoice,
    tools
  }) {
    var _a, _b, _c, _d;
    const warnings = [];
    const compatibleOptions = Object.assign(
      (_a = await parseProviderOptions({
        provider: "openai-compatible",
        providerOptions,
        schema: openaiCompatibleProviderOptions
      })) != null ? _a : {},
      (_b = await parseProviderOptions({
        provider: this.providerOptionsName,
        providerOptions,
        schema: openaiCompatibleProviderOptions
      })) != null ? _b : {}
    );
    if (topK != null) {
      warnings.push({ type: "unsupported-setting", setting: "topK" });
    }
    if ((responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null && !this.supportsStructuredOutputs) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format schema is only supported with structuredOutputs"
      });
    }
    const {
      tools: openaiTools,
      toolChoice: openaiToolChoice,
      toolWarnings
    } = prepareTools({
      tools,
      toolChoice
    });
    return {
      args: {
        // model id:
        model: this.modelId,
        // model specific settings:
        user: compatibleOptions.user,
        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? this.supportsStructuredOutputs === true && responseFormat.schema != null ? {
          type: "json_schema",
          json_schema: {
            schema: responseFormat.schema,
            name: (_c = responseFormat.name) != null ? _c : "response",
            description: responseFormat.description
          }
        } : { type: "json_object" } : void 0,
        stop: stopSequences,
        seed,
        ...Object.fromEntries(
          Object.entries(
            (_d = providerOptions == null ? void 0 : providerOptions[this.providerOptionsName]) != null ? _d : {}
          ).filter(
            ([key]) => !Object.keys(openaiCompatibleProviderOptions.shape).includes(key)
          )
        ),
        reasoning_effort: compatibleOptions.reasoningEffort,
        verbosity: compatibleOptions.textVerbosity,
        // messages:
        messages: convertToOpenAICompatibleChatMessages(prompt),
        // tools:
        tools: openaiTools,
        tool_choice: openaiToolChoice
      },
      warnings: [...warnings, ...toolWarnings]
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q;
    const { args, warnings } = await this.getArgs({ ...options });
    const body = JSON.stringify(args);
    const {
      responseHeaders,
      value: responseBody,
      rawValue: rawResponse
    } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenAICompatibleChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const choice = responseBody.choices[0];
    const content = [];
    const text = choice.message.content;
    if (text != null && text.length > 0) {
      content.push({ type: "text", text });
    }
    const reasoning = (_a = choice.message.reasoning_content) != null ? _a : choice.message.reasoning;
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
          toolCallId: (_b = toolCall.id) != null ? _b : generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments
        });
      }
    }
    const providerMetadata = {
      [this.providerOptionsName]: {},
      ...await ((_d = (_c = this.config.metadataExtractor) == null ? void 0 : _c.extractMetadata) == null ? void 0 : _d.call(_c, {
        parsedBody: rawResponse
      }))
    };
    const completionTokenDetails = (_e = responseBody.usage) == null ? void 0 : _e.completion_tokens_details;
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens) != null) {
      providerMetadata[this.providerOptionsName].acceptedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens;
    }
    if ((completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens) != null) {
      providerMetadata[this.providerOptionsName].rejectedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens;
    }
    return {
      content,
      finishReason: mapOpenAICompatibleFinishReason(choice.finish_reason),
      usage: {
        inputTokens: (_g = (_f = responseBody.usage) == null ? void 0 : _f.prompt_tokens) != null ? _g : void 0,
        outputTokens: (_i = (_h = responseBody.usage) == null ? void 0 : _h.completion_tokens) != null ? _i : void 0,
        totalTokens: (_k = (_j = responseBody.usage) == null ? void 0 : _j.total_tokens) != null ? _k : void 0,
        reasoningTokens: (_n = (_m = (_l = responseBody.usage) == null ? void 0 : _l.completion_tokens_details) == null ? void 0 : _m.reasoning_tokens) != null ? _n : void 0,
        cachedInputTokens: (_q = (_p = (_o = responseBody.usage) == null ? void 0 : _o.prompt_tokens_details) == null ? void 0 : _p.cached_tokens) != null ? _q : void 0
      },
      providerMetadata,
      request: { body },
      response: {
        ...getResponseMetadata(responseBody),
        headers: responseHeaders,
        body: rawResponse
      },
      warnings
    };
  }
  async doStream(options) {
    var _a;
    const { args, warnings } = await this.getArgs({ ...options });
    const body = {
      ...args,
      stream: true,
      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage ? { include_usage: true } : void 0
    };
    const metadataExtractor = (_a = this.config.metadataExtractor) == null ? void 0 : _a.createStreamExtractor();
    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        this.chunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const toolCalls = [];
    let finishReason = "unknown";
    const usage = {
      completionTokens: void 0,
      completionTokensDetails: {
        reasoningTokens: void 0,
        acceptedPredictionTokens: void 0,
        rejectedPredictionTokens: void 0
      },
      promptTokens: void 0,
      promptTokensDetails: {
        cachedTokens: void 0
      },
      totalTokens: void 0
    };
    let isFirstChunk = true;
    const providerOptionsName = this.providerOptionsName;
    let isActiveReasoning = false;
    let isActiveText = false;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          // TODO we lost type safety on Chunk, most likely due to the error schema. MUST FIX
          transform(chunk, controller) {
            var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
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
                total_tokens,
                prompt_tokens_details,
                completion_tokens_details
              } = value.usage;
              usage.promptTokens = prompt_tokens != null ? prompt_tokens : void 0;
              usage.completionTokens = completion_tokens != null ? completion_tokens : void 0;
              usage.totalTokens = total_tokens != null ? total_tokens : void 0;
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
            const reasoningContent = (_a2 = delta.reasoning_content) != null ? _a2 : delta.reasoning;
            if (reasoningContent) {
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
                delta: reasoningContent
              });
            }
            if (delta.content) {
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
                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`
                    });
                  }
                  if (((_b = toolCallDelta.function) == null ? void 0 : _b.name) == null) {
                    throw new InvalidResponseDataError({
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
                      arguments: (_c = toolCallDelta.function.arguments) != null ? _c : ""
                    },
                    hasFinished: false
                  };
                  const toolCall2 = toolCalls[index];
                  if (((_d = toolCall2.function) == null ? void 0 : _d.name) != null && ((_e = toolCall2.function) == null ? void 0 : _e.arguments) != null) {
                    if (toolCall2.function.arguments.length > 0) {
                      controller.enqueue({
                        type: "tool-input-delta",
                        id: toolCall2.id,
                        delta: toolCall2.function.arguments
                      });
                    }
                    if (isParsableJson(toolCall2.function.arguments)) {
                      controller.enqueue({
                        type: "tool-input-end",
                        id: toolCall2.id
                      });
                      controller.enqueue({
                        type: "tool-call",
                        toolCallId: (_f = toolCall2.id) != null ? _f : generateId(),
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
                if (((_g = toolCallDelta.function) == null ? void 0 : _g.arguments) != null) {
                  toolCall.function.arguments += (_i = (_h = toolCallDelta.function) == null ? void 0 : _h.arguments) != null ? _i : "";
                }
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.id,
                  delta: (_j = toolCallDelta.function.arguments) != null ? _j : ""
                });
                if (((_k = toolCall.function) == null ? void 0 : _k.name) != null && ((_l = toolCall.function) == null ? void 0 : _l.arguments) != null && isParsableJson(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCall.id
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: (_m = toolCall.id) != null ? _m : generateId(),
                    toolName: toolCall.function.name,
                    input: toolCall.function.arguments
                  });
                  toolCall.hasFinished = true;
                }
              }
            }
          },
          flush(controller) {
            var _a2, _b, _c, _d, _e, _f;
            if (isActiveReasoning) {
              controller.enqueue({ type: "reasoning-end", id: "reasoning-0" });
            }
            if (isActiveText) {
              controller.enqueue({ type: "text-end", id: "txt-0" });
            }
            for (const toolCall of toolCalls.filter(
              (toolCall2) => !toolCall2.hasFinished
            )) {
              controller.enqueue({
                type: "tool-input-end",
                id: toolCall.id
              });
              controller.enqueue({
                type: "tool-call",
                toolCallId: (_a2 = toolCall.id) != null ? _a2 : generateId(),
                toolName: toolCall.function.name,
                input: toolCall.function.arguments
              });
            }
            const providerMetadata = {
              [providerOptionsName]: {},
              ...metadataExtractor == null ? void 0 : metadataExtractor.buildMetadata()
            };
            if (usage.completionTokensDetails.acceptedPredictionTokens != null) {
              providerMetadata[providerOptionsName].acceptedPredictionTokens = usage.completionTokensDetails.acceptedPredictionTokens;
            }
            if (usage.completionTokensDetails.rejectedPredictionTokens != null) {
              providerMetadata[providerOptionsName].rejectedPredictionTokens = usage.completionTokensDetails.rejectedPredictionTokens;
            }
            controller.enqueue({
              type: "finish",
              finishReason,
              usage: {
                inputTokens: (_b = usage.promptTokens) != null ? _b : void 0,
                outputTokens: (_c = usage.completionTokens) != null ? _c : void 0,
                totalTokens: (_d = usage.totalTokens) != null ? _d : void 0,
                reasoningTokens: (_e = usage.completionTokensDetails.reasoningTokens) != null ? _e : void 0,
                cachedInputTokens: (_f = usage.promptTokensDetails.cachedTokens) != null ? _f : void 0
              },
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
var openaiCompatibleTokenUsageSchema = z3.object({
  prompt_tokens: z3.number().nullish(),
  completion_tokens: z3.number().nullish(),
  total_tokens: z3.number().nullish(),
  prompt_tokens_details: z3.object({
    cached_tokens: z3.number().nullish()
  }).nullish(),
  completion_tokens_details: z3.object({
    reasoning_tokens: z3.number().nullish(),
    accepted_prediction_tokens: z3.number().nullish(),
    rejected_prediction_tokens: z3.number().nullish()
  }).nullish()
}).nullish();
var OpenAICompatibleChatResponseSchema = z3.object({
  id: z3.string().nullish(),
  created: z3.number().nullish(),
  model: z3.string().nullish(),
  choices: z3.array(
    z3.object({
      message: z3.object({
        role: z3.literal("assistant").nullish(),
        content: z3.string().nullish(),
        reasoning_content: z3.string().nullish(),
        reasoning: z3.string().nullish(),
        tool_calls: z3.array(
          z3.object({
            id: z3.string().nullish(),
            function: z3.object({
              name: z3.string(),
              arguments: z3.string()
            })
          })
        ).nullish()
      }),
      finish_reason: z3.string().nullish()
    })
  ),
  usage: openaiCompatibleTokenUsageSchema
});
var createOpenAICompatibleChatChunkSchema = (errorSchema) => z3.union([
  z3.object({
    id: z3.string().nullish(),
    created: z3.number().nullish(),
    model: z3.string().nullish(),
    choices: z3.array(
      z3.object({
        delta: z3.object({
          role: z3.enum(["assistant"]).nullish(),
          content: z3.string().nullish(),
          // Most openai-compatible models set `reasoning_content`, but some
          // providers serving `gpt-oss` set `reasoning`. See #7866
          reasoning_content: z3.string().nullish(),
          reasoning: z3.string().nullish(),
          tool_calls: z3.array(
            z3.object({
              index: z3.number(),
              id: z3.string().nullish(),
              function: z3.object({
                name: z3.string().nullish(),
                arguments: z3.string().nullish()
              })
            })
          ).nullish()
        }).nullish(),
        finish_reason: z3.string().nullish()
      })
    ),
    usage: openaiCompatibleTokenUsageSchema
  }),
  errorSchema
]);

// src/completion/openai-compatible-completion-language-model.ts
import {
  combineHeaders as combineHeaders2,
  createEventSourceResponseHandler as createEventSourceResponseHandler2,
  createJsonErrorResponseHandler as createJsonErrorResponseHandler2,
  createJsonResponseHandler as createJsonResponseHandler2,
  parseProviderOptions as parseProviderOptions2,
  postJsonToApi as postJsonToApi2
} from "@ai-sdk/provider-utils";
import { z as z5 } from "zod/v4";

// src/completion/convert-to-openai-compatible-completion-prompt.ts
import {
  InvalidPromptError,
  UnsupportedFunctionalityError as UnsupportedFunctionalityError3
} from "@ai-sdk/provider";
function convertToOpenAICompatibleCompletionPrompt({
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
        throw new InvalidPromptError({
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
              throw new UnsupportedFunctionalityError3({
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
        throw new UnsupportedFunctionalityError3({
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

// src/completion/map-openai-compatible-finish-reason.ts
function mapOpenAICompatibleFinishReason2(finishReason) {
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

// src/completion/openai-compatible-completion-options.ts
import { z as z4 } from "zod/v4";
var openaiCompatibleCompletionProviderOptions = z4.object({
  /**
   * Echo back the prompt in addition to the completion.
   */
  echo: z4.boolean().optional(),
  /**
   * Modify the likelihood of specified tokens appearing in the completion.
   *
   * Accepts a JSON object that maps tokens (specified by their token ID in
   * the GPT tokenizer) to an associated bias value from -100 to 100.
   */
  logitBias: z4.record(z4.string(), z4.number()).optional(),
  /**
   * The suffix that comes after a completion of inserted text.
   */
  suffix: z4.string().optional(),
  /**
   * A unique identifier representing your end-user, which can help providers to
   * monitor and detect abuse.
   */
  user: z4.string().optional()
});

// src/completion/openai-compatible-completion-language-model.ts
var OpenAICompatibleCompletionLanguageModel = class {
  // type inferred via constructor
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    var _a;
    this.modelId = modelId;
    this.config = config;
    const errorStructure = (_a = config.errorStructure) != null ? _a : defaultOpenAICompatibleErrorStructure;
    this.chunkSchema = createOpenAICompatibleCompletionChunkSchema(
      errorStructure.errorSchema
    );
    this.failedResponseHandler = createJsonErrorResponseHandler2(errorStructure);
  }
  get provider() {
    return this.config.provider;
  }
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
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
    stopSequences: userStopSequences,
    responseFormat,
    seed,
    providerOptions,
    tools,
    toolChoice
  }) {
    var _a;
    const warnings = [];
    const completionOptions = (_a = await parseProviderOptions2({
      provider: this.providerOptionsName,
      providerOptions,
      schema: openaiCompatibleCompletionProviderOptions
    })) != null ? _a : {};
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
    const { prompt: completionPrompt, stopSequences } = convertToOpenAICompatibleCompletionPrompt({ prompt });
    const stop = [...stopSequences != null ? stopSequences : [], ...userStopSequences != null ? userStopSequences : []];
    return {
      args: {
        // model id:
        model: this.modelId,
        // model specific settings:
        echo: completionOptions.echo,
        logit_bias: completionOptions.logitBias,
        suffix: completionOptions.suffix,
        user: completionOptions.user,
        // standardized settings:
        max_tokens: maxOutputTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        seed,
        ...providerOptions == null ? void 0 : providerOptions[this.providerOptionsName],
        // prompt:
        prompt: completionPrompt,
        // stop sequences:
        stop: stop.length > 0 ? stop : void 0
      },
      warnings
    };
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f;
    const { args, warnings } = await this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await postJsonToApi2({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
        openaiCompatibleCompletionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const choice = response.choices[0];
    const content = [];
    if (choice.text != null && choice.text.length > 0) {
      content.push({ type: "text", text: choice.text });
    }
    return {
      content,
      usage: {
        inputTokens: (_b = (_a = response.usage) == null ? void 0 : _a.prompt_tokens) != null ? _b : void 0,
        outputTokens: (_d = (_c = response.usage) == null ? void 0 : _c.completion_tokens) != null ? _d : void 0,
        totalTokens: (_f = (_e = response.usage) == null ? void 0 : _e.total_tokens) != null ? _f : void 0
      },
      finishReason: mapOpenAICompatibleFinishReason2(choice.finish_reason),
      request: { body: args },
      response: {
        ...getResponseMetadata2(response),
        headers: responseHeaders,
        body: rawResponse
      },
      warnings
    };
  }
  async doStream(options) {
    const { args, warnings } = await this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage ? { include_usage: true } : void 0
    };
    const { responseHeaders, value: response } = await postJsonToApi2({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler2(
        this.chunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    let finishReason = "unknown";
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
            var _a, _b, _c;
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
              controller.enqueue({
                type: "text-start",
                id: "0"
              });
            }
            if (value.usage != null) {
              usage.inputTokens = (_a = value.usage.prompt_tokens) != null ? _a : void 0;
              usage.outputTokens = (_b = value.usage.completion_tokens) != null ? _b : void 0;
              usage.totalTokens = (_c = value.usage.total_tokens) != null ? _c : void 0;
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapOpenAICompatibleFinishReason2(
                choice.finish_reason
              );
            }
            if ((choice == null ? void 0 : choice.text) != null) {
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
var usageSchema = z5.object({
  prompt_tokens: z5.number(),
  completion_tokens: z5.number(),
  total_tokens: z5.number()
});
var openaiCompatibleCompletionResponseSchema = z5.object({
  id: z5.string().nullish(),
  created: z5.number().nullish(),
  model: z5.string().nullish(),
  choices: z5.array(
    z5.object({
      text: z5.string(),
      finish_reason: z5.string()
    })
  ),
  usage: usageSchema.nullish()
});
var createOpenAICompatibleCompletionChunkSchema = (errorSchema) => z5.union([
  z5.object({
    id: z5.string().nullish(),
    created: z5.number().nullish(),
    model: z5.string().nullish(),
    choices: z5.array(
      z5.object({
        text: z5.string(),
        finish_reason: z5.string().nullish(),
        index: z5.number()
      })
    ),
    usage: usageSchema.nullish()
  }),
  errorSchema
]);

// src/embedding/openai-compatible-embedding-model.ts
import {
  TooManyEmbeddingValuesForCallError
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders3,
  createJsonErrorResponseHandler as createJsonErrorResponseHandler3,
  createJsonResponseHandler as createJsonResponseHandler3,
  parseProviderOptions as parseProviderOptions3,
  postJsonToApi as postJsonToApi3
} from "@ai-sdk/provider-utils";
import { z as z7 } from "zod/v4";

// src/embedding/openai-compatible-embedding-options.ts
import { z as z6 } from "zod/v4";
var openaiCompatibleEmbeddingProviderOptions = z6.object({
  /**
   * The number of dimensions the resulting output embeddings should have.
   * Only supported in text-embedding-3 and later models.
   */
  dimensions: z6.number().optional(),
  /**
   * A unique identifier representing your end-user, which can help providers to
   * monitor and detect abuse.
   */
  user: z6.string().optional()
});

// src/embedding/openai-compatible-embedding-model.ts
var OpenAICompatibleEmbeddingModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    this.modelId = modelId;
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
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
  }
  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions
  }) {
    var _a, _b, _c;
    const compatibleOptions = Object.assign(
      (_a = await parseProviderOptions3({
        provider: "openai-compatible",
        providerOptions,
        schema: openaiCompatibleEmbeddingProviderOptions
      })) != null ? _a : {},
      (_b = await parseProviderOptions3({
        provider: this.providerOptionsName,
        providerOptions,
        schema: openaiCompatibleEmbeddingProviderOptions
      })) != null ? _b : {}
    );
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      });
    }
    const {
      responseHeaders,
      value: response,
      rawValue
    } = await postJsonToApi3({
      url: this.config.url({
        path: "/embeddings",
        modelId: this.modelId
      }),
      headers: combineHeaders3(this.config.headers(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: "float",
        dimensions: compatibleOptions.dimensions,
        user: compatibleOptions.user
      },
      failedResponseHandler: createJsonErrorResponseHandler3(
        (_c = this.config.errorStructure) != null ? _c : defaultOpenAICompatibleErrorStructure
      ),
      successfulResponseHandler: createJsonResponseHandler3(
        openaiTextEmbeddingResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      embeddings: response.data.map((item) => item.embedding),
      usage: response.usage ? { tokens: response.usage.prompt_tokens } : void 0,
      providerMetadata: response.providerMetadata,
      response: { headers: responseHeaders, body: rawValue }
    };
  }
};
var openaiTextEmbeddingResponseSchema = z7.object({
  data: z7.array(z7.object({ embedding: z7.array(z7.number()) })),
  usage: z7.object({ prompt_tokens: z7.number() }).nullish(),
  providerMetadata: z7.record(z7.string(), z7.record(z7.string(), z7.any())).optional()
});

// src/image/openai-compatible-image-model.ts
import {
  combineHeaders as combineHeaders4,
  createJsonErrorResponseHandler as createJsonErrorResponseHandler4,
  createJsonResponseHandler as createJsonResponseHandler4,
  postJsonToApi as postJsonToApi4
} from "@ai-sdk/provider-utils";
import { z as z8 } from "zod/v4";
var OpenAICompatibleImageModel = class {
  constructor(modelId, config) {
    this.modelId = modelId;
    this.config = config;
    this.specificationVersion = "v2";
    this.maxImagesPerCall = 10;
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
    const { value: response, responseHeaders } = await postJsonToApi4({
      url: this.config.url({
        path: "/images/generations",
        modelId: this.modelId
      }),
      headers: combineHeaders4(this.config.headers(), headers),
      body: {
        model: this.modelId,
        prompt,
        n,
        size,
        ...(_d = providerOptions.openai) != null ? _d : {},
        response_format: "b64_json"
      },
      failedResponseHandler: createJsonErrorResponseHandler4(
        (_e = this.config.errorStructure) != null ? _e : defaultOpenAICompatibleErrorStructure
      ),
      successfulResponseHandler: createJsonResponseHandler4(
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
var openaiCompatibleImageResponseSchema = z8.object({
  data: z8.array(z8.object({ b64_json: z8.string() }))
});

// src/openai-compatible-provider.ts
import {
  withoutTrailingSlash,
  withUserAgentSuffix
} from "@ai-sdk/provider-utils";

// src/version.ts
var VERSION = true ? "1.0.27" : "0.0.0-test";

// src/openai-compatible-provider.ts
function createOpenAICompatible(options) {
  const baseURL = withoutTrailingSlash(options.baseURL);
  const providerName = options.name;
  const headers = {
    ...options.apiKey && { Authorization: `Bearer ${options.apiKey}` },
    ...options.headers
  };
  const getHeaders = () => withUserAgentSuffix(headers, `ai-sdk/openai-compatible/${VERSION}`);
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
  const createLanguageModel = (modelId) => createChatModel(modelId);
  const createChatModel = (modelId) => new OpenAICompatibleChatLanguageModel(modelId, {
    ...getCommonModelConfig("chat"),
    includeUsage: options.includeUsage,
    supportsStructuredOutputs: options.supportsStructuredOutputs
  });
  const createCompletionModel = (modelId) => new OpenAICompatibleCompletionLanguageModel(modelId, {
    ...getCommonModelConfig("completion"),
    includeUsage: options.includeUsage
  });
  const createEmbeddingModel = (modelId) => new OpenAICompatibleEmbeddingModel(modelId, {
    ...getCommonModelConfig("embedding")
  });
  const createImageModel = (modelId) => new OpenAICompatibleImageModel(modelId, getCommonModelConfig("image"));
  const provider = (modelId) => createLanguageModel(modelId);
  provider.languageModel = createLanguageModel;
  provider.chatModel = createChatModel;
  provider.completionModel = createCompletionModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.imageModel = createImageModel;
  return provider;
}
export {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
  OpenAICompatibleImageModel,
  VERSION,
  createOpenAICompatible
};
//# sourceMappingURL=index.mjs.map