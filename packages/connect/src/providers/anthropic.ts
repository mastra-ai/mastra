import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_ANTHROPIC_CONNECTION_ID';

/** Required on every Anthropic API request. */
const headers = { 'anthropic-version': '2023-06-01' };

const messageInput = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Joins the text content blocks of a Messages API response. */
function textOf(raw: unknown): string {
  const content = asRecord(raw).content;
  if (!Array.isArray(content)) return '';
  return content
    .map(block => {
      const record = asRecord(block);
      return record.type === 'text' && typeof record.text === 'string' ? record.text : '';
    })
    .join('');
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

/**
 * Curated Anthropic toolset executing through the platform connection
 * proxy. Intentionally small — calling a model provider from an agent tool
 * is niche. All tools resolve the connection from `options.connectionId` or
 * MASTRA_ANTHROPIC_CONNECTION_ID at execute time, and pin
 * anthropic-version 2023-06-01.
 */
export function createAnthropicTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    anthropic_create_message: defineProxyTool(context, {
      id: 'anthropic_create_message',
      description: 'Generate a message with an Anthropic model via the Messages API.',
      inputSchema: z.object({
        model: z.string().min(1).describe('Model id, e.g. "claude-sonnet-4-5"'),
        messages: z.array(messageInput).min(1).describe('Conversation messages in alternating order'),
        maxTokens: z.number().int().min(1).describe('Maximum tokens to generate'),
        system: z.string().optional().describe('System prompt'),
        temperature: z.number().min(0).max(1).optional().describe('Sampling temperature (0-1)'),
      }),
      outputSchema: z.object({
        id: z.string(),
        model: z.string(),
        stopReason: z.string().nullable(),
        text: z.string(),
        inputTokens: z.number(),
        outputTokens: z.number(),
      }),
      request: input => ({
        method: 'POST',
        path: 'v1/messages',
        headers,
        body: {
          model: input.model,
          messages: input.messages,
          max_tokens: input.maxTokens,
          system: input.system,
          temperature: input.temperature,
        },
      }),
      transform: raw => {
        const message = asRecord(raw);
        const usage = asRecord(message.usage);
        return {
          id: String(message.id ?? ''),
          model: String(message.model ?? ''),
          stopReason: typeof message.stop_reason === 'string' ? message.stop_reason : null,
          text: textOf(raw),
          inputTokens: toNumber(usage.input_tokens),
          outputTokens: toNumber(usage.output_tokens),
        };
      },
    }),

    anthropic_count_tokens: defineProxyTool(context, {
      id: 'anthropic_count_tokens',
      description: 'Count the input tokens a Messages API request would consume, without generating.',
      inputSchema: z.object({
        model: z.string().min(1),
        messages: z.array(messageInput).min(1),
        system: z.string().optional(),
      }),
      outputSchema: z.object({ inputTokens: z.number() }),
      request: input => ({
        method: 'POST',
        path: 'v1/messages/count_tokens',
        headers,
        body: { model: input.model, messages: input.messages, system: input.system },
      }),
      transform: raw => ({ inputTokens: toNumber(asRecord(raw).input_tokens) }),
    }),

    anthropic_list_models: defineProxyTool(context, {
      id: 'anthropic_list_models',
      description: 'List the Anthropic models available with the connected API key.',
      inputSchema: z.object({
        afterId: z.string().optional().describe('Pagination cursor: model id to start after'),
      }),
      outputSchema: z.object({
        models: z.array(z.object({ id: z.string(), displayName: z.string(), createdAt: z.string() })),
        hasMore: z.boolean(),
      }),
      request: input => ({ method: 'GET', path: 'v1/models', headers, query: { after_id: input.afterId } }),
      transform: raw => {
        const data = asRecord(raw);
        const list = Array.isArray(data.data) ? data.data.map(asRecord) : [];
        return {
          models: list.map(model => ({
            id: String(model.id ?? ''),
            displayName: String(model.display_name ?? ''),
            createdAt: String(model.created_at ?? ''),
          })),
          hasMore: data.has_more === true,
        };
      },
    }),
  };

  return applyAllowTools(tools, options?.allowTools);
}
