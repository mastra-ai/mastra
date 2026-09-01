import { google } from '@ai-sdk/google-ai6';
import { generateText, jsonSchema, stepCountIs } from '@internal/ai-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { GoogleSchemaCompatLayer } from '@mastra/schema-compat';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createKnowledgeWriteTools } from '../../src/processors/observational-memory/subconscious/knowledge-write-tools';

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

    expect(result.steps[0]?.toolCalls).toHaveLength(1);
    expect(result.steps[0]?.toolCalls?.[0]).toMatchObject({
      toolName: 'knowledge_rename_node',
      input: { node: 'node-1', expectedVersion: 3, name: 'Project Atlas' },
    });
  });

  it('accepts the atomic node-update tool schema', { timeout: 60_000 }, async () => {
    const { model, tools } = await geminiTools();

    const result = await generateText({
      model,
      tools,
      toolChoice: 'auto' as const,
      stopWhen: stepCountIs(2),
      prompt:
        'You are a knowledge curator. Node "node-1" is at version 3, named "Atlas Initiative", and has kind "project". ' +
        'Rename it to "Project Atlas" and set its kind to "initiative" atomically. Call exactly one tool.',
    });

    expect(result.finishReason).not.toBe('error');

    expect(result.steps[0]?.toolCalls).toHaveLength(1);
    expect(result.steps[0]?.toolCalls?.[0]).toMatchObject({
      toolName: 'knowledge_update_node',
      input: { node: 'node-1', expectedVersion: 3, name: 'Project Atlas', kind: 'initiative' },
    });
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

    expect(result.steps[0]?.toolCalls).toHaveLength(1);
    expect(result.steps[0]?.toolCalls?.[0]).toMatchObject({
      toolName: 'knowledge_set_node_kind',
      input: { node: 'node-1', expectedVersion: 3, kind: 'initiative' },
    });
  });
});
