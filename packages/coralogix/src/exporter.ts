import { ExportResultCode } from '@opentelemetry/core';
import type { ExportResult } from '@opentelemetry/core';
import { ProtobufTraceSerializer } from '@opentelemetry/otlp-transformer';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export interface CoralogixExporterOptions {
  /** Coralogix private key (token) */
  token?: string;
  /** Coralogix endpoint URL */
  endpoint?: string;
  /** Coralogix application name */
  applicationName?: string;
  /** Coralogix subsystem name */
  subsystemName?: string;
  /** Whether to log debug information */
  debug?: boolean;
}

export class CoralogixExporter implements SpanExporter {
  private queue: { data: Uint8Array; resultCallback: (result: ExportResult) => void }[] = [];
  private serializer: typeof ProtobufTraceSerializer;
  private activeFlush: Promise<void> | undefined = undefined;
  private token: string;
  private endpoint: string;
  private applicationName: string;
  private subsystemName: string;
  private debug: boolean;

  constructor({ token, endpoint, applicationName, subsystemName, debug = false }: CoralogixExporterOptions = {}) {
    // Validate required parameters
    if (!token && !process.env.CX_TOKEN) {
      throw new Error('Coralogix token is required. Set CX_TOKEN environment variable or provide token option.');
    }

    if (!endpoint && !process.env.CX_ENDPOINT) {
      throw new Error(
        'Coralogix endpoint is required. Set CX_ENDPOINT environment variable or provide endpoint option.',
      );
    }

    if (!applicationName && !process.env.CX_APPLICATION_NAME) {
      throw new Error(
        'Coralogix application name is required. Set CX_APPLICATION_NAME environment variable or provide applicationName option.',
      );
    }

    if (!subsystemName && !process.env.CX_SUBSYSTEM_NAME) {
      throw new Error(
        'Coralogix subsystem name is required. Set CX_SUBSYSTEM_NAME environment variable or provide subsystemName option.',
      );
    }

    this.token = token ?? process.env.CX_TOKEN!;
    this.endpoint = endpoint ?? process.env.CX_ENDPOINT!;
    this.applicationName = applicationName ?? process.env.CX_APPLICATION_NAME!;
    this.subsystemName = subsystemName ?? process.env.CX_SUBSYSTEM_NAME!;
    this.debug = debug;
    this.serializer = ProtobufTraceSerializer;

    if (this.debug) {
      console.log(`[CoralogixExporter] Initialized with endpoint: ${this.endpoint}`);
    }
  }

  /**
   * Enhances a span with Coralogix-specific attributes for better AI/LLM observability
   */
  private enhanceSpanWithCoralogixAttributes(span: ReadableSpan): ReadableSpan {
    // Work with a copy of the attributes to avoid modifying the original
    const attributes = { ...span.attributes };

    // Extract AI-related information from existing attributes
    this.addCoralogixBaseAttributes(attributes);
    this.addCoralogixToolAttributes(attributes);
    this.addCoralogixPromptAttributes(attributes);
    this.addCoralogixCompletionAttributes(attributes);
    this.addCoralogixUserAttributes(attributes);

    if (this.debug) {
      const coralogixAttrs = Object.keys(attributes).filter(key => key.startsWith('gen_ai.'));
      if (coralogixAttrs.length > 0) {
        console.log(
          `[CoralogixExporter] Added ${coralogixAttrs.length} Coralogix-specific attributes:`,
          coralogixAttrs,
        );
      }
    }

    // Modify the span's attributes property directly instead of creating a new object
    Object.defineProperty(span, 'attributes', {
      value: attributes,
      writable: false,
      enumerable: true,
      configurable: true,
    });

    // Optionally update span name to match Coralogix expectations for AI spans
    if (this.isAIRelatedSpan(attributes) && attributes['gen_ai.operation.name'] && attributes['gen_ai.request.model']) {
      const coralogixSpanName = `${attributes['gen_ai.operation.name']} ${attributes['gen_ai.request.model']}`;
      const originalName = span.name;

      // Only update if the current name doesn't already follow this pattern
      if (!originalName.includes(String(attributes['gen_ai.request.model']))) {
        Object.defineProperty(span, 'name', {
          value: coralogixSpanName,
          writable: false,
          enumerable: true,
          configurable: true,
        });

        if (this.debug) {
          console.log(`[CoralogixExporter] Updated span name from "${originalName}" to "${coralogixSpanName}"`);
        }
      }
    }

    return span;
  }

  /**
   * Adds Coralogix-specific base attributes that identify this as an AI operation
   */
  private addCoralogixBaseAttributes(attributes: Record<string, any>): void {
    // Check if this looks like an AI-related span
    const isAISpan = this.isAIRelatedSpan(attributes);

    if (this.debug) {
      console.log(`[CoralogixExporter] AI span detection: ${isAISpan}, attributes keys:`, Object.keys(attributes));
    }

    if (isAISpan) {
      // Add the base GenAI attributes that Coralogix expects
      if (!attributes['gen_ai.operation.name']) {
        attributes['gen_ai.operation.name'] = 'chat';
      }

      if (!attributes['gen_ai.system']) {
        // Try to detect the AI system from model or other attributes
        const model = this.extractModelName(attributes);
        const provider = attributes['ai.model.provider'] || '';

        if (provider.includes('openai') || model?.includes('gpt') || model?.includes('openai')) {
          attributes['gen_ai.system'] = 'openai';
        } else if (provider.includes('anthropic') || model?.includes('claude')) {
          attributes['gen_ai.system'] = 'anthropic';
        } else if (provider.includes('google') || model?.includes('gemini')) {
          attributes['gen_ai.system'] = 'google';
        } else if (model) {
          attributes['gen_ai.system'] = 'other';
        } else {
          // Default to openai for compatibility
          attributes['gen_ai.system'] = 'openai';
        }
      }

      // Force override certain values that are incorrect
      if (attributes['gen_ai.system'] === 'openai.chat') {
        attributes['gen_ai.system'] = 'openai';
      }

      // Add model information if available
      const model = this.extractModelName(attributes);
      if (model && !attributes['gen_ai.request.model']) {
        attributes['gen_ai.request.model'] = model;
      }

      // Add server.address for OpenAI spans
      if (attributes['gen_ai.system'] === 'openai' && !attributes['server.address']) {
        attributes['server.address'] = 'api.openai.com';
      }

      // Force override span.kind to client for AI operations (even if it exists)
      attributes['span.kind'] = 'client';

      // Add service tier if missing
      if (attributes['gen_ai.system'] === 'openai' && !attributes['gen_ai.openai.request.service_tier']) {
        attributes['gen_ai.openai.request.service_tier'] = 'default';
      }

      if (this.debug) {
        console.log(
          `[CoralogixExporter] Enhanced AI span with base attributes: operation=${attributes['gen_ai.operation.name']}, system=${attributes['gen_ai.system']}, model=${attributes['gen_ai.request.model']}`,
        );
      }
    }
  }

  /**
   * Checks if a span appears to be AI-related based on its attributes
   */
  private isAIRelatedSpan(attributes: Record<string, any>): boolean {
    // Look for AI-related indicators in attributes
    const aiIndicators = [
      'ai.model.id',
      'ai.request.model',
      'ai.prompt.messages',
      'ai.request.messages',
      'ai.response',
      'ai.request.tools',
      'tools',
      'messages',
      'model',
    ];

    return aiIndicators.some(key => attributes[key] !== undefined);
  }

  /**
   * Extracts model name from various attribute keys
   */
  private extractModelName(attributes: Record<string, any>): string | null {
    const modelKeys = ['ai.model.id', 'ai.request.model', 'gen_ai.request.model', 'model'];

    for (const key of modelKeys) {
      if (attributes[key]) {
        return String(attributes[key]);
      }
    }

    return null;
  }

  /**
   * Adds Coralogix-specific tool attributes
   */
  private addCoralogixToolAttributes(attributes: Record<string, any>): void {
    // Look for existing tool information in various formats
    const tools = this.extractToolsFromAttributes(attributes);

    if (this.debug) {
      console.log(`[CoralogixExporter] Extracted tools:`, tools);
    }

    if (tools && tools.length > 0) {
      tools.forEach((tool, index) => {
        if (tool.type) {
          attributes[`gen_ai.openai.request.tools.${index}.type`] = tool.type;
        }

        if (tool.function) {
          if (tool.function.name) {
            attributes[`gen_ai.openai.request.tools.${index}.function.name`] = tool.function.name;
          }
          if (tool.function.description) {
            attributes[`gen_ai.openai.request.tools.${index}.function.description`] = tool.function.description;
          }
          if (tool.function.parameters) {
            attributes[`gen_ai.openai.request.tools.${index}.function.parameters`] =
              typeof tool.function.parameters === 'string'
                ? tool.function.parameters
                : JSON.stringify(tool.function.parameters);
          }
        }
      });

      if (this.debug) {
        const toolAttrs = Object.keys(attributes).filter(key => key.startsWith('gen_ai.openai.request.tools.'));
        console.log(`[CoralogixExporter] Added ${toolAttrs.length} tool attributes:`, toolAttrs);
      }
    } else if (this.debug) {
      console.log(`[CoralogixExporter] No tools extracted from attributes`);
    }
  }

  /**
   * Adds Coralogix-specific prompt attributes
   */
  private addCoralogixPromptAttributes(attributes: Record<string, any>): void {
    // Look for existing prompt/message information
    const messages = this.extractMessagesFromAttributes(attributes);

    if (messages && messages.length > 0) {
      messages.forEach((message, index) => {
        if (message.role) {
          attributes[`gen_ai.prompt.${index}.role`] = message.role;
        }

        if (message.content) {
          attributes[`gen_ai.prompt.${index}.content`] = message.content;
        }

        if (message.tool_call_id) {
          attributes[`gen_ai.prompt.${index}.tool_call_id`] = message.tool_call_id;
        }

        // Handle tool calls within messages
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
          message.tool_calls.forEach((toolCall: any, toolIndex: number) => {
            if (toolCall.id) {
              attributes[`gen_ai.prompt.${index}.tool_calls.${toolIndex}.id`] = toolCall.id;
            }
            if (toolCall.type) {
              attributes[`gen_ai.prompt.${index}.tool_calls.${toolIndex}.type`] = toolCall.type;
            }
            if (toolCall.function?.name) {
              attributes[`gen_ai.prompt.${index}.tool_calls.${toolIndex}.function.name`] = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              attributes[`gen_ai.prompt.${index}.tool_calls.${toolIndex}.function.arguments`] =
                typeof toolCall.function.arguments === 'string'
                  ? toolCall.function.arguments
                  : JSON.stringify(toolCall.function.arguments);
            }
          });
        }
      });
    }
  }

  /**
   * Adds Coralogix-specific completion attributes
   */
  private addCoralogixCompletionAttributes(attributes: Record<string, any>): void {
    // Look for completion/choice information
    const completions = this.extractCompletionsFromAttributes(attributes);

    if (completions && completions.length > 0) {
      completions.forEach((completion, index) => {
        if (completion.role) {
          attributes[`gen_ai.completion.${index}.role`] = completion.role;
        }

        if (completion.content) {
          attributes[`gen_ai.completion.${index}.content`] = completion.content;
        }

        if (completion.finish_reason) {
          attributes[`gen_ai.completion.${index}.finish_reason`] = completion.finish_reason;
        }

        // Handle tool calls in completions
        if (completion.tool_calls && Array.isArray(completion.tool_calls)) {
          completion.tool_calls.forEach((toolCall: any, toolIndex: number) => {
            if (toolCall.id) {
              attributes[`gen_ai.completion.${index}.tool_calls.${toolIndex}.id`] = toolCall.id;
            }
            if (toolCall.type) {
              attributes[`gen_ai.completion.${index}.tool_calls.${toolIndex}.type`] = toolCall.type;
            }
            if (toolCall.function?.name) {
              attributes[`gen_ai.completion.${index}.tool_calls.${toolIndex}.function.name`] = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              attributes[`gen_ai.completion.${index}.tool_calls.${toolIndex}.function.arguments`] =
                typeof toolCall.function.arguments === 'string'
                  ? toolCall.function.arguments
                  : JSON.stringify(toolCall.function.arguments);
            }
          });
        }
      });
    }
  }

  /**
   * Adds Coralogix-specific user attributes
   */
  private addCoralogixUserAttributes(attributes: Record<string, any>): void {
    // Look for user information in various attribute keys
    const userKeys = ['user', 'ai.request.user', 'openai.request.user', 'ai.user', 'userId'];

    for (const key of userKeys) {
      if (attributes[key]) {
        attributes['gen_ai.openai.request.user'] = attributes[key];
        break;
      }
    }

    // If no user found, try to extract from request metadata or other sources
    if (!attributes['gen_ai.openai.request.user']) {
      // You might want to set a default user if required by your setup
      // attributes['gen_ai.openai.request.user'] = 'system';
    }
  }

  /**
   * Extracts tool information from span attributes
   */
  private extractToolsFromAttributes(attributes: Record<string, any>): any[] | null {
    // Look for tools in common attribute keys
    const toolKeys = ['tools', 'ai.request.tools', 'ai.prompt.tools', 'openai.request.tools'];

    for (const key of toolKeys) {
      if (attributes[key]) {
        try {
          let tools = attributes[key];

          // Handle double-escaped JSON strings like in your span
          if (typeof tools === 'string') {
            try {
              // First parse to get the array string
              tools = JSON.parse(tools);
              // If it's still a string (double-escaped), parse again
              if (typeof tools === 'string') {
                tools = JSON.parse(tools);
              }
              // If it's an array of strings (triple-escaped), parse each element
              if (Array.isArray(tools) && tools.length > 0 && typeof tools[0] === 'string') {
                tools = tools.map(tool => {
                  try {
                    return typeof tool === 'string' ? JSON.parse(tool) : tool;
                  } catch {
                    return tool;
                  }
                });
              }
            } catch (parseError) {
              if (this.debug) {
                console.warn(`[CoralogixExporter] Failed to parse tools JSON:`, parseError);
              }
            }
          }

          if (Array.isArray(tools)) {
            return tools;
          }
        } catch (error) {
          if (this.debug) {
            console.warn(`[CoralogixExporter] Failed to parse tools from ${key}:`, error);
          }
        }
      }
    }

    // Also extract tools from messages if they contain tool calls
    const messages = this.extractMessagesFromAttributes(attributes);
    if (messages) {
      const toolsFromMessages = this.extractToolsFromMessages(messages);
      if (toolsFromMessages && toolsFromMessages.length > 0) {
        return toolsFromMessages;
      }
    }

    return null;
  }

  /**
   * Extracts tool information from message tool calls
   */
  private extractToolsFromMessages(messages: any[]): any[] | null {
    const tools: any[] = [];
    const seenTools = new Set<string>();

    for (const message of messages) {
      if (message.content && Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'tool-call' && content.toolName) {
            const toolKey = content.toolName;
            if (!seenTools.has(toolKey)) {
              seenTools.add(toolKey);
              // Create a basic tool definition
              tools.push({
                type: 'function',
                function: {
                  name: content.toolName,
                  description: `Tool function: ${content.toolName}`,
                  parameters: content.args || {},
                },
              });
            }
          }
        }
      }

      // Also check tool_calls property
      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.function?.name) {
            const toolKey = toolCall.function.name;
            if (!seenTools.has(toolKey)) {
              seenTools.add(toolKey);
              tools.push({
                type: toolCall.type || 'function',
                function: {
                  name: toolCall.function.name,
                  description: `Tool function: ${toolCall.function.name}`,
                  parameters: toolCall.function.arguments
                    ? typeof toolCall.function.arguments === 'string'
                      ? JSON.parse(toolCall.function.arguments)
                      : toolCall.function.arguments
                    : {},
                },
              });
            }
          }
        }
      }
    }

    return tools.length > 0 ? tools : null;
  }

  /**
   * Extracts message/prompt information from span attributes
   */
  private extractMessagesFromAttributes(attributes: Record<string, any>): any[] | null {
    // Look for messages in common attribute keys
    const messageKeys = ['messages', 'ai.prompt.messages', 'ai.request.messages'];

    for (const key of messageKeys) {
      if (attributes[key]) {
        try {
          const messages = typeof attributes[key] === 'string' ? JSON.parse(attributes[key]) : attributes[key];

          if (Array.isArray(messages)) {
            return messages;
          }
        } catch (error) {
          if (this.debug) {
            console.warn(`[CoralogixExporter] Failed to parse messages from ${key}:`, error);
          }
        }
      }
    }

    return null;
  }

  /**
   * Extracts completion/choice information from span attributes
   */
  private extractCompletionsFromAttributes(attributes: Record<string, any>): any[] | null {
    // Look for completion information in various formats
    const completionKeys = ['choices', 'ai.response.choices', 'completions'];

    for (const key of completionKeys) {
      if (attributes[key]) {
        try {
          const completions = typeof attributes[key] === 'string' ? JSON.parse(attributes[key]) : attributes[key];

          if (Array.isArray(completions)) {
            return completions;
          }
        } catch (error) {
          if (this.debug) {
            console.warn(`[CoralogixExporter] Failed to parse completions from ${key}:`, error);
          }
        }
      }
    }

    // Also check for single completion in result attributes
    const resultKeys = ['result', 'ai.response', 'response'];
    for (const key of resultKeys) {
      if (attributes[key]) {
        try {
          const result = typeof attributes[key] === 'string' ? JSON.parse(attributes[key]) : attributes[key];

          if (result && typeof result === 'object') {
            // Extract completion-like data from the result
            const completion: any = {};

            if (result.role || result.content || result.finish_reason) {
              if (result.role) completion.role = result.role;
              if (result.content) completion.content = result.content;
              if (result.finish_reason) completion.finish_reason = result.finish_reason;
              if (result.tool_calls) completion.tool_calls = result.tool_calls;

              return [completion];
            }

            // Check if result has choices
            if (result.choices && Array.isArray(result.choices)) {
              return result.choices.map((choice: any) => ({
                role: choice.message?.role,
                content: choice.message?.content,
                finish_reason: choice.finish_reason,
                tool_calls: choice.message?.tool_calls,
              }));
            }
          }
        } catch (error) {
          if (this.debug) {
            console.warn(`[CoralogixExporter] Failed to parse result from ${key}:`, error);
          }
        }
      }
    }

    return null;
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (this.debug) {
      console.log(`[CoralogixExporter] Exporting ${spans.length} spans`);
    }

    try {
      // First enhance spans with Coralogix-specific attributes
      const enhancedSpans = spans.map(span => this.enhanceSpanWithCoralogixAttributes(span));

      // Ensure all spans have proper resource information
      const spansWithResource = enhancedSpans.map(span => {
        // Check if span has resource information
        if (!span.resource || !span.resource.attributes || !span.resource.attributes[ATTR_SERVICE_NAME]) {
          if (this.debug) {
            console.log('[CoralogixExporter] Span missing resource, adding default resource');
          }

          // Create a proper Resource object with required attributes including Coralogix-specific ones
          const defaultResource = resourceFromAttributes({
            [ATTR_SERVICE_NAME]: this.applicationName,
            [ATTR_SERVICE_VERSION]: '1.0.0',
            'cx.application.name': this.applicationName,
            'cx.subsystem.name': this.subsystemName,
            'telemetry.sdk.name': '@mastra/coralogix',
            'telemetry.sdk.version': '1.0.0',
          });

          // Modify the span's resource property directly instead of spreading
          Object.defineProperty(span, 'resource', {
            value: defaultResource,
            writable: false,
            enumerable: true,
            configurable: true,
          });

          return span;
        }

        // Span already has resource, ensure it has required attributes
        const resourceAttributes = span.resource.attributes;
        if (!resourceAttributes[ATTR_SERVICE_NAME] || !resourceAttributes['cx.application.name']) {
          const enhancedResource = resourceFromAttributes({
            ...resourceAttributes,
            [ATTR_SERVICE_NAME]: resourceAttributes[ATTR_SERVICE_NAME] || this.applicationName,
            [ATTR_SERVICE_VERSION]: resourceAttributes[ATTR_SERVICE_VERSION] || '1.0.0',
            'cx.application.name': resourceAttributes['cx.application.name'] || this.applicationName,
            'cx.subsystem.name': resourceAttributes['cx.subsystem.name'] || this.subsystemName,
          });

          // Modify the span's resource property directly instead of spreading
          Object.defineProperty(span, 'resource', {
            value: enhancedResource,
            writable: false,
            enumerable: true,
            configurable: true,
          });

          return span;
        }

        return span;
      });

      if (this.debug) {
        console.log(`[CoralogixExporter] Processing ${spansWithResource.length} spans with proper resources`);
        console.log('[CoralogixExporter] Sample span resource:', spansWithResource[0]?.resource?.attributes);
      }

      // Serialize spans to protobuf binary format
      const serializedRequest = this.serializer.serializeRequest(spansWithResource);
      if (!serializedRequest) {
        throw new Error('Failed to serialize spans - serializeRequest returned null/undefined');
      }

      // Extract the actual protobuf data from the serialized request
      // The serializeRequest returns an object with body property containing the binary data
      const protobufData = new Uint8Array(serializedRequest);

      if (this.debug) {
        console.log(`[CoralogixExporter] Serialized ${protobufData.length} bytes of protobuf data`);
      }

      this.queue.push({ data: protobufData, resultCallback });

      if (!this.activeFlush) {
        this.activeFlush = this.flush();
      }
    } catch (error) {
      console.error('[CoralogixExporter] Error serializing spans:', error);

      if (this.debug) {
        console.error(
          '[CoralogixExporter] Span details:',
          spans.map(span => ({
            name: span.name,
            hasResource: !!span.resource,
            resourceAttributes: span.resource?.attributes,
          })),
        );
      }

      resultCallback({
        code: ExportResultCode.FAILED,
        error: error as Error,
      });
    }
  }

  shutdown(): Promise<void> {
    if (this.debug) {
      console.log('[CoralogixExporter] Shutting down');
    }
    return this.forceFlush();
  }

  private async sendToCoralogix(data: Uint8Array): Promise<void> {
    const url = this.endpoint;

    if (this.debug) {
      console.log(`[CoralogixExporter] Sending ${data.length} bytes to ${url}`);
    }

    const headers = {
      Authorization: `Bearer ${this.token}`,
      'cx-application-name': this.applicationName,
      'cx-subsystem-name': this.subsystemName,
      'Content-Type': 'application/x-protobuf',
    };

    const options: RequestInit = {
      method: 'POST',
      headers,
      body: data,
    };

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, statusText: ${response.statusText}, body: ${responseText}`,
        );
      }

      if (this.debug) {
        console.log(`[CoralogixExporter] Successfully exported spans to Coralogix`);
      }
    } catch (error) {
      console.error('[CoralogixExporter] Failed to export spans to Coralogix:', error);
      throw error;
    }
  }

  private flush(): Promise<void> {
    const item = this.queue.shift();
    if (!item) return Promise.resolve();

    return this.sendToCoralogix(item.data)
      .then(() => {
        item.resultCallback({
          code: ExportResultCode.SUCCESS,
        });
      })
      .catch(e => {
        console.error('[CoralogixExporter] Span export error:', e?.message || String(e));
        item.resultCallback({
          code: ExportResultCode.FAILED,
          error: e,
        });
      })
      .finally(() => {
        this.activeFlush = undefined;
      });
  }

  async forceFlush(): Promise<void> {
    if (!this.queue.length) {
      return;
    }

    await this.activeFlush;
    while (this.queue.length) {
      await this.flush();
    }
  }
}
