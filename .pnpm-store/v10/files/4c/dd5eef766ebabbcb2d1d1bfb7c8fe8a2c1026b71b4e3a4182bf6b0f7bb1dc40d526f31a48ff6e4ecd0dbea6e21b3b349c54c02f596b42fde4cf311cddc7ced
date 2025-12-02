"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/internal/index.ts
var internal_exports = {};
__export(internal_exports, {
  AnthropicMessagesLanguageModel: () => AnthropicMessagesLanguageModel,
  anthropicTools: () => anthropicTools,
  prepareTools: () => prepareTools
});
module.exports = __toCommonJS(internal_exports);

// src/anthropic-messages-language-model.ts
var import_provider3 = require("@ai-sdk/provider");
var import_provider_utils5 = require("@ai-sdk/provider-utils");
var import_v45 = require("zod/v4");

// src/anthropic-error.ts
var import_provider_utils = require("@ai-sdk/provider-utils");
var import_v4 = require("zod/v4");
var anthropicErrorDataSchema = import_v4.z.object({
  type: import_v4.z.literal("error"),
  error: import_v4.z.object({
    type: import_v4.z.string(),
    message: import_v4.z.string()
  })
});
var anthropicFailedResponseHandler = (0, import_provider_utils.createJsonErrorResponseHandler)({
  errorSchema: anthropicErrorDataSchema,
  errorToMessage: (data) => data.error.message
});

// src/anthropic-messages-options.ts
var import_v42 = require("zod/v4");
var anthropicFilePartProviderOptions = import_v42.z.object({
  /**
   * Citation configuration for this document.
   * When enabled, this document will generate citations in the response.
   */
  citations: import_v42.z.object({
    /**
     * Enable citations for this document
     */
    enabled: import_v42.z.boolean()
  }).optional(),
  /**
   * Custom title for the document.
   * If not provided, the filename will be used.
   */
  title: import_v42.z.string().optional(),
  /**
   * Context about the document that will be passed to the model
   * but not used towards cited content.
   * Useful for storing document metadata as text or stringified JSON.
   */
  context: import_v42.z.string().optional()
});
var anthropicProviderOptions = import_v42.z.object({
  sendReasoning: import_v42.z.boolean().optional(),
  thinking: import_v42.z.object({
    type: import_v42.z.union([import_v42.z.literal("enabled"), import_v42.z.literal("disabled")]),
    budgetTokens: import_v42.z.number().optional()
  }).optional(),
  /**
   * Whether to disable parallel function calling during tool use. Default is false.
   * When set to true, Claude will use at most one tool per response.
   */
  disableParallelToolUse: import_v42.z.boolean().optional()
});

// src/anthropic-prepare-tools.ts
var import_provider = require("@ai-sdk/provider");

// src/get-cache-control.ts
function getCacheControl(providerMetadata) {
  var _a;
  const anthropic = providerMetadata == null ? void 0 : providerMetadata.anthropic;
  const cacheControlValue = (_a = anthropic == null ? void 0 : anthropic.cacheControl) != null ? _a : anthropic == null ? void 0 : anthropic.cache_control;
  return cacheControlValue;
}

// src/tool/web-search_20250305.ts
var import_provider_utils2 = require("@ai-sdk/provider-utils");
var import_v43 = require("zod/v4");
var webSearch_20250305ArgsSchema = import_v43.z.object({
  /**
   * Maximum number of web searches Claude can perform during the conversation.
   */
  maxUses: import_v43.z.number().optional(),
  /**
   * Optional list of domains that Claude is allowed to search.
   */
  allowedDomains: import_v43.z.array(import_v43.z.string()).optional(),
  /**
   * Optional list of domains that Claude should avoid when searching.
   */
  blockedDomains: import_v43.z.array(import_v43.z.string()).optional(),
  /**
   * Optional user location information to provide geographically relevant search results.
   */
  userLocation: import_v43.z.object({
    type: import_v43.z.literal("approximate"),
    city: import_v43.z.string().optional(),
    region: import_v43.z.string().optional(),
    country: import_v43.z.string().optional(),
    timezone: import_v43.z.string().optional()
  }).optional()
});
var webSearch_20250305OutputSchema = import_v43.z.array(
  import_v43.z.object({
    url: import_v43.z.string(),
    title: import_v43.z.string(),
    pageAge: import_v43.z.string().nullable(),
    encryptedContent: import_v43.z.string(),
    type: import_v43.z.string()
  })
);
var factory = (0, import_provider_utils2.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "anthropic.web_search_20250305",
  name: "web_search",
  inputSchema: import_v43.z.object({
    query: import_v43.z.string()
  }),
  outputSchema: webSearch_20250305OutputSchema
});
var webSearch_20250305 = (args = {}) => {
  return factory(args);
};

// src/anthropic-prepare-tools.ts
function isWebSearchTool(tool) {
  return typeof tool === "object" && tool !== null && "type" in tool && tool.type === "web_search_20250305";
}
function prepareTools({
  tools,
  toolChoice,
  disableParallelToolUse
}) {
  tools = (tools == null ? void 0 : tools.length) ? tools : void 0;
  const toolWarnings = [];
  const betas = /* @__PURE__ */ new Set();
  if (tools == null) {
    return { tools: void 0, toolChoice: void 0, toolWarnings, betas };
  }
  const anthropicTools2 = [];
  for (const tool of tools) {
    if (isWebSearchTool(tool)) {
      anthropicTools2.push(tool);
      continue;
    }
    switch (tool.type) {
      case "function":
        const cacheControl = getCacheControl(tool.providerOptions);
        anthropicTools2.push({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
          cache_control: cacheControl
        });
        break;
      case "provider-defined":
        switch (tool.id) {
          case "anthropic.computer_20250124":
            betas.add("computer-use-2025-01-24");
            anthropicTools2.push({
              name: "computer",
              type: "computer_20250124",
              display_width_px: tool.args.displayWidthPx,
              display_height_px: tool.args.displayHeightPx,
              display_number: tool.args.displayNumber
            });
            break;
          case "anthropic.computer_20241022":
            betas.add("computer-use-2024-10-22");
            anthropicTools2.push({
              name: "computer",
              type: "computer_20241022",
              display_width_px: tool.args.displayWidthPx,
              display_height_px: tool.args.displayHeightPx,
              display_number: tool.args.displayNumber
            });
            break;
          case "anthropic.text_editor_20250124":
            betas.add("computer-use-2025-01-24");
            anthropicTools2.push({
              name: "str_replace_editor",
              type: "text_editor_20250124"
            });
            break;
          case "anthropic.text_editor_20241022":
            betas.add("computer-use-2024-10-22");
            anthropicTools2.push({
              name: "str_replace_editor",
              type: "text_editor_20241022"
            });
            break;
          case "anthropic.text_editor_20250429":
            betas.add("computer-use-2025-01-24");
            anthropicTools2.push({
              name: "str_replace_based_edit_tool",
              type: "text_editor_20250429"
            });
            break;
          case "anthropic.bash_20250124":
            betas.add("computer-use-2025-01-24");
            anthropicTools2.push({
              name: "bash",
              type: "bash_20250124"
            });
            break;
          case "anthropic.bash_20241022":
            betas.add("computer-use-2024-10-22");
            anthropicTools2.push({
              name: "bash",
              type: "bash_20241022"
            });
            break;
          case "anthropic.web_search_20250305": {
            const args = webSearch_20250305ArgsSchema.parse(tool.args);
            anthropicTools2.push({
              type: "web_search_20250305",
              name: "web_search",
              max_uses: args.maxUses,
              allowed_domains: args.allowedDomains,
              blocked_domains: args.blockedDomains,
              user_location: args.userLocation
            });
            break;
          }
          case "anthropic.code_execution_20250522": {
            betas.add("code-execution-2025-05-22");
            anthropicTools2.push({
              type: "code_execution_20250522",
              name: "code_execution"
            });
            break;
          }
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
    return {
      tools: anthropicTools2,
      toolChoice: disableParallelToolUse ? { type: "auto", disable_parallel_tool_use: disableParallelToolUse } : void 0,
      toolWarnings,
      betas
    };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
      return {
        tools: anthropicTools2,
        toolChoice: {
          type: "auto",
          disable_parallel_tool_use: disableParallelToolUse
        },
        toolWarnings,
        betas
      };
    case "required":
      return {
        tools: anthropicTools2,
        toolChoice: {
          type: "any",
          disable_parallel_tool_use: disableParallelToolUse
        },
        toolWarnings,
        betas
      };
    case "none":
      return { tools: void 0, toolChoice: void 0, toolWarnings, betas };
    case "tool":
      return {
        tools: anthropicTools2,
        toolChoice: {
          type: "tool",
          name: toolChoice.toolName,
          disable_parallel_tool_use: disableParallelToolUse
        },
        toolWarnings,
        betas
      };
    default: {
      const _exhaustiveCheck = type;
      throw new import_provider.UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/convert-to-anthropic-messages-prompt.ts
var import_provider2 = require("@ai-sdk/provider");
var import_provider_utils4 = require("@ai-sdk/provider-utils");

// src/tool/code-execution_20250522.ts
var import_provider_utils3 = require("@ai-sdk/provider-utils");
var import_v44 = require("zod/v4");
var codeExecution_20250522OutputSchema = import_v44.z.object({
  type: import_v44.z.literal("code_execution_result"),
  stdout: import_v44.z.string(),
  stderr: import_v44.z.string(),
  return_code: import_v44.z.number()
});
var factory2 = (0, import_provider_utils3.createProviderDefinedToolFactoryWithOutputSchema)({
  id: "anthropic.code_execution_20250522",
  name: "code_execution",
  inputSchema: import_v44.z.object({
    code: import_v44.z.string()
  }),
  outputSchema: codeExecution_20250522OutputSchema
});
var codeExecution_20250522 = (args = {}) => {
  return factory2(args);
};

// src/convert-to-anthropic-messages-prompt.ts
function convertToString(data) {
  if (typeof data === "string") {
    return Buffer.from(data, "base64").toString("utf-8");
  }
  if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  }
  if (data instanceof URL) {
    throw new import_provider2.UnsupportedFunctionalityError({
      functionality: "URL-based text documents are not supported for citations"
    });
  }
  throw new import_provider2.UnsupportedFunctionalityError({
    functionality: `unsupported data type for text documents: ${typeof data}`
  });
}
async function convertToAnthropicMessagesPrompt({
  prompt,
  sendReasoning,
  warnings
}) {
  var _a, _b, _c, _d, _e;
  const betas = /* @__PURE__ */ new Set();
  const blocks = groupIntoBlocks(prompt);
  let system = void 0;
  const messages = [];
  async function shouldEnableCitations(providerMetadata) {
    var _a2, _b2;
    const anthropicOptions = await (0, import_provider_utils4.parseProviderOptions)({
      provider: "anthropic",
      providerOptions: providerMetadata,
      schema: anthropicFilePartProviderOptions
    });
    return (_b2 = (_a2 = anthropicOptions == null ? void 0 : anthropicOptions.citations) == null ? void 0 : _a2.enabled) != null ? _b2 : false;
  }
  async function getDocumentMetadata(providerMetadata) {
    const anthropicOptions = await (0, import_provider_utils4.parseProviderOptions)({
      provider: "anthropic",
      providerOptions: providerMetadata,
      schema: anthropicFilePartProviderOptions
    });
    return {
      title: anthropicOptions == null ? void 0 : anthropicOptions.title,
      context: anthropicOptions == null ? void 0 : anthropicOptions.context
    };
  }
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isLastBlock = i === blocks.length - 1;
    const type = block.type;
    switch (type) {
      case "system": {
        if (system != null) {
          throw new import_provider2.UnsupportedFunctionalityError({
            functionality: "Multiple system messages that are separated by user/assistant messages"
          });
        }
        system = block.messages.map(({ content, providerOptions }) => ({
          type: "text",
          text: content,
          cache_control: getCacheControl(providerOptions)
        }));
        break;
      }
      case "user": {
        const anthropicContent = [];
        for (const message of block.messages) {
          const { role, content } = message;
          switch (role) {
            case "user": {
              for (let j = 0; j < content.length; j++) {
                const part = content[j];
                const isLastPart = j === content.length - 1;
                const cacheControl = (_a = getCacheControl(part.providerOptions)) != null ? _a : isLastPart ? getCacheControl(message.providerOptions) : void 0;
                switch (part.type) {
                  case "text": {
                    anthropicContent.push({
                      type: "text",
                      text: part.text,
                      cache_control: cacheControl
                    });
                    break;
                  }
                  case "file": {
                    if (part.mediaType.startsWith("image/")) {
                      anthropicContent.push({
                        type: "image",
                        source: part.data instanceof URL ? {
                          type: "url",
                          url: part.data.toString()
                        } : {
                          type: "base64",
                          media_type: part.mediaType === "image/*" ? "image/jpeg" : part.mediaType,
                          data: (0, import_provider_utils4.convertToBase64)(part.data)
                        },
                        cache_control: cacheControl
                      });
                    } else if (part.mediaType === "application/pdf") {
                      betas.add("pdfs-2024-09-25");
                      const enableCitations = await shouldEnableCitations(
                        part.providerOptions
                      );
                      const metadata = await getDocumentMetadata(
                        part.providerOptions
                      );
                      anthropicContent.push({
                        type: "document",
                        source: part.data instanceof URL ? {
                          type: "url",
                          url: part.data.toString()
                        } : {
                          type: "base64",
                          media_type: "application/pdf",
                          data: (0, import_provider_utils4.convertToBase64)(part.data)
                        },
                        title: (_b = metadata.title) != null ? _b : part.filename,
                        ...metadata.context && { context: metadata.context },
                        ...enableCitations && {
                          citations: { enabled: true }
                        },
                        cache_control: cacheControl
                      });
                    } else if (part.mediaType === "text/plain") {
                      const enableCitations = await shouldEnableCitations(
                        part.providerOptions
                      );
                      const metadata = await getDocumentMetadata(
                        part.providerOptions
                      );
                      anthropicContent.push({
                        type: "document",
                        source: part.data instanceof URL ? {
                          type: "url",
                          url: part.data.toString()
                        } : {
                          type: "text",
                          media_type: "text/plain",
                          data: convertToString(part.data)
                        },
                        title: (_c = metadata.title) != null ? _c : part.filename,
                        ...metadata.context && { context: metadata.context },
                        ...enableCitations && {
                          citations: { enabled: true }
                        },
                        cache_control: cacheControl
                      });
                    } else {
                      throw new import_provider2.UnsupportedFunctionalityError({
                        functionality: `media type: ${part.mediaType}`
                      });
                    }
                    break;
                  }
                }
              }
              break;
            }
            case "tool": {
              for (let i2 = 0; i2 < content.length; i2++) {
                const part = content[i2];
                const isLastPart = i2 === content.length - 1;
                const cacheControl = (_d = getCacheControl(part.providerOptions)) != null ? _d : isLastPart ? getCacheControl(message.providerOptions) : void 0;
                const output = part.output;
                let contentValue;
                switch (output.type) {
                  case "content":
                    contentValue = output.value.map((contentPart) => {
                      switch (contentPart.type) {
                        case "text":
                          return {
                            type: "text",
                            text: contentPart.text,
                            cache_control: void 0
                          };
                        case "media": {
                          if (contentPart.mediaType.startsWith("image/")) {
                            return {
                              type: "image",
                              source: {
                                type: "base64",
                                media_type: contentPart.mediaType,
                                data: contentPart.data
                              },
                              cache_control: void 0
                            };
                          }
                          throw new import_provider2.UnsupportedFunctionalityError({
                            functionality: `media type: ${contentPart.mediaType}`
                          });
                        }
                      }
                    });
                    break;
                  case "text":
                  case "error-text":
                    contentValue = output.value;
                    break;
                  case "json":
                  case "error-json":
                  default:
                    contentValue = JSON.stringify(output.value);
                    break;
                }
                anthropicContent.push({
                  type: "tool_result",
                  tool_use_id: part.toolCallId,
                  content: contentValue,
                  is_error: output.type === "error-text" || output.type === "error-json" ? true : void 0,
                  cache_control: cacheControl
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
        messages.push({ role: "user", content: anthropicContent });
        break;
      }
      case "assistant": {
        const anthropicContent = [];
        for (let j = 0; j < block.messages.length; j++) {
          const message = block.messages[j];
          const isLastMessage = j === block.messages.length - 1;
          const { content } = message;
          for (let k = 0; k < content.length; k++) {
            const part = content[k];
            const isLastContentPart = k === content.length - 1;
            const cacheControl = (_e = getCacheControl(part.providerOptions)) != null ? _e : isLastContentPart ? getCacheControl(message.providerOptions) : void 0;
            switch (part.type) {
              case "text": {
                anthropicContent.push({
                  type: "text",
                  text: (
                    // trim the last text part if it's the last message in the block
                    // because Anthropic does not allow trailing whitespace
                    // in pre-filled assistant responses
                    isLastBlock && isLastMessage && isLastContentPart ? part.text.trim() : part.text
                  ),
                  cache_control: cacheControl
                });
                break;
              }
              case "reasoning": {
                if (sendReasoning) {
                  const reasoningMetadata = await (0, import_provider_utils4.parseProviderOptions)({
                    provider: "anthropic",
                    providerOptions: part.providerOptions,
                    schema: anthropicReasoningMetadataSchema
                  });
                  if (reasoningMetadata != null) {
                    if (reasoningMetadata.signature != null) {
                      anthropicContent.push({
                        type: "thinking",
                        thinking: part.text,
                        signature: reasoningMetadata.signature,
                        cache_control: cacheControl
                      });
                    } else if (reasoningMetadata.redactedData != null) {
                      anthropicContent.push({
                        type: "redacted_thinking",
                        data: reasoningMetadata.redactedData,
                        cache_control: cacheControl
                      });
                    } else {
                      warnings.push({
                        type: "other",
                        message: "unsupported reasoning metadata"
                      });
                    }
                  } else {
                    warnings.push({
                      type: "other",
                      message: "unsupported reasoning metadata"
                    });
                  }
                } else {
                  warnings.push({
                    type: "other",
                    message: "sending reasoning content is disabled for this model"
                  });
                }
                break;
              }
              case "tool-call": {
                if (part.providerExecuted) {
                  if (part.toolName === "web_search") {
                    anthropicContent.push({
                      type: "server_tool_use",
                      id: part.toolCallId,
                      name: "web_search",
                      input: part.input,
                      cache_control: cacheControl
                    });
                    break;
                  }
                  if (part.toolName === "code_execution") {
                    anthropicContent.push({
                      type: "server_tool_use",
                      id: part.toolCallId,
                      name: "code_execution",
                      input: part.input,
                      cache_control: cacheControl
                    });
                    break;
                  }
                  warnings.push({
                    type: "other",
                    message: `provider executed tool call for tool ${part.toolName} is not supported`
                  });
                  break;
                }
                anthropicContent.push({
                  type: "tool_use",
                  id: part.toolCallId,
                  name: part.toolName,
                  input: part.input,
                  cache_control: cacheControl
                });
                break;
              }
              case "tool-result": {
                if (part.toolName === "web_search") {
                  const output = part.output;
                  if (output.type !== "json") {
                    warnings.push({
                      type: "other",
                      message: `provider executed tool result output type ${output.type} for tool ${part.toolName} is not supported`
                    });
                    break;
                  }
                  const webSearchOutput = webSearch_20250305OutputSchema.parse(
                    output.value
                  );
                  anthropicContent.push({
                    type: "web_search_tool_result",
                    tool_use_id: part.toolCallId,
                    content: webSearchOutput.map((result) => ({
                      url: result.url,
                      title: result.title,
                      page_age: result.pageAge,
                      encrypted_content: result.encryptedContent,
                      type: result.type
                    })),
                    cache_control: cacheControl
                  });
                  break;
                }
                if (part.toolName === "code_execution") {
                  const output = part.output;
                  if (output.type !== "json") {
                    warnings.push({
                      type: "other",
                      message: `provider executed tool result output type ${output.type} for tool ${part.toolName} is not supported`
                    });
                    break;
                  }
                  const codeExecutionOutput = codeExecution_20250522OutputSchema.parse(output.value);
                  anthropicContent.push({
                    type: "code_execution_tool_result",
                    tool_use_id: part.toolCallId,
                    content: {
                      type: codeExecutionOutput.type,
                      stdout: codeExecutionOutput.stdout,
                      stderr: codeExecutionOutput.stderr,
                      return_code: codeExecutionOutput.return_code
                    },
                    cache_control: cacheControl
                  });
                  break;
                }
                warnings.push({
                  type: "other",
                  message: `provider executed tool result for tool ${part.toolName} is not supported`
                });
                break;
              }
            }
          }
        }
        messages.push({ role: "assistant", content: anthropicContent });
        break;
      }
      default: {
        const _exhaustiveCheck = type;
        throw new Error(`content type: ${_exhaustiveCheck}`);
      }
    }
  }
  return {
    prompt: { system, messages },
    betas
  };
}
function groupIntoBlocks(prompt) {
  const blocks = [];
  let currentBlock = void 0;
  for (const message of prompt) {
    const { role } = message;
    switch (role) {
      case "system": {
        if ((currentBlock == null ? void 0 : currentBlock.type) !== "system") {
          currentBlock = { type: "system", messages: [] };
          blocks.push(currentBlock);
        }
        currentBlock.messages.push(message);
        break;
      }
      case "assistant": {
        if ((currentBlock == null ? void 0 : currentBlock.type) !== "assistant") {
          currentBlock = { type: "assistant", messages: [] };
          blocks.push(currentBlock);
        }
        currentBlock.messages.push(message);
        break;
      }
      case "user": {
        if ((currentBlock == null ? void 0 : currentBlock.type) !== "user") {
          currentBlock = { type: "user", messages: [] };
          blocks.push(currentBlock);
        }
        currentBlock.messages.push(message);
        break;
      }
      case "tool": {
        if ((currentBlock == null ? void 0 : currentBlock.type) !== "user") {
          currentBlock = { type: "user", messages: [] };
          blocks.push(currentBlock);
        }
        currentBlock.messages.push(message);
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  return blocks;
}

// src/map-anthropic-stop-reason.ts
function mapAnthropicStopReason({
  finishReason,
  isJsonResponseFromTool
}) {
  switch (finishReason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return isJsonResponseFromTool ? "stop" : "tool-calls";
    case "max_tokens":
      return "length";
    default:
      return "unknown";
  }
}

// src/anthropic-messages-language-model.ts
var citationSchemas = {
  webSearchResult: import_v45.z.object({
    type: import_v45.z.literal("web_search_result_location"),
    cited_text: import_v45.z.string(),
    url: import_v45.z.string(),
    title: import_v45.z.string(),
    encrypted_index: import_v45.z.string()
  }),
  pageLocation: import_v45.z.object({
    type: import_v45.z.literal("page_location"),
    cited_text: import_v45.z.string(),
    document_index: import_v45.z.number(),
    document_title: import_v45.z.string().nullable(),
    start_page_number: import_v45.z.number(),
    end_page_number: import_v45.z.number()
  }),
  charLocation: import_v45.z.object({
    type: import_v45.z.literal("char_location"),
    cited_text: import_v45.z.string(),
    document_index: import_v45.z.number(),
    document_title: import_v45.z.string().nullable(),
    start_char_index: import_v45.z.number(),
    end_char_index: import_v45.z.number()
  })
};
var citationSchema = import_v45.z.discriminatedUnion("type", [
  citationSchemas.webSearchResult,
  citationSchemas.pageLocation,
  citationSchemas.charLocation
]);
var documentCitationSchema = import_v45.z.discriminatedUnion("type", [
  citationSchemas.pageLocation,
  citationSchemas.charLocation
]);
function processCitation(citation, citationDocuments, generateId2, onSource) {
  if (citation.type === "page_location" || citation.type === "char_location") {
    const source = createCitationSource(
      citation,
      citationDocuments,
      generateId2
    );
    if (source) {
      onSource(source);
    }
  }
}
function createCitationSource(citation, citationDocuments, generateId2) {
  var _a;
  const documentInfo = citationDocuments[citation.document_index];
  if (!documentInfo) {
    return null;
  }
  const providerMetadata = citation.type === "page_location" ? {
    citedText: citation.cited_text,
    startPageNumber: citation.start_page_number,
    endPageNumber: citation.end_page_number
  } : {
    citedText: citation.cited_text,
    startCharIndex: citation.start_char_index,
    endCharIndex: citation.end_char_index
  };
  return {
    type: "source",
    sourceType: "document",
    id: generateId2(),
    mediaType: documentInfo.mediaType,
    title: (_a = citation.document_title) != null ? _a : documentInfo.title,
    filename: documentInfo.filename,
    providerMetadata: {
      anthropic: providerMetadata
    }
  };
}
var AnthropicMessagesLanguageModel = class {
  constructor(modelId, config) {
    this.specificationVersion = "v2";
    var _a;
    this.modelId = modelId;
    this.config = config;
    this.generateId = (_a = config.generateId) != null ? _a : import_provider_utils5.generateId;
  }
  supportsUrl(url) {
    return url.protocol === "https:";
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
    maxOutputTokens = 4096,
    // 4096: max model output tokens TODO update default in v5
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
    var _a, _b, _c;
    const warnings = [];
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
    if (seed != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "seed"
      });
    }
    if ((responseFormat == null ? void 0 : responseFormat.type) === "json") {
      if (responseFormat.schema == null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "responseFormat",
          details: "JSON response format requires a schema. The response format is ignored."
        });
      } else if (tools != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "tools",
          details: "JSON response format does not support tools. The provided tools are ignored."
        });
      }
    }
    const jsonResponseTool = (responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null ? {
      type: "function",
      name: "json",
      description: "Respond with a JSON object.",
      inputSchema: responseFormat.schema
    } : void 0;
    const anthropicOptions = await (0, import_provider_utils5.parseProviderOptions)({
      provider: "anthropic",
      providerOptions,
      schema: anthropicProviderOptions
    });
    const { prompt: messagesPrompt, betas: messagesBetas } = await convertToAnthropicMessagesPrompt({
      prompt,
      sendReasoning: (_a = anthropicOptions == null ? void 0 : anthropicOptions.sendReasoning) != null ? _a : true,
      warnings
    });
    const isThinking = ((_b = anthropicOptions == null ? void 0 : anthropicOptions.thinking) == null ? void 0 : _b.type) === "enabled";
    const thinkingBudget = (_c = anthropicOptions == null ? void 0 : anthropicOptions.thinking) == null ? void 0 : _c.budgetTokens;
    const baseArgs = {
      // model id:
      model: this.modelId,
      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_k: topK,
      top_p: topP,
      stop_sequences: stopSequences,
      // provider specific settings:
      ...isThinking && {
        thinking: { type: "enabled", budget_tokens: thinkingBudget }
      },
      // prompt:
      system: messagesPrompt.system,
      messages: messagesPrompt.messages
    };
    if (isThinking) {
      if (thinkingBudget == null) {
        throw new import_provider3.UnsupportedFunctionalityError({
          functionality: "thinking requires a budget"
        });
      }
      if (baseArgs.temperature != null) {
        baseArgs.temperature = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "temperature",
          details: "temperature is not supported when thinking is enabled"
        });
      }
      if (topK != null) {
        baseArgs.top_k = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "topK",
          details: "topK is not supported when thinking is enabled"
        });
      }
      if (topP != null) {
        baseArgs.top_p = void 0;
        warnings.push({
          type: "unsupported-setting",
          setting: "topP",
          details: "topP is not supported when thinking is enabled"
        });
      }
      baseArgs.max_tokens = maxOutputTokens + thinkingBudget;
    }
    const {
      tools: anthropicTools2,
      toolChoice: anthropicToolChoice,
      toolWarnings,
      betas: toolsBetas
    } = prepareTools(
      jsonResponseTool != null ? {
        tools: [jsonResponseTool],
        toolChoice: { type: "tool", toolName: jsonResponseTool.name },
        disableParallelToolUse: anthropicOptions == null ? void 0 : anthropicOptions.disableParallelToolUse
      } : {
        tools: tools != null ? tools : [],
        toolChoice,
        disableParallelToolUse: anthropicOptions == null ? void 0 : anthropicOptions.disableParallelToolUse
      }
    );
    return {
      args: {
        ...baseArgs,
        tools: anthropicTools2,
        tool_choice: anthropicToolChoice
      },
      warnings: [...warnings, ...toolWarnings],
      betas: /* @__PURE__ */ new Set([...messagesBetas, ...toolsBetas]),
      usesJsonResponseTool: jsonResponseTool != null
    };
  }
  async getHeaders({
    betas,
    headers
  }) {
    return (0, import_provider_utils5.combineHeaders)(
      await (0, import_provider_utils5.resolve)(this.config.headers),
      betas.size > 0 ? { "anthropic-beta": Array.from(betas).join(",") } : {},
      headers
    );
  }
  buildRequestUrl(isStreaming) {
    var _a, _b, _c;
    return (_c = (_b = (_a = this.config).buildRequestUrl) == null ? void 0 : _b.call(_a, this.config.baseURL, isStreaming)) != null ? _c : `${this.config.baseURL}/messages`;
  }
  transformRequestBody(args) {
    var _a, _b, _c;
    return (_c = (_b = (_a = this.config).transformRequestBody) == null ? void 0 : _b.call(_a, args)) != null ? _c : args;
  }
  extractCitationDocuments(prompt) {
    const isCitationPart = (part) => {
      var _a, _b;
      if (part.type !== "file") {
        return false;
      }
      if (part.mediaType !== "application/pdf" && part.mediaType !== "text/plain") {
        return false;
      }
      const anthropic = (_a = part.providerOptions) == null ? void 0 : _a.anthropic;
      const citationsConfig = anthropic == null ? void 0 : anthropic.citations;
      return (_b = citationsConfig == null ? void 0 : citationsConfig.enabled) != null ? _b : false;
    };
    return prompt.filter((message) => message.role === "user").flatMap((message) => message.content).filter(isCitationPart).map((part) => {
      var _a;
      const filePart = part;
      return {
        title: (_a = filePart.filename) != null ? _a : "Untitled Document",
        filename: filePart.filename,
        mediaType: filePart.mediaType
      };
    });
  }
  async doGenerate(options) {
    var _a, _b, _c, _d, _e;
    const { args, warnings, betas, usesJsonResponseTool } = await this.getArgs(options);
    const citationDocuments = this.extractCitationDocuments(options.prompt);
    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse
    } = await (0, import_provider_utils5.postJsonToApi)({
      url: this.buildRequestUrl(false),
      headers: await this.getHeaders({ betas, headers: options.headers }),
      body: this.transformRequestBody(args),
      failedResponseHandler: anthropicFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils5.createJsonResponseHandler)(
        anthropicMessagesResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const content = [];
    for (const part of response.content) {
      switch (part.type) {
        case "text": {
          if (!usesJsonResponseTool) {
            content.push({ type: "text", text: part.text });
            if (part.citations) {
              for (const citation of part.citations) {
                processCitation(
                  citation,
                  citationDocuments,
                  this.generateId,
                  (source) => content.push(source)
                );
              }
            }
          }
          break;
        }
        case "thinking": {
          content.push({
            type: "reasoning",
            text: part.thinking,
            providerMetadata: {
              anthropic: {
                signature: part.signature
              }
            }
          });
          break;
        }
        case "redacted_thinking": {
          content.push({
            type: "reasoning",
            text: "",
            providerMetadata: {
              anthropic: {
                redactedData: part.data
              }
            }
          });
          break;
        }
        case "tool_use": {
          content.push(
            // when a json response tool is used, the tool call becomes the text:
            usesJsonResponseTool ? {
              type: "text",
              text: JSON.stringify(part.input)
            } : {
              type: "tool-call",
              toolCallId: part.id,
              toolName: part.name,
              input: JSON.stringify(part.input)
            }
          );
          break;
        }
        case "server_tool_use": {
          if (part.name === "web_search" || part.name === "code_execution") {
            content.push({
              type: "tool-call",
              toolCallId: part.id,
              toolName: part.name,
              input: JSON.stringify(part.input),
              providerExecuted: true
            });
          }
          break;
        }
        case "web_search_tool_result": {
          if (Array.isArray(part.content)) {
            content.push({
              type: "tool-result",
              toolCallId: part.tool_use_id,
              toolName: "web_search",
              result: part.content.map((result) => {
                var _a2;
                return {
                  url: result.url,
                  title: result.title,
                  pageAge: (_a2 = result.page_age) != null ? _a2 : null,
                  encryptedContent: result.encrypted_content,
                  type: result.type
                };
              }),
              providerExecuted: true
            });
            for (const result of part.content) {
              content.push({
                type: "source",
                sourceType: "url",
                id: this.generateId(),
                url: result.url,
                title: result.title,
                providerMetadata: {
                  anthropic: {
                    pageAge: (_a = result.page_age) != null ? _a : null
                  }
                }
              });
            }
          } else {
            content.push({
              type: "tool-result",
              toolCallId: part.tool_use_id,
              toolName: "web_search",
              isError: true,
              result: {
                type: "web_search_tool_result_error",
                errorCode: part.content.error_code
              },
              providerExecuted: true
            });
          }
          break;
        }
        case "code_execution_tool_result": {
          if (part.content.type === "code_execution_result") {
            content.push({
              type: "tool-result",
              toolCallId: part.tool_use_id,
              toolName: "code_execution",
              result: {
                type: part.content.type,
                stdout: part.content.stdout,
                stderr: part.content.stderr,
                return_code: part.content.return_code
              },
              providerExecuted: true
            });
          } else if (part.content.type === "code_execution_tool_result_error") {
            content.push({
              type: "tool-result",
              toolCallId: part.tool_use_id,
              toolName: "code_execution",
              isError: true,
              result: {
                type: "code_execution_tool_result_error",
                errorCode: part.content.error_code
              },
              providerExecuted: true
            });
          }
          break;
        }
      }
    }
    return {
      content,
      finishReason: mapAnthropicStopReason({
        finishReason: response.stop_reason,
        isJsonResponseFromTool: usesJsonResponseTool
      }),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        cachedInputTokens: (_b = response.usage.cache_read_input_tokens) != null ? _b : void 0
      },
      request: { body: args },
      response: {
        id: (_c = response.id) != null ? _c : void 0,
        modelId: (_d = response.model) != null ? _d : void 0,
        headers: responseHeaders,
        body: rawResponse
      },
      warnings,
      providerMetadata: {
        anthropic: {
          usage: response.usage,
          cacheCreationInputTokens: (_e = response.usage.cache_creation_input_tokens) != null ? _e : null
        }
      }
    };
  }
  async doStream(options) {
    const { args, warnings, betas, usesJsonResponseTool } = await this.getArgs(options);
    const citationDocuments = this.extractCitationDocuments(options.prompt);
    const body = { ...args, stream: true };
    const { responseHeaders, value: response } = await (0, import_provider_utils5.postJsonToApi)({
      url: this.buildRequestUrl(true),
      headers: await this.getHeaders({ betas, headers: options.headers }),
      body: this.transformRequestBody(body),
      failedResponseHandler: anthropicFailedResponseHandler,
      successfulResponseHandler: (0, import_provider_utils5.createEventSourceResponseHandler)(
        anthropicMessagesChunkSchema
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
    const contentBlocks = {};
    let providerMetadata = void 0;
    let blockType = void 0;
    const generateId2 = this.generateId;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings });
          },
          transform(chunk, controller) {
            var _a, _b, _c, _d, _e, _f, _g;
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
            }
            if (!chunk.success) {
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            switch (value.type) {
              case "ping": {
                return;
              }
              case "content_block_start": {
                const contentBlockType = value.content_block.type;
                blockType = contentBlockType;
                switch (contentBlockType) {
                  case "text": {
                    contentBlocks[value.index] = { type: "text" };
                    controller.enqueue({
                      type: "text-start",
                      id: String(value.index)
                    });
                    return;
                  }
                  case "thinking": {
                    contentBlocks[value.index] = { type: "reasoning" };
                    controller.enqueue({
                      type: "reasoning-start",
                      id: String(value.index)
                    });
                    return;
                  }
                  case "redacted_thinking": {
                    contentBlocks[value.index] = { type: "reasoning" };
                    controller.enqueue({
                      type: "reasoning-start",
                      id: String(value.index),
                      providerMetadata: {
                        anthropic: {
                          redactedData: value.content_block.data
                        }
                      }
                    });
                    return;
                  }
                  case "tool_use": {
                    contentBlocks[value.index] = usesJsonResponseTool ? { type: "text" } : {
                      type: "tool-call",
                      toolCallId: value.content_block.id,
                      toolName: value.content_block.name,
                      input: ""
                    };
                    controller.enqueue(
                      usesJsonResponseTool ? { type: "text-start", id: String(value.index) } : {
                        type: "tool-input-start",
                        id: value.content_block.id,
                        toolName: value.content_block.name
                      }
                    );
                    return;
                  }
                  case "server_tool_use": {
                    if (value.content_block.name === "web_search" || value.content_block.name === "code_execution") {
                      contentBlocks[value.index] = {
                        type: "tool-call",
                        toolCallId: value.content_block.id,
                        toolName: value.content_block.name,
                        input: "",
                        providerExecuted: true
                      };
                      controller.enqueue({
                        type: "tool-input-start",
                        id: value.content_block.id,
                        toolName: value.content_block.name,
                        providerExecuted: true
                      });
                    }
                    return;
                  }
                  case "web_search_tool_result": {
                    const part = value.content_block;
                    if (Array.isArray(part.content)) {
                      controller.enqueue({
                        type: "tool-result",
                        toolCallId: part.tool_use_id,
                        toolName: "web_search",
                        result: part.content.map((result) => {
                          var _a2;
                          return {
                            url: result.url,
                            title: result.title,
                            pageAge: (_a2 = result.page_age) != null ? _a2 : null,
                            encryptedContent: result.encrypted_content,
                            type: result.type
                          };
                        }),
                        providerExecuted: true
                      });
                      for (const result of part.content) {
                        controller.enqueue({
                          type: "source",
                          sourceType: "url",
                          id: generateId2(),
                          url: result.url,
                          title: result.title,
                          providerMetadata: {
                            anthropic: {
                              pageAge: (_a = result.page_age) != null ? _a : null
                            }
                          }
                        });
                      }
                    } else {
                      controller.enqueue({
                        type: "tool-result",
                        toolCallId: part.tool_use_id,
                        toolName: "web_search",
                        isError: true,
                        result: {
                          type: "web_search_tool_result_error",
                          errorCode: part.content.error_code
                        },
                        providerExecuted: true
                      });
                    }
                    return;
                  }
                  case "code_execution_tool_result": {
                    const part = value.content_block;
                    if (part.content.type === "code_execution_result") {
                      controller.enqueue({
                        type: "tool-result",
                        toolCallId: part.tool_use_id,
                        toolName: "code_execution",
                        result: {
                          type: part.content.type,
                          stdout: part.content.stdout,
                          stderr: part.content.stderr,
                          return_code: part.content.return_code
                        },
                        providerExecuted: true
                      });
                    } else if (part.content.type === "code_execution_tool_result_error") {
                      controller.enqueue({
                        type: "tool-result",
                        toolCallId: part.tool_use_id,
                        toolName: "code_execution",
                        isError: true,
                        result: {
                          type: "code_execution_tool_result_error",
                          errorCode: part.content.error_code
                        },
                        providerExecuted: true
                      });
                    }
                    return;
                  }
                  default: {
                    const _exhaustiveCheck = contentBlockType;
                    throw new Error(
                      `Unsupported content block type: ${_exhaustiveCheck}`
                    );
                  }
                }
              }
              case "content_block_stop": {
                if (contentBlocks[value.index] != null) {
                  const contentBlock = contentBlocks[value.index];
                  switch (contentBlock.type) {
                    case "text": {
                      controller.enqueue({
                        type: "text-end",
                        id: String(value.index)
                      });
                      break;
                    }
                    case "reasoning": {
                      controller.enqueue({
                        type: "reasoning-end",
                        id: String(value.index)
                      });
                      break;
                    }
                    case "tool-call":
                      if (!usesJsonResponseTool) {
                        controller.enqueue({
                          type: "tool-input-end",
                          id: contentBlock.toolCallId
                        });
                        controller.enqueue(contentBlock);
                      }
                      break;
                  }
                  delete contentBlocks[value.index];
                }
                blockType = void 0;
                return;
              }
              case "content_block_delta": {
                const deltaType = value.delta.type;
                switch (deltaType) {
                  case "text_delta": {
                    if (usesJsonResponseTool) {
                      return;
                    }
                    controller.enqueue({
                      type: "text-delta",
                      id: String(value.index),
                      delta: value.delta.text
                    });
                    return;
                  }
                  case "thinking_delta": {
                    controller.enqueue({
                      type: "reasoning-delta",
                      id: String(value.index),
                      delta: value.delta.thinking
                    });
                    return;
                  }
                  case "signature_delta": {
                    if (blockType === "thinking") {
                      controller.enqueue({
                        type: "reasoning-delta",
                        id: String(value.index),
                        delta: "",
                        providerMetadata: {
                          anthropic: {
                            signature: value.delta.signature
                          }
                        }
                      });
                    }
                    return;
                  }
                  case "input_json_delta": {
                    const contentBlock = contentBlocks[value.index];
                    const delta = value.delta.partial_json;
                    if (usesJsonResponseTool) {
                      if ((contentBlock == null ? void 0 : contentBlock.type) !== "text") {
                        return;
                      }
                      controller.enqueue({
                        type: "text-delta",
                        id: String(value.index),
                        delta
                      });
                    } else {
                      if ((contentBlock == null ? void 0 : contentBlock.type) !== "tool-call") {
                        return;
                      }
                      controller.enqueue({
                        type: "tool-input-delta",
                        id: contentBlock.toolCallId,
                        delta
                      });
                      contentBlock.input += delta;
                    }
                    return;
                  }
                  case "citations_delta": {
                    const citation = value.delta.citation;
                    processCitation(
                      citation,
                      citationDocuments,
                      generateId2,
                      (source) => controller.enqueue(source)
                    );
                    return;
                  }
                  default: {
                    const _exhaustiveCheck = deltaType;
                    throw new Error(
                      `Unsupported delta type: ${_exhaustiveCheck}`
                    );
                  }
                }
              }
              case "message_start": {
                usage.inputTokens = value.message.usage.input_tokens;
                usage.cachedInputTokens = (_b = value.message.usage.cache_read_input_tokens) != null ? _b : void 0;
                providerMetadata = {
                  anthropic: {
                    usage: value.message.usage,
                    cacheCreationInputTokens: (_c = value.message.usage.cache_creation_input_tokens) != null ? _c : null
                  }
                };
                controller.enqueue({
                  type: "response-metadata",
                  id: (_d = value.message.id) != null ? _d : void 0,
                  modelId: (_e = value.message.model) != null ? _e : void 0
                });
                return;
              }
              case "message_delta": {
                usage.outputTokens = value.usage.output_tokens;
                usage.totalTokens = ((_f = usage.inputTokens) != null ? _f : 0) + ((_g = value.usage.output_tokens) != null ? _g : 0);
                finishReason = mapAnthropicStopReason({
                  finishReason: value.delta.stop_reason,
                  isJsonResponseFromTool: usesJsonResponseTool
                });
                return;
              }
              case "message_stop": {
                controller.enqueue({
                  type: "finish",
                  finishReason,
                  usage,
                  providerMetadata
                });
                return;
              }
              case "error": {
                controller.enqueue({ type: "error", error: value.error });
                return;
              }
              default: {
                const _exhaustiveCheck = value;
                throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
              }
            }
          }
        })
      ),
      request: { body },
      response: { headers: responseHeaders }
    };
  }
};
var anthropicMessagesResponseSchema = import_v45.z.object({
  type: import_v45.z.literal("message"),
  id: import_v45.z.string().nullish(),
  model: import_v45.z.string().nullish(),
  content: import_v45.z.array(
    import_v45.z.discriminatedUnion("type", [
      import_v45.z.object({
        type: import_v45.z.literal("text"),
        text: import_v45.z.string(),
        citations: import_v45.z.array(citationSchema).optional()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("thinking"),
        thinking: import_v45.z.string(),
        signature: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("redacted_thinking"),
        data: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("tool_use"),
        id: import_v45.z.string(),
        name: import_v45.z.string(),
        input: import_v45.z.unknown()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("server_tool_use"),
        id: import_v45.z.string(),
        name: import_v45.z.string(),
        input: import_v45.z.record(import_v45.z.string(), import_v45.z.unknown()).nullish()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("web_search_tool_result"),
        tool_use_id: import_v45.z.string(),
        content: import_v45.z.union([
          import_v45.z.array(
            import_v45.z.object({
              type: import_v45.z.literal("web_search_result"),
              url: import_v45.z.string(),
              title: import_v45.z.string(),
              encrypted_content: import_v45.z.string(),
              page_age: import_v45.z.string().nullish()
            })
          ),
          import_v45.z.object({
            type: import_v45.z.literal("web_search_tool_result_error"),
            error_code: import_v45.z.string()
          })
        ])
      }),
      import_v45.z.object({
        type: import_v45.z.literal("code_execution_tool_result"),
        tool_use_id: import_v45.z.string(),
        content: import_v45.z.union([
          import_v45.z.object({
            type: import_v45.z.literal("code_execution_result"),
            stdout: import_v45.z.string(),
            stderr: import_v45.z.string(),
            return_code: import_v45.z.number()
          }),
          import_v45.z.object({
            type: import_v45.z.literal("code_execution_tool_result_error"),
            error_code: import_v45.z.string()
          })
        ])
      })
    ])
  ),
  stop_reason: import_v45.z.string().nullish(),
  usage: import_v45.z.looseObject({
    input_tokens: import_v45.z.number(),
    output_tokens: import_v45.z.number(),
    cache_creation_input_tokens: import_v45.z.number().nullish(),
    cache_read_input_tokens: import_v45.z.number().nullish()
  })
});
var anthropicMessagesChunkSchema = import_v45.z.discriminatedUnion("type", [
  import_v45.z.object({
    type: import_v45.z.literal("message_start"),
    message: import_v45.z.object({
      id: import_v45.z.string().nullish(),
      model: import_v45.z.string().nullish(),
      usage: import_v45.z.looseObject({
        input_tokens: import_v45.z.number(),
        output_tokens: import_v45.z.number(),
        cache_creation_input_tokens: import_v45.z.number().nullish(),
        cache_read_input_tokens: import_v45.z.number().nullish()
      })
    })
  }),
  import_v45.z.object({
    type: import_v45.z.literal("content_block_start"),
    index: import_v45.z.number(),
    content_block: import_v45.z.discriminatedUnion("type", [
      import_v45.z.object({
        type: import_v45.z.literal("text"),
        text: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("thinking"),
        thinking: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("tool_use"),
        id: import_v45.z.string(),
        name: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("redacted_thinking"),
        data: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("server_tool_use"),
        id: import_v45.z.string(),
        name: import_v45.z.string(),
        input: import_v45.z.record(import_v45.z.string(), import_v45.z.unknown()).nullish()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("web_search_tool_result"),
        tool_use_id: import_v45.z.string(),
        content: import_v45.z.union([
          import_v45.z.array(
            import_v45.z.object({
              type: import_v45.z.literal("web_search_result"),
              url: import_v45.z.string(),
              title: import_v45.z.string(),
              encrypted_content: import_v45.z.string(),
              page_age: import_v45.z.string().nullish()
            })
          ),
          import_v45.z.object({
            type: import_v45.z.literal("web_search_tool_result_error"),
            error_code: import_v45.z.string()
          })
        ])
      }),
      import_v45.z.object({
        type: import_v45.z.literal("code_execution_tool_result"),
        tool_use_id: import_v45.z.string(),
        content: import_v45.z.union([
          import_v45.z.object({
            type: import_v45.z.literal("code_execution_result"),
            stdout: import_v45.z.string(),
            stderr: import_v45.z.string(),
            return_code: import_v45.z.number()
          }),
          import_v45.z.object({
            type: import_v45.z.literal("code_execution_tool_result_error"),
            error_code: import_v45.z.string()
          })
        ])
      })
    ])
  }),
  import_v45.z.object({
    type: import_v45.z.literal("content_block_delta"),
    index: import_v45.z.number(),
    delta: import_v45.z.discriminatedUnion("type", [
      import_v45.z.object({
        type: import_v45.z.literal("input_json_delta"),
        partial_json: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("text_delta"),
        text: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("thinking_delta"),
        thinking: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("signature_delta"),
        signature: import_v45.z.string()
      }),
      import_v45.z.object({
        type: import_v45.z.literal("citations_delta"),
        citation: citationSchema
      })
    ])
  }),
  import_v45.z.object({
    type: import_v45.z.literal("content_block_stop"),
    index: import_v45.z.number()
  }),
  import_v45.z.object({
    type: import_v45.z.literal("error"),
    error: import_v45.z.object({
      type: import_v45.z.string(),
      message: import_v45.z.string()
    })
  }),
  import_v45.z.object({
    type: import_v45.z.literal("message_delta"),
    delta: import_v45.z.object({ stop_reason: import_v45.z.string().nullish() }),
    usage: import_v45.z.object({ output_tokens: import_v45.z.number() })
  }),
  import_v45.z.object({
    type: import_v45.z.literal("message_stop")
  }),
  import_v45.z.object({
    type: import_v45.z.literal("ping")
  })
]);
var anthropicReasoningMetadataSchema = import_v45.z.object({
  signature: import_v45.z.string().optional(),
  redactedData: import_v45.z.string().optional()
});

// src/tool/bash_20241022.ts
var import_provider_utils6 = require("@ai-sdk/provider-utils");
var import_v46 = __toESM(require("zod/v4"));
var bash_20241022 = (0, import_provider_utils6.createProviderDefinedToolFactory)({
  id: "anthropic.bash_20241022",
  name: "bash",
  inputSchema: import_v46.default.object({
    command: import_v46.default.string(),
    restart: import_v46.default.boolean().optional()
  })
});

// src/tool/bash_20250124.ts
var import_provider_utils7 = require("@ai-sdk/provider-utils");
var import_v47 = __toESM(require("zod/v4"));
var bash_20250124 = (0, import_provider_utils7.createProviderDefinedToolFactory)({
  id: "anthropic.bash_20250124",
  name: "bash",
  inputSchema: import_v47.default.object({
    command: import_v47.default.string(),
    restart: import_v47.default.boolean().optional()
  })
});

// src/tool/computer_20241022.ts
var import_provider_utils8 = require("@ai-sdk/provider-utils");
var import_v48 = require("zod/v4");
var computer_20241022 = (0, import_provider_utils8.createProviderDefinedToolFactory)({
  id: "anthropic.computer_20241022",
  name: "computer",
  inputSchema: import_v48.z.object({
    action: import_v48.z.enum([
      "key",
      "type",
      "mouse_move",
      "left_click",
      "left_click_drag",
      "right_click",
      "middle_click",
      "double_click",
      "screenshot",
      "cursor_position"
    ]),
    coordinate: import_v48.z.array(import_v48.z.number().int()).optional(),
    text: import_v48.z.string().optional()
  })
});

// src/tool/computer_20250124.ts
var import_provider_utils9 = require("@ai-sdk/provider-utils");
var import_v49 = require("zod/v4");
var computer_20250124 = (0, import_provider_utils9.createProviderDefinedToolFactory)({
  id: "anthropic.computer_20250124",
  name: "computer",
  inputSchema: import_v49.z.object({
    action: import_v49.z.enum([
      "key",
      "hold_key",
      "type",
      "cursor_position",
      "mouse_move",
      "left_mouse_down",
      "left_mouse_up",
      "left_click",
      "left_click_drag",
      "right_click",
      "middle_click",
      "double_click",
      "triple_click",
      "scroll",
      "wait",
      "screenshot"
    ]),
    coordinate: import_v49.z.tuple([import_v49.z.number().int(), import_v49.z.number().int()]).optional(),
    duration: import_v49.z.number().optional(),
    scroll_amount: import_v49.z.number().optional(),
    scroll_direction: import_v49.z.enum(["up", "down", "left", "right"]).optional(),
    start_coordinate: import_v49.z.tuple([import_v49.z.number().int(), import_v49.z.number().int()]).optional(),
    text: import_v49.z.string().optional()
  })
});

// src/tool/text-editor_20241022.ts
var import_provider_utils10 = require("@ai-sdk/provider-utils");
var import_v410 = require("zod/v4");
var textEditor_20241022 = (0, import_provider_utils10.createProviderDefinedToolFactory)({
  id: "anthropic.text_editor_20241022",
  name: "str_replace_editor",
  inputSchema: import_v410.z.object({
    command: import_v410.z.enum(["view", "create", "str_replace", "insert", "undo_edit"]),
    path: import_v410.z.string(),
    file_text: import_v410.z.string().optional(),
    insert_line: import_v410.z.number().int().optional(),
    new_str: import_v410.z.string().optional(),
    old_str: import_v410.z.string().optional(),
    view_range: import_v410.z.array(import_v410.z.number().int()).optional()
  })
});

// src/tool/text-editor_20250124.ts
var import_provider_utils11 = require("@ai-sdk/provider-utils");
var import_v411 = require("zod/v4");
var textEditor_20250124 = (0, import_provider_utils11.createProviderDefinedToolFactory)({
  id: "anthropic.text_editor_20250124",
  name: "str_replace_editor",
  inputSchema: import_v411.z.object({
    command: import_v411.z.enum(["view", "create", "str_replace", "insert", "undo_edit"]),
    path: import_v411.z.string(),
    file_text: import_v411.z.string().optional(),
    insert_line: import_v411.z.number().int().optional(),
    new_str: import_v411.z.string().optional(),
    old_str: import_v411.z.string().optional(),
    view_range: import_v411.z.array(import_v411.z.number().int()).optional()
  })
});

// src/tool/text-editor_20250429.ts
var import_provider_utils12 = require("@ai-sdk/provider-utils");
var import_v412 = require("zod/v4");
var textEditor_20250429 = (0, import_provider_utils12.createProviderDefinedToolFactory)({
  id: "anthropic.text_editor_20250429",
  name: "str_replace_based_edit_tool",
  inputSchema: import_v412.z.object({
    command: import_v412.z.enum(["view", "create", "str_replace", "insert"]),
    path: import_v412.z.string(),
    file_text: import_v412.z.string().optional(),
    insert_line: import_v412.z.number().int().optional(),
    new_str: import_v412.z.string().optional(),
    old_str: import_v412.z.string().optional(),
    view_range: import_v412.z.array(import_v412.z.number().int()).optional()
  })
});

// src/anthropic-tools.ts
var anthropicTools = {
  /**
   * Creates a tool for running a bash command. Must have name "bash".
   *
   * Image results are supported.
   *
   * @param execute - The function to execute the tool. Optional.
   */
  bash_20241022,
  /**
   * Creates a tool for running a bash command. Must have name "bash".
   *
   * Image results are supported.
   *
   * @param execute - The function to execute the tool. Optional.
   */
  bash_20250124,
  /**
   * Creates a tool for editing text. Must have name "str_replace_editor".
   */
  textEditor_20241022,
  /**
   * Creates a tool for editing text. Must have name "str_replace_editor".
   */
  textEditor_20250124,
  /**
   * Creates a tool for editing text. Must have name "str_replace_based_edit_tool".
   * Note: This version does not support the "undo_edit" command.
   */
  textEditor_20250429,
  /**
   * Creates a tool for executing actions on a computer. Must have name "computer".
   *
   * Image results are supported.
   *
   * @param displayWidthPx - The width of the display being controlled by the model in pixels.
   * @param displayHeightPx - The height of the display being controlled by the model in pixels.
   * @param displayNumber - The display number to control (only relevant for X11 environments). If specified, the tool will be provided a display number in the tool definition.
   */
  computer_20241022,
  /**
   * Creates a tool for executing actions on a computer. Must have name "computer".
   *
   * Image results are supported.
   *
   * @param displayWidthPx - The width of the display being controlled by the model in pixels.
   * @param displayHeightPx - The height of the display being controlled by the model in pixels.
   * @param displayNumber - The display number to control (only relevant for X11 environments). If specified, the tool will be provided a display number in the tool definition.
   * @param execute - The function to execute the tool. Optional.
   */
  computer_20250124,
  /**
   * Creates a web search tool that gives Claude direct access to real-time web content.
   * Must have name "web_search".
   *
   * @param maxUses - Maximum number of web searches Claude can perform during the conversation.
   * @param allowedDomains - Optional list of domains that Claude is allowed to search.
   * @param blockedDomains - Optional list of domains that Claude should avoid when searching.
   * @param userLocation - Optional user location information to provide geographically relevant search results.
   */
  webSearch_20250305,
  /**
   * Creates a tool for executing Python code. Must have name "code_execution".
   */
  codeExecution_20250522
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AnthropicMessagesLanguageModel,
  anthropicTools,
  prepareTools
});
//# sourceMappingURL=index.js.map