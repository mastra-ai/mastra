import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2Usage,
  LanguageModelV2StreamPart,
  LanguageModelV2CallWarning,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import { parseModelString, getProviderConfig } from './provider-registry.generated';
import type { OpenAICompatibleModelId } from './provider-registry.generated';
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

// Helper function to build headers for the request
function buildHeaders(
  apiKey?: string,
  apiKeyHeader?: string,
  customHeaders?: Record<string, string>,
  provider?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (apiKey) {
    // Use custom API key header if specified (e.g., 'x-api-key' for Anthropic)
    if (apiKeyHeader === 'x-api-key') {
      headers['x-api-key'] = apiKey;
    } else {
      // Default to Authorization Bearer format
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  // Add provider-specific headers
  if (provider === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01';
  }

  return headers;
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

// TODO: get these types from openai
interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
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

  private url: string;
  private headers: Record<string, string>;

  constructor(config: OpenAICompatibleModelId | OpenAICompatibleConfig | string) {
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
        // If it's a direct URL
        parsedConfig = {
          id: 'unknown',
          url: config,
        };
        this.provider = 'openai-compatible';
      } else {
        // Handle magic strings like "openai/gpt-4o" or "chutes/Qwen/Qwen3-235B-A22B-Instruct-2507"
        // For multi-slash strings, extract just the provider (first part)
        const firstSlashIndex = config.indexOf('/');

        if (firstSlashIndex !== -1) {
          const provider = config.substring(0, firstSlashIndex);
          const modelId = config.substring(firstSlashIndex + 1);

          const providerConfig = getProviderConfig(provider);
          if (!providerConfig) {
            throw new Error(`Unknown provider: ${provider}. Use a custom URL instead.`);
          }

          parsedConfig = {
            id: modelId,
            url: providerConfig.url,
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

      // Extract provider from id if present
      const parsed = parseModelString(config.id);

      if (!config.url && parsed.provider) {
        // Use provider preset
        const providerConfig = getProviderConfig(parsed.provider);
        if (!providerConfig) {
          throw new Error(`Unknown provider: ${parsed.provider}. Please provide a URL.`);
        }
        parsedConfig.url = providerConfig.url;
        parsedConfig.id = parsed.modelId;
        this.provider = parsed.provider;
      } else {
        this.provider = parsed.provider || 'openai-compatible';
      }

      // Resolve API key if not provided
      if (!parsedConfig.apiKey) {
        parsedConfig.apiKey = resolveApiKey({ provider: parsed.provider || undefined });
      }
    }

    // Validate we have a URL
    if (!parsedConfig.url) {
      throw new Error('URL is required for OpenAI-compatible model');
    }

    // Store the API key (might be undefined, we'll check later when making requests)
    // This allows the model to be instantiated even without an API key,
    // and we'll throw a proper error through the stream when the request is made

    // Get provider config for headers
    const providerConfig = this.provider !== 'openai-compatible' ? getProviderConfig(this.provider) : undefined;

    // Set final properties
    this.modelId = parsedConfig.id;
    this.url = parsedConfig.url;
    this.headers = buildHeaders(parsedConfig.apiKey, providerConfig?.apiKeyHeader, parsedConfig.headers, this.provider);
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

  async doGenerate(options: LanguageModelV2CallOptions): Promise<{
    content: LanguageModelV2Content[];
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata?: SharedV2ProviderMetadata;
    request?: { body: string };
    response?: { headers: Record<string, string> };
    warnings: LanguageModelV2CallWarning[];
  }> {
    // Check if API key is required and missing
    if (!this.headers['Authorization'] && !this.headers['x-api-key'] && this.provider !== 'openai-compatible') {
      const providerConfig = getProviderConfig(this.provider);
      const errorMessage = providerConfig?.apiKeyEnvVar
        ? `API key not found for provider "${this.provider}". Please set the ${providerConfig.apiKeyEnvVar} environment variable.`
        : `API key not found for provider "${this.provider}". Please provide an API key in the configuration.`;

      throw new Error(errorMessage);
    }

    const { prompt, tools, toolChoice, providerOptions } = options;

    // TODO: lets get a real body type here, not any
    const body: any = {
      messages: this.convertMessagesToOpenAI(prompt),
      model: this.modelId,
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

    const response = await fetch(this.url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

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

    const data: OpenAICompletionResponse = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('No choices returned from API');
    }

    const content: LanguageModelV2Content[] = [];

    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content,
      });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
        });
      }
    }

    return {
      content,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      warnings: [],
      request: { body: JSON.stringify(body) },
      response: { headers: Object.fromEntries(response.headers.entries()) },
    };
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    request?: { body: string };
    response?: { headers: Record<string, string> };
    warnings: LanguageModelV2CallWarning[];
  }> {
    // Check if API key is required and missing (do this check here so error goes through stream)
    if (!this.headers['Authorization'] && !this.headers['x-api-key'] && this.provider !== 'openai-compatible') {
      const providerConfig = getProviderConfig(this.provider);
      const errorMessage = providerConfig?.apiKeyEnvVar
        ? `API key not found for provider "${this.provider}". Please set the ${providerConfig.apiKeyEnvVar} environment variable.`
        : `API key not found for provider "${this.provider}". Please provide an API key in the configuration.`;
      // throw new Error(errorMessage)
      // Return a stream that throws an error immediately
      // This will be caught by the execute wrapper and properly handled
      throw new Error(errorMessage);
    }

    const { prompt, tools, toolChoice, providerOptions } = options;

    // TODO: real body type, not any
    const body: any = {
      messages: this.convertMessagesToOpenAI(prompt),
      model: this.modelId,
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
      headers: this.headers,
      body: JSON.stringify(body),
      signal: options.abortSignal,
    };
    const response = await fetch(this.url, fetchArgs);

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
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();
    const mapFinishReason = this.mapFinishReason.bind(this);

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
              // Parse and send any buffered tool calls
              for (const [_, toolCall] of toolCallBuffers) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  input: toolCall.args || '{}',
                });
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
                      modelId: data.model || (this as any).modelId,
                      timestamp: new Date(data.created ? data.created * 1000 : Date.now()),
                    });
                    sentStart = true;
                  }

                  const choice = data.choices?.[0];
                  if (!choice) continue;

                  // Handle text delta
                  if (choice.delta?.content) {
                    controller.enqueue({
                      type: 'text-delta',
                      id: 'text-1',
                      delta: choice.delta.content,
                    });
                  }

                  // Handle tool call deltas
                  if (choice.delta?.tool_calls) {
                    for (const toolCall of choice.delta.tool_calls) {
                      const index = toolCall.index;

                      if (!toolCallBuffers.has(index)) {
                        toolCallBuffers.set(index, {
                          id: '',
                          name: '',
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
                      }
                    }
                  }

                  // Handle finish
                  if (choice.finish_reason) {
                    // Parse and send complete tool calls before finishing
                    for (const [_, toolCall] of toolCallBuffers) {
                      if (toolCall.id && toolCall.name && toolCall.args) {
                        controller.enqueue({
                          type: 'tool-call',
                          toolCallId: toolCall.id,
                          toolName: toolCall.name,
                          input: toolCall.args || '{}',
                        });
                      }
                    }
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
