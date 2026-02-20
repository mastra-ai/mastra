/**
 * @mastra/telnyx
 *
 * Telnyx telephony tool provider for Mastra agents.
 *
 * Provides tools for SMS messaging and voice calls via the Telnyx API.
 * This enables Mastra agents to send text messages and make phone calls
 * as part of their workflows.
 *
 * Setup:
 * 1. Get a Telnyx account at https://telnyx.com
 * 2. Create an API key in the Telnyx Portal
 * 3. Purchase or port a phone number
 * 4. (Optional) Create a messaging profile for SMS
 *
 * @example
 * ```typescript
 * import { TelnyxToolProvider } from '@mastra/telnyx';
 *
 * const telnyx = new TelnyxToolProvider({
 *   apiKey: process.env.TELNYX_API_KEY,
 *   fromNumber: process.env.TELNYX_FROM_NUMBER,
 * });
 *
 * // List available tools
 * const tools = await telnyx.listTools();
 *
 * // Resolve tools for agent use
 * const agentTools = await telnyx.resolveTools(['telnyx_send_sms', 'telnyx_make_call']);
 * ```
 */

import type {
  ToolProvider,
  ToolProviderInfo,
  ToolProviderToolkit,
  ToolProviderToolInfo,
  ToolProviderListResult,
  ListToolProviderToolsOptions,
  ResolveToolProviderToolsOptions,
} from '@mastra/core/tool-provider';
import type { ToolAction } from '@mastra/core/tools';
import type { StorageToolConfig } from '@mastra/core/storage';
import { z } from 'zod';

export interface TelnyxToolProviderConfig {
  /** Telnyx API key */
  apiKey: string;
  /** Default phone number for sending messages/calls (E.164 format) */
  fromNumber?: string;
  /** Messaging profile ID for SMS */
  messagingProfileId?: string;
}

/**
 * Telnyx tool definitions with schemas.
 */
const TELNYX_TOOLS: readonly {
  slug: string;
  name: string;
  description: string;
  toolkit: string;
  inputSchema: z.ZodObject<any>;
  execute: (input: any, config: TelnyxToolProviderConfig) => Promise<string>;
}[] = [
  {
    slug: 'telnyx_send_sms',
    name: 'Send SMS',
    description:
      'Send an SMS text message to a phone number via Telnyx. Use this when you need to send a text message to someone. The phone number should be in E.164 format (e.g., +15551234567).',
    toolkit: 'telnyx',
    inputSchema: z.object({
      to: z.string().describe('Destination phone number in E.164 format (e.g., +15551234567)'),
      body: z.string().describe('Text message content to send'),
      from: z.string().optional().describe('Sender phone number (optional, uses default if not provided)'),
    }),
    execute: async (input, config) => {
      try {
        const telnyx = await import('telnyx');
        telnyx.default.apiKey = config.apiKey;

        const from = input.from || config.fromNumber;
        if (!from) {
          return 'Error: No sender phone number configured. Provide "from" parameter or set fromNumber in config.';
        }

        const messageParams: Record<string, any> = {
          from: from,
          to: input.to,
          text: input.body,
        };

        if (config.messagingProfileId) {
          messageParams.messaging_profile_id = config.messagingProfileId;
        }

        const message = await telnyx.default.Message.create(messageParams);

        return `Successfully sent SMS to ${input.to}. Message ID: ${message.id}. Status: ${message.status}.`;
      } catch (error: any) {
        if (error.message?.includes("Cannot find module 'telnyx'")) {
          return 'Error: telnyx package not installed. Install it with: npm install telnyx';
        }
        return `Error sending SMS: ${error.message || 'Unknown error'}`;
      }
    },
  },
  {
    slug: 'telnyx_make_call',
    name: 'Make Voice Call',
    description:
      'Make a phone call to a specified number using Telnyx Call Control. Use this when you need to call someone. Returns a call_control_id for managing the call.',
    toolkit: 'telnyx',
    inputSchema: z.object({
      to: z.string().describe('Destination phone number in E.164 format (e.g., +15551234567)'),
      from: z.string().optional().describe('Caller phone number (optional, uses default if not provided)'),
      webhook_url: z.string().optional().describe('Webhook URL for call status events (optional)'),
    }),
    execute: async (input, config) => {
      try {
        const telnyx = await import('telnyx');
        telnyx.default.apiKey = config.apiKey;

        const from = input.from || config.fromNumber;
        if (!from) {
          return 'Error: No caller phone number configured. Provide "from" parameter or set fromNumber in config.';
        }

        const callParams: Record<string, any> = {
          from: from,
          to: input.to,
        };

        if (input.webhook_url) {
          callParams.webhook_url = input.webhook_url;
        }

        const call = await telnyx.default.Call.create(callParams);

        return `Successfully initiated call to ${input.to}. Call Control ID: ${call.call_control_id}. The call will be connected shortly.`;
      } catch (error: any) {
        if (error.message?.includes("Cannot find module 'telnyx'")) {
          return 'Error: telnyx package not installed. Install it with: npm install telnyx';
        }
        return `Error making call: ${error.message || 'Unknown error'}`;
      }
    },
  },
  {
    slug: 'telnyx_hangup_call',
    name: 'Hang Up Call',
    description: 'Hang up an active phone call. Provide the call_control_id from a previous telnyx_make_call.',
    toolkit: 'telnyx',
    inputSchema: z.object({
      call_control_id: z.string().describe('Call control ID of the call to hang up'),
    }),
    execute: async (input, config) => {
      try {
        const telnyx = await import('telnyx');
        telnyx.default.apiKey = config.apiKey;

        const call = await telnyx.default.Call.retrieve(input.call_control_id);
        await call.hangup();

        return `Successfully hung up call ${input.call_control_id}.`;
      } catch (error: any) {
        if (error.message?.includes("Cannot find module 'telnyx'")) {
          return 'Error: telnyx package not installed. Install it with: npm install telnyx';
        }
        return `Error hanging up call: ${error.message || 'Unknown error'}`;
      }
    },
  },
  {
    slug: 'telnyx_lookup_number',
    name: 'Lookup Phone Number',
    description: 'Lookup information about a phone number using Telnyx Number Lookup API.',
    toolkit: 'telnyx',
    inputSchema: z.object({
      phone_number: z.string().describe('Phone number to lookup in E.164 format'),
    }),
    execute: async (input, config) => {
      try {
        const telnyx = await import('telnyx');
        telnyx.default.apiKey = config.apiKey;

        const lookup = await telnyx.default.NumberLookup.retrieve(input.phone_number);

        return JSON.stringify(
          {
            carrier: lookup.carrier,
            caller_name: lookup.caller_name,
            fraud: lookup.fraud,
            portability: lookup.portability,
          },
          null,
          2,
        );
      } catch (error: any) {
        if (error.message?.includes("Cannot find module 'telnyx'")) {
          return 'Error: telnyx package not installed. Install it with: npm install telnyx';
        }
        return `Error looking up number: ${error.message || 'Unknown error'}`;
      }
    },
  },
];

/**
 * Telnyx toolkit definition.
 */
const TELNYX_TOOLKIT: ToolProviderToolkit = {
  slug: 'telnyx',
  name: 'Telnyx',
  description: 'Send SMS messages, make voice calls, and manage telephony via Telnyx API',
};

/**
 * Telnyx telephony tool provider for Mastra.
 *
 * Provides tools for SMS messaging and voice calls using the Telnyx API.
 * This enables Mastra agents to communicate via phone as part of their workflows.
 *
 * The provider implements the ToolProvider interface for integration with
 * Mastra's agent tool resolution system.
 *
 * @example
 * ```typescript
 * import { TelnyxToolProvider } from '@mastra/telnyx';
 * import { Mastra } from '@mastra/core';
 *
 * const telnyx = new TelnyxToolProvider({
 *   apiKey: process.env.TELNYX_API_KEY!,
 *   fromNumber: process.env.TELNYX_FROM_NUMBER,
 * });
 *
 * const mastra = new Mastra({
 *   // Register the provider for tool discovery
 * });
 * ```
 */
export class TelnyxToolProvider implements ToolProvider {
  readonly info: ToolProviderInfo = {
    id: 'telnyx',
    name: 'Telnyx',
    description: 'Send SMS messages, make voice calls, and manage telephony via Telnyx API',
  };

  private config: TelnyxToolProviderConfig;

  constructor(config: TelnyxToolProviderConfig) {
    this.config = config;
  }

  /**
   * List available toolkits.
   * Telnyx provides a single toolkit for telephony operations.
   */
  async listToolkits(): Promise<ToolProviderListResult<ToolProviderToolkit>> {
    return { data: [TELNYX_TOOLKIT] };
  }

  /**
   * List available tools, optionally filtered by toolkit or search query.
   */
  async listTools(options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>> {
    let tools = TELNYX_TOOLS;

    // Filter by toolkit (always 'telnyx')
    if (options?.toolkit && options.toolkit !== 'telnyx') {
      return { data: [], pagination: { hasMore: false } };
    }

    // Search filter
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      tools = tools.filter(
        t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.slug.toLowerCase().includes(searchLower),
      );
    }

    const data: ToolProviderToolInfo[] = tools.map(t => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      toolkit: t.toolkit,
    }));

    return {
      data,
      pagination: {
        total: data.length,
        page: options?.page ?? 1,
        perPage: options?.perPage ?? 50,
        hasMore: false,
      },
    };
  }

  /**
   * Get the JSON schema for a specific tool's input.
   */
  async getToolSchema(toolSlug: string): Promise<Record<string, unknown> | null> {
    const tool = TELNYX_TOOLS.find(t => t.slug === toolSlug);
    if (!tool) return null;

    // Convert Zod schema to JSON Schema format
    return this.zodToJsonSchema(tool.inputSchema);
  }

  /**
   * Resolve executable tools for the given slugs.
   * Returns Mastra ToolAction objects that can be used by agents.
   */
  async resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    _options?: ResolveToolProviderToolsOptions,
  ): Promise<Record<string, ToolAction<unknown, unknown>>> {
    const result: Record<string, ToolAction<unknown, unknown>> = {};

    for (const slug of toolSlugs) {
      const toolDef = TELNYX_TOOLS.find(t => t.slug === slug);
      if (!toolDef) continue;

      const descOverride = toolConfigs?.[slug]?.description;

      result[slug] = {
        id: slug,
        description: descOverride ?? toolDef.description,
        inputSchema: toolDef.inputSchema,
        outputSchema: z.string().describe('Result message from the Telnyx API call'),
        execute: async (input: unknown) => {
          return toolDef.execute(input, this.config);
        },
      } as ToolAction<unknown, unknown>;
    }

    return result;
  }

  /**
   * Convert a Zod schema to JSON Schema format.
   */
  private zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    // Basic conversion - for more complex schemas, consider using zod-to-json-schema
    if (schema instanceof z.ZodObject) {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(schema.shape)) {
        const field = value as z.ZodTypeAny;
        properties[key] = this.zodTypeToJsonSchema(field);

        // Check if optional
        if (!(field instanceof z.ZodOptional)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    return this.zodTypeToJsonSchema(schema);
  }

  /**
   * Convert a Zod type to JSON Schema type.
   */
  private zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
    // Handle optional types
    if (zodType instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(zodType.unwrap());
    }

    // Handle default types
    if (zodType instanceof z.ZodDefault) {
      return this.zodTypeToJsonSchema(zodType.removeDefault());
    }

    // Handle descriptions
    const description = zodType._def.description;

    if (zodType instanceof z.ZodString) {
      return { type: 'string', description };
    }
    if (zodType instanceof z.ZodNumber) {
      return { type: 'number', description };
    }
    if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean', description };
    }
    if (zodType instanceof z.ZodArray) {
      return { type: 'array', items: this.zodTypeToJsonSchema(zodType.element), description };
    }
    if (zodType instanceof z.ZodObject) {
      return this.zodToJsonSchema(zodType);
    }

    // Fallback
    return { description };
  }
}

export { TELNYX_TOOLS };
