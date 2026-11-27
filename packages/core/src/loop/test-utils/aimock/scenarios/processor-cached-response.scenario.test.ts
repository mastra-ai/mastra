import { expect, it } from 'vitest';

import type { Processor } from '../../../../processors/index';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Scenario: a processor answers the request from a cache.
 *
 * `processLLMRequest` can return a stored response instead of letting the request go out, which is
 * how a response cache works. The run must replay the stored chunks as the step's output and must
 * not call the provider at all.
 */

const CACHED_TEXT = 'cached response';

// Stored chunks are Mastra stream chunks without the run id, which is attached again at replay.
const cachedChunks = [
  { type: 'stream-start', payload: { warnings: [] } },
  { type: 'response-metadata', payload: { id: 'resp-cached', modelId: 'mock', timestamp: new Date(0) } },
  { type: 'text-start', payload: { id: 'text-1' } },
  { type: 'text-delta', payload: { id: 'text-1', text: CACHED_TEXT } },
  { type: 'text-end', payload: { id: 'text-1' } },
  {
    type: 'finish',
    payload: {
      stepResult: { reason: 'stop' },
      output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      metadata: {},
      messages: { all: [], user: [], nonUser: [] },
    },
  },
];

describeForAllEngines('AIMock scenario: processLLMRequest answers from a cache', engine => {
  const getMock = useLoopScenarioAimock();

  it('replays the cached response and sends nothing to the provider', async () => {
    let cacheLookups = 0;
    const responseCache = {
      id: 'response-cache',
      processLLMRequest: () => {
        cacheLookups++;
        return {
          response: {
            chunks: cachedChunks,
            warnings: [],
            request: { body: 'cached-request' },
            rawResponse: { status: 200 },
          },
        };
      },
    } as unknown as Processor;

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      inputProcessors: [responseCache],
      collectChunks: true,
      fixtures: llm => {
        llm.on({}, { content: 'live response' });
      },
    });

    expect(cacheLookups).toBe(1);
    expect(requests).toEqual([]);
    expect(await output.text).toBe(CACHED_TEXT);
    expect(chunks?.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.payload.text)).toEqual([
      CACHED_TEXT,
    ]);
  });

  it('calls the provider when the cache has no answer', async () => {
    let cacheLookups = 0;
    const responseCache = {
      id: 'response-cache',
      processLLMRequest: () => {
        cacheLookups++;
        return undefined;
      },
    } as unknown as Processor;

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      inputProcessors: [responseCache],
      fixtures: llm => {
        llm.on({}, { content: 'live response' });
      },
    });

    expect(cacheLookups).toBe(1);
    expect(requests).toHaveLength(1);
    expect(await output.text).toBe('live response');
  });
});
