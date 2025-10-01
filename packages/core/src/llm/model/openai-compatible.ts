import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2CallWarning,
} from '@ai-sdk/provider-v5';
import { resolveModelConfig } from './gateway-resolver.js';
import { parseModelString, getProviderConfig } from './provider-registry.generated.js';
import type { ModelRouterModelId } from './provider-registry.generated.js';
import type { OpenAICompatibleConfig } from './shared.types';

// Helper function to resolve API key from environment
function resolveApiKey({ provider, apiKey }: { provider?: string; apiKey?: string }): string | undefined {
  if (apiKey) return apiKey;

  if (provider) {
    const config = getProviderConfig(provider);
    if (config?.apiKeyEnvVar) {
      return process.env[config.apiKeyEnvVar];
    }
  }

  return undefined;
}

// TODO: get these types from openai
interface OpenAIStreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenAICompatibleModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly supportsStructuredOutputs = true;
  readonly supportsImageUrls = true;
  readonly supportedUrls = {} as Record<string, RegExp[]>;

  readonly modelId: string;
  readonly provider: string;

  private config: OpenAICompatibleConfig;
  private fullModelId: string; // Store the full model ID for gateway resolution

  constructor(config: ModelRouterModelId | OpenAICompatibleConfig) {
    // Parse configuration
    let parsedConfig: OpenAICompatibleConfig;

    if (typeof config === 'string') {
      // First check if it's a valid URL
      let isUrl = false;
      try {
        new URL(config);
        isUrl = true;
      } catch {
        // Not a URL, continue with provider parsing
      }

      if (isUrl) {
        // If it's a direct URL - use as-is
        parsedConfig = {
          id: 'unknown',
          url: config,
        };
        this.provider = 'openai-compatible';
        this.fullModelId = 'unknown';
        this.config = { id: 'unknown', url: config };
      } else {
        // Handle magic strings like "openai/gpt-4o" or "netlify/openai/gpt-4o"
        this.fullModelId = config;
        const firstSlashIndex = config.indexOf('/');

        if (firstSlashIndex !== -1) {
          const provider = config.substring(0, firstSlashIndex);
          const modelId = config.substring(firstSlashIndex + 1);

          parsedConfig = {
            id: modelId,
            apiKey: resolveApiKey({ provider }),
          };
          this.provider = provider;
        } else {
          // No slash at all, treat as direct model ID
          throw new Error(`Invalid model string: "${config}". Use "provider/model" format or a direct URL.`);
        }
      }
    } else {
      // Handle config object
      parsedConfig = config;
      this.fullModelId = config.id;

      // Extract provider from id if present
      const parsed = parseModelString(config.id);
      this.provider = parsed.provider || 'openai-compatible';

      if (parsed.provider && parsed.modelId !== config.id) {
        parsedConfig.id = parsed.modelId;
      }

      // Resolve API key if not provided
      if (!parsedConfig.apiKey) {
        parsedConfig.apiKey = resolveApiKey({ provider: parsed.provider || undefined });
      }
    }

    // Store the configuration
    this.modelId = parsedConfig.id;
    this.config = parsedConfig;
  }

  private convertMessagesToOpenAI(messages: LanguageModelV2CallOptions['prompt']): any[] {
    return messages
      .map(msg => {
        if (msg.role === 'system') {
          return {
            role: 'system',
            content: msg.content,
          };
        }

        if (msg.role === 'user') {
          // Handle content parts
          const contentParts = msg.content
            .map(part => {
              if (part.type === 'text') {
                return { type: 'text', text: part.text };
              }
              // Note: v2 uses 'file' type with image property
              if (part.type === 'file') {
                return {
                  type: 'image_url',
                  image_url: { url: part.data },
                };
              }
              return null;
            })
            .filter(Boolean);

          // If only text parts, flatten to string
          if (contentParts.every(p => p?.type === 'text')) {
            return {
              role: 'user',
              content: contentParts.map(p => p?.text || '').join(''),
            };
          }

          return {
            role: 'user',
            content: contentParts,
          };
        }

        if (msg.role === 'assistant') {
          const textContent = msg.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('');

          const toolCalls = msg.content
            .filter(part => part.type === 'tool-call')
            .map(part => ({
              id: part.toolCallId,
              type: 'function',
              function: {
                name: part.toolName,
                arguments: JSON.stringify(part.input || {}),
              },
            }));

          return {
            role: 'assistant',
            content: textContent || null,
            ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
          };
        }

        if (msg.role === 'tool') {
          return msg.content.map(toolResponse => ({
            role: 'tool',
            tool_call_id: toolResponse.toolCallId,
            content: JSON.stringify(toolResponse.output),
          }));
        }

        return msg;
      })
      .flat();
  }

  private convertToolsToOpenAI(tools: LanguageModelV2CallOptions['tools']): any[] | undefined {
    if (!tools || Object.keys(tools).length === 0) return undefined;

    return Object.entries(tools).map(([name, tool]) => {
      if (tool.type === 'function') {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || {},
          },
        };
      }
      // For provider-defined tools, use minimal definition
      return {
        type: 'function',
        function: {
          name,
          description: `Provider tool: ${name}`,
          parameters: {},
        },
      };
    });
  }

  private mapFinishReason(reason: string | null): LanguageModelV2FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
      case 'max_tokens':
        return 'length';
      case 'tool_calls':
      case 'function_call':
        return 'tool-calls';
      case 'content_filter':
        return 'content-filter';
      default:
        return 'unknown';
    }
  }

  /**
   * Resolve URL and headers for the request
   * This is called fresh for each request to ensure we get the latest values
   * (e.g., Netlify tokens can expire and need to be refreshed)
   */
  private async resolveRequestConfig(): Promise<{ url: string; headers: Record<string, string>; modelId: string }> {
    // If they provide a url as a string or in the config object, we shouldn't use our gateway classes
    const shouldUseGateway = !this.config.url;

    if (shouldUseGateway) {
      // Use gateway resolution - always get fresh values
      const { url, headers, resolvedModelId } = await resolveModelConfig(this.fullModelId);

      if (url === false) {
        throw new Error(`No gateway can handle model: ${this.fullModelId}`);
      }

      // Merge headers with custom headers
      const finalHeaders = {
        'Content-Type': 'application/json',
        ...headers,
        ...this.config.headers,
      };

      return { url, headers: finalHeaders, modelId: resolvedModelId };
    } else {
      // Use static configuration
      if (!this.config.url) {
        throw new Error('URL is required for OpenAI-compatible model');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers,
      };

      // Add auth header if API key is available
      if (this.config.apiKey) {
        // Check if we need a special header format
        const providerConfig = this.provider !== 'openai-compatible' ? getProviderConfig(this.provider) : undefined;
        if (providerConfig?.apiKeyHeader === 'x-api-key') {
          headers['x-api-key'] = this.config.apiKey;
        } else {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
      }

      return { url: this.config.url, headers, modelId: this.modelId };
    }
  }

  private validateApiKey(): void {
    // Skip validation for models that will use gateway resolution
    // Gateway handles auth through its own mechanism (e.g., Netlify uses site ID + token)
    const willUseGateway = !this.config.url;
    if (willUseGateway) {
      return;
    }

    // Check if API key is required and missing
    if (!this.config.apiKey && this.provider !== 'openai-compatible') {
      // Get the provider config to find the env var name
      const providerConfig = getProviderConfig(this.provider);
      if (providerConfig?.apiKeyEnvVar) {
        throw new Error(
          `API key not found for provider "${this.provider}". Please set the ${providerConfig.apiKeyEnvVar} environment variable.`,
        );
      } else {
        throw new Error(
          `API key not found for provider "${this.provider}". Please provide an API key in the configuration.`,
        );
      }
    }
  }

  async doGenerate(): Promise<never> {
    throw new Error(
      'doGenerate is not supported by OpenAICompatibleModel. ' +
        'Mastra only uses streaming (doStream) for all LLM calls.',
    );
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    request?: { body: string };
    response?: { headers: Record<string, string> };
    warnings: LanguageModelV2CallWarning[];
  }> {
    try {
      // Validate API key and return error stream if validation fails
      this.validateApiKey();
    } catch (error) {
      // Return an error stream instead of throwing
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'error',
              error: error instanceof Error ? error.message : String(error),
            } as LanguageModelV2StreamPart);
          },
        }),
        warnings: [],
      };
    }

    // Resolve URL and headers
    const { url, headers, modelId: resolvedModelId } = await this.resolveRequestConfig();

    const { prompt, tools, toolChoice, providerOptions } = options;

    // TODO: real body type, not any
    const body: any = {
      messages: this.convertMessagesToOpenAI(prompt),
      model: resolvedModelId,
      stream: true,
      ...providerOptions,
    };

    const openAITools = this.convertToolsToOpenAI(tools);
    if (openAITools) {
      body.tools = openAITools;
      if (toolChoice) {
        body.tool_choice =
          toolChoice.type === 'none'
            ? 'none'
            : toolChoice.type === 'required'
              ? 'required'
              : toolChoice.type === 'auto'
                ? 'auto'
                : toolChoice.type === 'tool'
                  ? { type: 'function', function: { name: toolChoice.toolName } }
                  : 'auto';
      }
    }

    // Handle structured output
    if (options.responseFormat?.type === 'json') {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          strict: true,
          schema: options.responseFormat.schema,
        },
      };
    }

    const fetchArgs = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.abortSignal,
    };
    const response = await fetch(url, fetchArgs);

    if (!response.ok) {
      const error = await response.text();

      // Check for authentication errors
      if (response.status === 401 || response.status === 403) {
        const providerConfig = getProviderConfig(this.provider);
        if (providerConfig?.apiKeyEnvVar) {
          throw new Error(
            `Authentication failed for provider "${this.provider}". Please ensure the ${providerConfig.apiKeyEnvVar} environment variable is set with a valid API key.`,
          );
        }
      }

      throw new Error(`OpenAI-compatible API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let sentStart = false;
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string; sent?: boolean }>();
    const mapFinishReason = this.mapFinishReason.bind(this);
    const modelId = this.modelId; // Capture modelId for use in stream

    let isActiveText = false;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        try {
          // Send stream-start
          controller.enqueue({
            type: 'stream-start',
            warnings: [],
          });

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Parse and send any buffered tool calls that haven't been sent yet
              for (const [_, toolCall] of toolCallBuffers) {
                if (!toolCall.sent && toolCall.id && toolCall.name && toolCall.args) {
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    input: toolCall.args || '{}',
                  });
                }
              }

              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '' || line.trim() === 'data: [DONE]') {
                continue;
              }

              if (line.startsWith('data: ')) {
                try {
                  const data: OpenAIStreamChunk = JSON.parse(line.slice(6));

                  // Send response metadata from first chunk
                  if (!sentStart && data.id) {
                    controller.enqueue({
                      type: 'response-metadata',
                      id: data.id,
                      modelId: data.model || modelId,
                      timestamp: new Date(data.created ? data.created * 1000 : Date.now()),
                    });
                    sentStart = true;
                  }

                  const choice = data.choices?.[0];
                  if (!choice) continue;

                  // Handle text delta
                  if (choice.delta?.content) {
                    if (!isActiveText) {
                      controller.enqueue({ type: 'text-start', id: 'text-1' });
                      isActiveText = true;
                    }

                    controller.enqueue({
                      type: 'text-delta',
                      id: 'text-1',
                      delta: choice.delta.content,
                    });
                  } else if (isActiveText) {
                    controller.enqueue({ type: 'text-end', id: 'text-1' });
                    isActiveText = false;
                  }

                  // Handle tool call deltas
                  if (choice.delta?.tool_calls) {
                    for (const toolCall of choice.delta.tool_calls) {
                      const index = toolCall.index;

                      if (!toolCallBuffers.has(index)) {
                        // Send tool-input-start when we first see a tool call
                        if (toolCall.id && toolCall.function?.name) {
                          controller.enqueue({
                            type: 'tool-input-start',
                            id: toolCall.id,
                            toolName: toolCall.function.name,
                          });
                        }

                        toolCallBuffers.set(index, {
                          id: toolCall.id || '',
                          name: toolCall.function?.name || '',
                          args: '',
                        });
                      }

                      const buffer = toolCallBuffers.get(index)!;

                      if (toolCall.id) {
                        buffer.id = toolCall.id;
                      }

                      if (toolCall.function?.name) {
                        buffer.name = toolCall.function.name;
                      }

                      if (toolCall.function?.arguments) {
                        buffer.args += toolCall.function.arguments;
                        controller.enqueue({
                          type: 'tool-input-delta',
                          id: buffer.id,
                          delta: toolCall.function.arguments,
                        });

                        // Check if tool call is complete (parsable JSON)
                        try {
                          JSON.parse(buffer.args);
                          if (buffer.id && buffer.name) {
                            controller.enqueue({
                              type: 'tool-input-end',
                              id: buffer.id,
                            });

                            controller.enqueue({
                              type: 'tool-call',
                              toolCallId: buffer.id,
                              toolName: buffer.name,
                              input: buffer.args,
                            });

                            toolCallBuffers.set(index, {
                              id: buffer.id,
                              name: buffer.name,
                              args: buffer.args,
                              sent: true,
                            });
                          }
                        } catch {
                          // Not complete JSON yet, continue buffering
                        }
                      }
                    }
                  }

                  // Handle finish
                  if (choice.finish_reason) {
                    // Don't send tool calls again - they've already been sent when complete
                    toolCallBuffers.clear();

                    controller.enqueue({
                      type: 'finish',
                      finishReason: mapFinishReason(choice.finish_reason),
                      usage: data.usage
                        ? {
                            inputTokens: data.usage.prompt_tokens || 0,
                            outputTokens: data.usage.completion_tokens || 0,
                            totalTokens: data.usage.total_tokens || 0,
                          }
                        : {
                            inputTokens: 0,
                            outputTokens: 0,
                            totalTokens: 0,
                          },
                    });
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      stream,
      request: { body: JSON.stringify(body) },
      response: { headers: Object.fromEntries(response.headers.entries()) },
      warnings: [],
    };
  }
}
