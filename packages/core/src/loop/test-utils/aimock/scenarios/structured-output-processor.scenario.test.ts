import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * `structuredOutput.model` paths of the StructuredOutputProcessor that
 * `structured-output-model.scenario.test.ts` does not reach:
 * - `generate()` keeps the main model's prose as `text` and returns the
 *   structuring model's nested object as `object`
 * - `errorStrategy: 'fallback'` returns `fallbackValue` when the structuring
 *   model call itself fails, and keeps the main model's prose
 * - `jsonPromptInjection: true` sends the schema to the structuring model in
 *   the prompt instead of `response_format`
 *
 * Replaces the hash-matched `agent-processor.e2e` recordings.
 */

const requestText = (req: ChatCompletionRequest) =>
  req.messages.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n');
const isStructuring = (req: ChatCompletionRequest) => requestText(req).includes('Extract and structure');
const structuringModel = (llm: LLMock) =>
  createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` }).chat(SCENARIO_MODEL_ID);
const structuringRequests = (llm: LLMock) =>
  llm.getRequests().flatMap(r => (r.body && isStructuring(r.body) ? [r.body] : []));

const ideaSchema = z.object({
  idea: z.string(),
  category: z.enum(['technology', 'business', 'art', 'science', 'other']),
  feasibility: z.number().min(1).max(10),
  resources: z.array(z.string()),
});
const IDEA_PROSE = 'Restaurants can track leftovers with smart scales and donate surplus food to local shelters.';
const IDEA = {
  idea: 'Smart scales that track leftovers and route surplus to shelters',
  category: 'technology',
  feasibility: 7,
  resources: ['smart scales', 'shelter partnerships'],
};

describe('AIMock loop scenario: structuring model on the generate() path', () => {
  const getMock = useLoopScenarioAimock();

  it('returns the main prose as text and the nested object from the structuring model', async () => {
    const llm = getMock();
    const articleSchema = z.object({
      title: z.string(),
      summary: z.string(),
      keyPoints: z.array(z.object({ point: z.string(), importance: z.number().min(1).max(5) })),
      metadata: z.object({
        topics: z.array(z.string()),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        estimatedReadTime: z.number(),
      }),
    });
    const prose = 'Machine learning trains algorithms on data. Beginners should start with linear regression.';
    const article = {
      title: 'Machine learning basics',
      summary: 'Machine learning trains algorithms to find patterns in data.',
      keyPoints: [{ point: 'Start with linear regression', importance: 4 }],
      metadata: { topics: ['machine learning'], difficulty: 'beginner', estimatedReadTime: 2 },
    };
    llm.on({ endpoint: 'chat', predicate: req => !isStructuring(req) }, { content: prose });
    llm.on({ endpoint: 'chat', predicate: isStructuring }, { content: JSON.stringify(article) });

    const { agent } = await createSharedAgent(llm);
    const result = await agent.generate('Analyze this article about machine learning.', {
      structuredOutput: { schema: articleSchema, model: structuringModel(llm), errorStrategy: 'strict' },
    });

    expect(result.text).toBe(prose);
    expect(result.object).toEqual(article);
    expect(structuringRequests(llm).map(requestText)).toEqual([expect.stringContaining(prose)]);
  });

  it('returns the main prose and fallbackValue when the structuring model call fails', async () => {
    const llm = getMock();
    const schema = z.object({ impossible: z.literal('exact_match_required'), number: z.number().min(1000).max(1000) });
    const fallbackValue: z.infer<typeof schema> = { impossible: 'exact_match_required', number: 1000 };
    const prose = 'It is sunny and warm today, a great day for a walk.';
    llm.on({ endpoint: 'chat', predicate: req => !isStructuring(req) }, { content: prose });
    llm.on(
      { endpoint: 'chat', predicate: isStructuring },
      { error: { message: 'structuring model failed', type: 'invalid_request_error' }, status: 400 },
    );

    const { agent } = await createSharedAgent(llm);
    const result = await agent.generate('Tell me about the weather today in a casual way.', {
      structuredOutput: { schema, model: structuringModel(llm), errorStrategy: 'fallback', fallbackValue },
    });

    expect(result.text).toBe(prose);
    expect(result.object).toEqual(fallbackValue);
    expect(structuringRequests(llm).length).toBeGreaterThan(0);
  });
});

describeForAllEngines('AIMock loop scenario: structuring model error strategy and prompt injection', engine => {
  const getMock = useLoopScenarioAimock();

  it('fallback returns fallbackValue when the structuring model call fails', async () => {
    const llm = getMock();
    const schema = z.object({ impossible: z.literal('exact_match_required'), number: z.number().min(1000).max(1000) });
    const fallbackValue: z.infer<typeof schema> = { impossible: 'exact_match_required', number: 1000 };
    const prose = 'It is sunny and warm today, a great day for a walk.';

    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Tell me about the weather today in a casual way.',
      collectChunks: true,
      structuredOutput: { schema, model: structuringModel(llm), errorStrategy: 'fallback', fallbackValue },
      fixtures: m => {
        m.on({ endpoint: 'chat', predicate: req => !isStructuring(req) }, { content: prose });
        m.on(
          { endpoint: 'chat', predicate: isStructuring },
          { error: { message: 'structuring model failed', type: 'invalid_request_error' }, status: 400 },
        );
      },
    });

    expect(await output.text).toBe(prose);
    expect(await output.object).toEqual(fallbackValue);
    expect(chunks?.filter(c => c.type === 'error')).toEqual([]);
    expect(structuringRequests(llm).length).toBeGreaterThan(0);
  });

  it.each([
    { jsonPromptInjection: true, responseFormat: undefined, injected: true },
    { jsonPromptInjection: false, responseFormat: 'json_schema', injected: false },
  ])(
    'jsonPromptInjection: $jsonPromptInjection controls where the structuring schema travels',
    async ({ jsonPromptInjection, responseFormat, injected }) => {
      const llm = getMock();

      const { output } = await runLoopScenario({
        engine,
        llm,
        prompt: 'Come up with an innovative solution for reducing food waste in restaurants.',
        structuredOutput: { schema: ideaSchema, model: structuringModel(llm), jsonPromptInjection },
        fixtures: m => {
          m.on({ endpoint: 'chat', predicate: req => !isStructuring(req) }, { content: IDEA_PROSE });
          m.on({ endpoint: 'chat', predicate: isStructuring }, { content: JSON.stringify(IDEA) });
        },
      });

      expect(await output.text).toBe(IDEA_PROSE);
      expect(await output.object).toEqual(IDEA);
      const structuring = structuringRequests(llm);
      expect(structuring).toHaveLength(1);
      const [request] = structuring;
      expect(request?.response_format?.type).toBe(responseFormat);
      // The structuring agent's own instructions always describe the schema; only
      // prompt injection appends the machine-readable 'JSON schema:' block.
      expect(requestText(request ?? { model: '', messages: [] }).includes('JSON schema:')).toBe(injected);
    },
  );
});
