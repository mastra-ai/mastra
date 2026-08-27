import { google } from '@ai-sdk/google';
import { generateText, jsonSchema, stepCountIs } from '@internal/ai-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { InMemoryStore } from '@mastra/core/storage';
import { GoogleSchemaCompatLayer } from '@mastra/schema-compat';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Memory } from '../..';
import { createKnowledgeWriteTools } from '../../processors/observational-memory/subconscious/knowledge-write-tools';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['google']);

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

async function curatorTools() {
  const memory = new Memory({ storage: new InMemoryStore() });
  return createKnowledgeWriteTools(memory, {
    scope,
    sourceThreadId: 'alpha',
    defaultScope: 'resource',
    maxScope: 'resource',
  });
}

/**
 * Gemini validates tool schemas server-side and answers 400 for shapes it dislikes — a class of
 * break no offline assertion can see, because the schema is well-formed JSON Schema either way.
 * These recorded calls send the curator's real tool schemas to the real endpoint, so a future
 * schema edit that Gemini refuses fails here instead of in a user's curation run. See #22337.
 */
describe('Subconscious knowledge write tools against Gemini', () => {
  const mock = createGatewayMock({ exactMatch: true });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  async function geminiTools() {
    const tools = await curatorTools();
    const model = google('gemini-3.1-pro-preview');
    const compat = new GoogleSchemaCompatLayer({
      provider: model.provider,
      modelId: model.modelId,
      supportsStructuredOutputs: true,
    });

    const wired = Object.fromEntries(
      Object.entries(tools).map(([name, tool]) => [
        name,
        {
          description: tool.description ?? name,
          inputSchema: jsonSchema<Record<string, unknown>>(
            standardSchemaToJSONSchema(compat.processToCompatSchema(tool.inputSchema as never), { io: 'input' }),
          ),
          execute: async (input: Record<string, unknown>) => input,
        },
      ]),
    );

    return { model, tools: wired };
  }

  it('accepts every curator write-tool schema', { timeout: 60_000 }, async () => {
    const { model, tools } = await geminiTools();

    const result = await generateText({
      model,
      tools,
      toolChoice: 'auto' as const,
      stopWhen: stepCountIs(2),
      prompt:
        'You are a knowledge curator. Node "node-1" is at version 3 and is named "Atlas Initiative". ' +
        'Rename it to "Project Atlas". Call exactly one tool.',
    });

    // The assertion that matters is that the request was accepted at all: a schema Gemini rejects
    // never reaches this line, it throws a 400 during generateText.
    expect(result.finishReason).not.toBe('error');

    const toolCall = result.steps[0]?.toolCalls?.[0];
    expect(toolCall?.toolName).toBe('knowledge_rename_node');
    expect((toolCall?.input as { name?: unknown }).name).toEqual(expect.any(String));
  });

  it('accepts the node-kind tool schema', { timeout: 60_000 }, async () => {
    const { model, tools } = await geminiTools();

    const result = await generateText({
      model,
      tools,
      toolChoice: 'auto' as const,
      stopWhen: stepCountIs(2),
      prompt:
        'You are a knowledge curator. Node "node-1" is at version 3 and is mis-categorised. ' +
        'Set its kind to "initiative". Call exactly one tool.',
    });

    expect(result.finishReason).not.toBe('error');

    const toolCall = result.steps[0]?.toolCalls?.[0];
    expect(toolCall?.toolName).toBe('knowledge_set_node_kind');
    expect((toolCall?.input as { kind?: unknown }).kind).toEqual(expect.any(String));
  });
});
