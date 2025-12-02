// src/xai-provider.ts
import {
  OpenAICompatibleImageModel
} from "@ai-sdk/openai-compatible";
import {
  NoSuchModelError
} from "@ai-sdk/provider";
import {
  generateId,
  loadApiKey,
  withoutTrailingSlash
} from "@ai-sdk/provider-utils";

// src/xai-chat-language-model.ts
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi
} from "@ai-sdk/provider-utils";
import { z as z3 } from "zod/v4";

// src/convert-to-xai-chat-messages.ts
import {
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import { convertToBase64 } from "@ai-sdk/provider-utils";
function convertToXaiChatMessages(prompt) {
  const messages = [];
  const warnings = [];
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
                if (part.mediaType.startsWith("image/")) {
                  const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType;
                  return {
                    type: "image_url",
                    image_url: {
                      url: part.data instanceof URL ? part.data.toString() : `data:${mediaType};base64,${convertToBase64(part.data)}`
                    }
                  };
                } else {
                  throw new UnsupportedFunctionalityError({
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

// src/map-xai-finish-reason.ts
function mapXaiFinishReason(finishReason) {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool-calls";
    case "content_filter":
      return "content-filter";
    default:
      return "unknown";
  }
}

// src/xai-chat-options.ts
import { z } from "zod/v4";
var webSourceSchema = z.object({
  type: z.literal("web"),
  country: z.string().length(2).optional(),
  excludedWebsites: z.array(z.string()).max(5).optional(),
  allowedWebsites: z.array(z.string()).max(5).optional(),
  safeSearch: z.boolean().optional()
});
var xSourceSchema = z.object({
  type: z.literal("x"),
  xHandles: z.array(z.string()).optional()
});
var newsSourceSchema = z.object({
  type: z.literal("news"),
  country: z.string().length(2).optional(),
  excludedWebsites: z.array(z.string()).max(5).optional(),
  safeSearch: z.boolean().optional()
});
var rssSourceSchema = z.object({
  type: z.literal("rss"),
  links: z.array(z.string().url()).max(1)
  // currently only supports one RSS link
});
var searchSourceSchema = z.discriminatedUnion("type", [
  webSourceSchema,
  xSourceSchema,
  newsSourceSchema,
  rssSourceSchema
]);
var xaiProviderOptions = z.object({
  /**
   * reasoning effort for reasoning models
   * only supported by grok-3-mini and grok-3-mini-fast models
   */
  reasoningEffort: z.enum(["low", "high"]).optional(),
  searchParameters: z.object({
    /**
     * search mode preference
     * - "off": disables search completely
     * - "auto": model decides whether to search (default)
     * - "on": always enables search
     */
    mode: z.enum(["off", "auto", "on"]),
    /**
     * whether to return citations in the response
     * defaults to true
     */
    returnCitations: z.boolean().optional(),
    /**
     * start date for search data (ISO8601 format: YYYY-MM-DD)
     */
    fromDate: z.string().optional(),
    /**
     * end date for search data (ISO8601 format: YYYY-MM-DD)
     */
    toDate: z.string().optional(),
    /**
     * maximum number of search results to consider
     * defaults to 20
     */
    maxSearchResults: z.number().min(1).max(50).optional(),
    /**
     * data sources to search from
     * defaults to ["web", "x"] if not specified
     */
    sources: z.array(searchSourceSchema).optional()
  }).optional()
});

// src/xai-error.ts
import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
import { z as z2 } from "zod/v4";
var xaiErrorDataSchema = z2.object({
  error: z2.object({
    message: z2.string(),
    type: z2.string().nullish(),
    param: z2.any().nullish(),
    code: z2.union([z2.string(), z2.number()]).nullish()
  })
});
var xaiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: xaiErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/xai-prepare-tools.ts
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
  const xaiTools = [];
  for (const tool of tools) {
    if (tool.type === "provider-defined") {
      toolWarnings.push({ type: "unsupported-tool", tool });
    } else {
      xaiTools.push({
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
    return { tools: xaiTools, toolChoice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
      return { tools: xaiTools, toolChoice: type, toolWarnings };
    case "required":
      return { tools: xaiTools, toolChoice: "required", toolWarnings };
    case "tool":
      return {
        tools: xaiTools,
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

// src/xai-chat-language-model.ts
var XaiChatLanguageModel = class {
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
    seed,
    responseFormat,
    providerOptions,
    tools,
    toolChoice
  }) {
    var _a, _b, _c;
    const warnings = [];
    const options = (_a = await parseProviderOptions({
      provider: "xai",
      providerOptions,
      schema: xaiProviderOptions
    })) != null ? _a : {};
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty"
      });
    }
    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty"
      });
    }
    if (stopSequences != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "stopSequences"
      });
    }
    if (responseFormat != null && responseFormat.type === "json" && responseFormat.schema != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format schema is not supported"
      });
    }
    const { messages, warnings: messageWarnings } = convertToXaiChatMessages(prompt);
    warnings.push(...messageWarnings);
    const {
      tools: xaiTools,
      toolChoice: xaiToolChoice,
      toolWarnings
    } = prepareTools({
      tools,
      toolChoice
    });
    warnings.push(...toolWarnings);
    const baseArgs = {
      // model id
      model: this.modelId,
      // standard generation settings
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      seed,
      reasoning_effort: options.reasoningEffort,
      // response format
      response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? responseFormat.schema != null ? {
        type: "json_schema",
        json_schema: {
          name: (_b = responseFormat.name) != null ? _b : "response",
          schema: responseFormat.schema,
          strict: true
        }
      } : { type: "json_object" } : void 0,
      // search parameters
      search_parameters: options.searchParameters ? {
        mode: options.searchParameters.mode,
        return_citations: options.searchParameters.returnCitations,
        from_date: options.searchParameters.fromDate,
        to_date: options.searchParameters.toDate,
        max_search_results: options.searchParameters.maxSearchResults,
        sources: (_c = options.searchParameters.sources) == null ? void 0 : _c.map((source) => ({
          type: source.type,
          ...source.type === "web" && {
            country: source.country,
            excluded_websites: source.excludedWebsites,
            allowed_websites: source.allowedWebsites,
            safe_search: source.safeSearch
          },
          ...source.type === "x" && {
            x_handles: source.xHandles
          },
          ...source.type === "news" && {
            country: source.country,
            excluded_websites: source.excludedWebsites,
            safe_search: source.safeSearch
          },
          ...source.type === "rss" && {
            links: source.links
          }
        }))
      } : void 0,
      // messages in xai format
      messages,
      // tools in xai format
      tools: xaiTools,
      tool_choice: xaiToolChoice
    };
    return {
      args: baseArgs,
      warnings
    };
  }
  async doGenerate(options) {
    var _a, _b, _c;
    const { args: body, warnings } = await this.getArgs(options);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await postJsonToApi({
      url: `${(_a = this.config.baseURL) != null ? _a : "https://api.x.ai/v1"}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: xaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        xaiChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const choice = response.choices[0];
    const content = [];
    if (choice.message.content != null && choice.message.content.length > 0) {
      let text = choice.message.content;
      const lastMessage = body.messages[body.messages.length - 1];
      if ((lastMessage == null ? void 0 : lastMessage.role) === "assistant" && text === lastMessage.content) {
        text = "";
      }
      if (text.length > 0) {
        content.push({ type: "text", text });
      }
    }
    if (choice.message.reasoning_content != null && choice.message.reasoning_content.length > 0) {
      content.push({
        type: "reasoning",
        text: choice.message.reasoning_content
      });
    }
    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool-call",
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments
        });
      }
    }
    if (response.citations != null) {
      for (const url of response.citations) {
        content.push({
          type: "source",
          sourceType: "url",
          id: this.config.generateId(),
          url
        });
      }
    }
    return {
      content,
      finishReason: mapXaiFinishReason(choice.finish_reason),
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        reasoningTokens: (_c = (_b = response.usage.completion_tokens_details) == null ? void 0 : _b.reasoning_tokens) != null ? _c : void 0
      },
      request: { body },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse
      },
      warnings
    };
  }
  async doStream(options) {
    var _a;
    const { args, warnings } = await this.getArgs(options);
    const body = {
      ...args,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };
    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${(_a = this.config.baseURL) != null ? _a : "https://api.x.ai/v1"}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: xaiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(xaiChatChunkSchema),
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
    const contentBlocks = {};
    const lastReasoningDeltas = {};
    const self = this;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            var _a2, _b;
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
            if (!chunk.success) {
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if (isFirstChunk) {
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value)
              });
              isFirstChunk = false;
            }
            if (value.citations != null) {
              for (const url of value.citations) {
                controller.enqueue({
                  type: "source",
                  sourceType: "url",
                  id: self.config.generateId(),
                  url
                });
              }
            }
            if (value.usage != null) {
              usage.inputTokens = value.usage.prompt_tokens;
              usage.outputTokens = value.usage.completion_tokens;
              usage.totalTokens = value.usage.total_tokens;
              usage.reasoningTokens = (_b = (_a2 = value.usage.completion_tokens_details) == null ? void 0 : _a2.reasoning_tokens) != null ? _b : void 0;
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapXaiFinishReason(choice.finish_reason);
            }
            if ((choice == null ? void 0 : choice.delta) == null) {
              return;
            }
            const delta = choice.delta;
            const choiceIndex = choice.index;
            if (delta.content != null && delta.content.length > 0) {
              const textContent = delta.content;
              const lastMessage = body.messages[body.messages.length - 1];
              if ((lastMessage == null ? void 0 : lastMessage.role) === "assistant" && textContent === lastMessage.content) {
                return;
              }
              const blockId = `text-${value.id || choiceIndex}`;
              if (contentBlocks[blockId] == null) {
                contentBlocks[blockId] = { type: "text" };
                controller.enqueue({
                  type: "text-start",
                  id: blockId
                });
              }
              controller.enqueue({
                type: "text-delta",
                id: blockId,
                delta: textContent
              });
            }
            if (delta.reasoning_content != null && delta.reasoning_content.length > 0) {
              const blockId = `reasoning-${value.id || choiceIndex}`;
              if (lastReasoningDeltas[blockId] === delta.reasoning_content) {
                return;
              }
              lastReasoningDeltas[blockId] = delta.reasoning_content;
              if (contentBlocks[blockId] == null) {
                contentBlocks[blockId] = { type: "reasoning" };
                controller.enqueue({
                  type: "reasoning-start",
                  id: blockId
                });
              }
              controller.enqueue({
                type: "reasoning-delta",
                id: blockId,
                delta: delta.reasoning_content
              });
            }
            if (delta.tool_calls != null) {
              for (const toolCall of delta.tool_calls) {
                const toolCallId = toolCall.id;
                controller.enqueue({
                  type: "tool-input-start",
                  id: toolCallId,
                  toolName: toolCall.function.name
                });
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCallId,
                  delta: toolCall.function.arguments
                });
                controller.enqueue({
                  type: "tool-input-end",
                  id: toolCallId
                });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId,
                  toolName: toolCall.function.name,
                  input: toolCall.function.arguments
                });
              }
            }
          },
          flush(controller) {
            for (const [blockId, block] of Object.entries(contentBlocks)) {
              controller.enqueue({
                type: block.type === "text" ? "text-end" : "reasoning-end",
                id: blockId
              });
            }
            controller.enqueue({ type: "finish", finishReason, usage });
          }
        })
      ),
      request: { body },
      response: { headers: responseHeaders }
    };
  }
};
var xaiUsageSchema = z3.object({
  prompt_tokens: z3.number(),
  completion_tokens: z3.number(),
  total_tokens: z3.number(),
  completion_tokens_details: z3.object({
    reasoning_tokens: z3.number().nullish()
  }).nullish()
});
var xaiChatResponseSchema = z3.object({
  id: z3.string().nullish(),
  created: z3.number().nullish(),
  model: z3.string().nullish(),
  choices: z3.array(
    z3.object({
      message: z3.object({
        role: z3.literal("assistant"),
        content: z3.string().nullish(),
        reasoning_content: z3.string().nullish(),
        tool_calls: z3.array(
          z3.object({
            id: z3.string(),
            type: z3.literal("function"),
            function: z3.object({
              name: z3.string(),
              arguments: z3.string()
            })
          })
        ).nullish()
      }),
      index: z3.number(),
      finish_reason: z3.string().nullish()
    })
  ),
  object: z3.literal("chat.completion"),
  usage: xaiUsageSchema,
  citations: z3.array(z3.string().url()).nullish()
});
var xaiChatChunkSchema = z3.object({
  id: z3.string().nullish(),
  created: z3.number().nullish(),
  model: z3.string().nullish(),
  choices: z3.array(
    z3.object({
      delta: z3.object({
        role: z3.enum(["assistant"]).optional(),
        content: z3.string().nullish(),
        reasoning_content: z3.string().nullish(),
        tool_calls: z3.array(
          z3.object({
            id: z3.string(),
            type: z3.literal("function"),
            function: z3.object({
              name: z3.string(),
              arguments: z3.string()
            })
          })
        ).nullish()
      }),
      finish_reason: z3.string().nullish(),
      index: z3.number()
    })
  ),
  usage: xaiUsageSchema.nullish(),
  citations: z3.array(z3.string().url()).nullish()
});

// src/xai-provider.ts
var xaiErrorStructure = {
  errorSchema: xaiErrorDataSchema,
  errorToMessage: (data) => data.error.message
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
  const createLanguageModel = (modelId) => {
    return new XaiChatLanguageModel(modelId, {
      provider: "xai.chat",
      baseURL,
      headers: getHeaders,
      generateId,
      fetch: options.fetch
    });
  };
  const createImageModel = (modelId) => {
    return new OpenAICompatibleImageModel(modelId, {
      provider: "xai.image",
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      errorStructure: xaiErrorStructure
    });
  };
  const provider = (modelId) => createLanguageModel(modelId);
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