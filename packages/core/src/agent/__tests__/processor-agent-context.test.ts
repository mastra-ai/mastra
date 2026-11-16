/**
 * Every input processor in a chain receives the running agent (#28349).
 *
 * An agent with two or more input processors runs them as chained workflow
 * steps. Only the first step's input comes from the processor runner, which
 * sets `agent`; each later step's input is the previous step's output, which
 * must carry `agent` forward.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Processor } from '../../processors';
import { Agent } from '../agent';

describe('chained input processors receive the running agent', () => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterEach(() => {
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });

  afterAll(async () => {
    await llm.stop();
  });

  function buildAgent(received: Array<[string, unknown]>) {
    const recorder = (id: string): Processor => ({
      id,
      processInput: ({ agent, messages }) => {
        received.push([id, agent]);
        return messages;
      },
    });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    llm.on({ endpoint: 'chat' }, { content: 'Hello back.' });

    return new Agent({
      id: 'chained-input-processor-agent',
      name: 'chained-input-processor-agent',
      instructions: 'Reply.',
      model: openai('gpt-4o-mini'),
      inputProcessors: [recorder('first'), recorder('second'), recorder('third')],
    });
  }

  it('generate', async () => {
    const received: Array<[string, unknown]> = [];
    const agent = buildAgent(received);

    const result = await agent.generate('hello');

    expect(result.text).toBe('Hello back.');
    expect(received.map(([id, a]) => [id, a === agent])).toEqual([
      ['first', true],
      ['second', true],
      ['third', true],
    ]);
  });

  it('stream', async () => {
    const received: Array<[string, unknown]> = [];
    const agent = buildAgent(received);

    const output = await agent.stream('hello');

    expect(await output.text).toBe('Hello back.');
    expect(received.map(([id, a]) => [id, a === agent])).toEqual([
      ['first', true],
      ['second', true],
      ['third', true],
    ]);
  });
});
