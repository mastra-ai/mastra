import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * `structuredOutput.model` hands the finished turn to a separate structuring
 * model (the StructuredOutputProcessor) instead of asking the main model for JSON.
 *
 * Regression classes:
 * - the structuring model sees the tool results of the main turn
 * - the parsed object is stored on the assistant message's `metadata.structuredOutput`
 * - with `useAgent`, the structuring model sees earlier thread history, while the
 *   stored assistant text stays the main model's prose
 *
 * Replaces the hash-matched `structured-output.e2e` and
 * `structured-output-memory.e2e` recordings.
 */

const text = (req: ChatCompletionRequest) =>
  req.messages.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n');
const isStructuring = (req: ChatCompletionRequest) => text(req).includes('Extract and structure');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const structuringModel = (llm: LLMock) =>
  createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })(SCENARIO_MODEL_ID);

describeForAllEngines('AIMock loop scenario: structured output via a structuring model', engine => {
  const getMock = useLoopScenarioAimock();

  it('structures a tool turn with a separate model that sees the tool result', async () => {
    const llm = getMock();
    const calculator = createTool({
      id: 'calculator',
      description: 'Adds two numbers',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => ({ sum: a + b }),
    });
    const schema = z.object({ toolUsed: z.string(), result: z.string(), confidence: z.number() });

    const { chunks, output } = await runLoopScenario({
      engine,
      llm,
      prompt: 'What is 5 + 3? Use the calculator.',
      tools: { calculator },
      structuredOutput: { schema, model: structuringModel(llm) },
      collectChunks: true,
      fixtures: m => {
        m.on(
          { endpoint: 'chat', predicate: req => !isStructuring(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call_calc_1', name: 'calculator', arguments: { a: 5, b: 3 } }] },
        );
        m.on(
          { endpoint: 'chat', predicate: req => !isStructuring(req) && lastIsToolResult(req) },
          { content: 'I used the calculator: 5 + 3 = 8.' },
        );
        m.on(
          { endpoint: 'chat', predicate: isStructuring },
          { content: JSON.stringify({ toolUsed: 'calculator', result: '8', confidence: 0.9 }) },
        );
      },
    });

    expect(await output.object).toEqual({ toolUsed: 'calculator', result: '8', confidence: 0.9 });
    expect(chunks!.filter(c => c.type === 'tool-result').map((c: any) => c.payload.result)).toEqual([{ sum: 8 }]);
    const structuringRequests = llm.getRequests().filter(r => isStructuring(r.body as ChatCompletionRequest));
    expect(structuringRequests).toHaveLength(1);
    expect(text(structuringRequests[0]!.body as ChatCompletionRequest)).toContain('5 + 3 = 8');
  });

  it('stores the structured object on the saved assistant message metadata', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = `so-metadata-${engine}`;
    const resourceId = 'so-metadata-user';
    const schema = z.object({ answer: z.string(), confidence: z.number() });
    const object = { answer: 'Paris', confidence: 0.95 };

    llm.on({ endpoint: 'chat', predicate: req => !isStructuring(req) }, { content: 'The capital of France is Paris.' });
    llm.on({ endpoint: 'chat', predicate: isStructuring }, { content: JSON.stringify(object) });

    const { output } = await runLoopScenario({
      engine,
      llm,
      prompt: 'What is the capital of France?',
      memory,
      threadId,
      resourceId,
      structuredOutput: { schema, model: structuringModel(llm) },
      fixtures: () => {},
    });

    expect(await output.object).toEqual(object);
    await vi.waitFor(async () => {
      const { messages } = await memory.recall({ threadId, resourceId });
      const assistant = messages.filter(m => m.role === 'assistant').at(-1);
      expect(assistant?.content.metadata?.structuredOutput).toEqual(object);
    });
  });

  it('with useAgent, structures from earlier thread history and saves the prose, not the object', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    const threadId = `so-memory-${engine}`;
    const resourceId = 'so-memory-user';
    const shared = await createSharedAgent(llm, {
      instructions: 'You are a concise assistant.',
      memory,
      engine,
    });
    const schema = z.object({ favoriteColor: z.string(), hometown: z.string(), petName: z.string() });
    const profile = { favoriteColor: 'violet', hometown: 'Lisbon', petName: 'Mochi' };
    const STORY = 'Once upon a time a traveller from a coastal city walked a small dog.';

    llm.on({ endpoint: 'chat', predicate: isStructuring }, { content: JSON.stringify(profile) });
    llm.on({ endpoint: 'chat', predicate: req => !isStructuring(req) && /story/i.test(text(req)) }, { content: STORY });
    llm.on({ endpoint: 'chat', predicate: req => !isStructuring(req) }, { content: 'Noted.' });

    for (const fact of ['My favorite color is violet', 'I grew up in Lisbon', 'My dog is named Mochi']) {
      await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: fact,
        memory,
        threadId,
        resourceId,
        fixtures: () => {},
      });
    }

    const { output } = await runLoopScenario({
      engine,
      llm,
      sharedAgent: shared,
      prompt: 'Tell me a story using details I mentioned, without naming them',
      memory,
      threadId,
      resourceId,
      structuredOutput: { schema, model: structuringModel(llm), useAgent: true },
      fixtures: () => {},
    });

    expect(await output.object).toEqual(profile);
    const structuring = llm.getRequests().filter(r => isStructuring(r.body as ChatCompletionRequest));
    expect(structuring).toHaveLength(1);
    const structuringText = text(structuring[0]!.body as ChatCompletionRequest);
    for (const fact of ['violet', 'Lisbon', 'Mochi']) expect(structuringText).toContain(fact);

    await vi.waitFor(async () => {
      const { messages } = await memory.recall({ threadId, resourceId });
      const assistant = messages.filter(m => m.role === 'assistant').at(-1);
      const saved = assistant?.content.parts.flatMap(p => (p.type === 'text' ? [p.text] : [])).join('');
      expect(saved).toBe(STORY);
    });
  });
});
