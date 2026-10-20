import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { OutputProcessor } from '../../../../processors/index';
import { createTool } from '../../../../tools/tool';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a guard rejects the model's reply in processOutputStep, either without retry or after
 * the retry budget runs out. The run must end with a tripwire, show the user nothing of the
 * rejected reply, and never save it to the thread, while keeping earlier accepted tool steps.
 * If this breaks, the rejected reply reaches the user or is replayed from memory. (#26048)
 */

const REJECTED = 'REJECTED: this reply must never be shown or remembered.';
const THREAD = 'thread-rejected-reply';
const RESOURCE = 'resource-rejected-reply';

const guard = (retry: boolean): OutputProcessor => ({
  id: 'guard',
  processOutputStep: async ({ text, abort, messageList }: any) => {
    if (text?.includes('REJECTED')) return abort('Not allowed, try again.', { retry });
    return messageList;
  },
});

const lookup = createTool({
  id: 'lookup',
  description: 'lookup',
  inputSchema: z.object({ q: z.string() }),
  execute: async () => ({ found: 'TOOL_RESULT_OK' }),
});

async function savedThread(memory: MockMemory) {
  const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE, perPage: false });
  return messages;
}

async function newMemory() {
  const memory = new MockMemory();
  await memory.createThread({ threadId: THREAD, resourceId: RESOURCE });
  return memory;
}

const CASES = [
  { retry: false, label: 'abort without retry', maxProcessorRetries: undefined, modelCalls: 1 },
  { retry: true, label: 'retries exhausted', maxProcessorRetries: 2, modelCalls: 3 },
] as const;

describeForAllEngines('A rejected processOutputStep reply is dropped and not saved (#26048)', engine => {
  const getMock = useLoopScenarioAimock();

  for (const { retry, label, maxProcessorRetries, modelCalls } of CASES) {
    it(`stream(): ${label}`, async () => {
      const memory = await newMemory();
      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'hello',
        memory,
        threadId: THREAD,
        resourceId: RESOURCE,
        outputProcessors: [guard(retry)],
        ...(maxProcessorRetries ? { maxProcessorRetries } : {}),
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: REJECTED });
        },
      });

      const full = await output.getFullOutput();
      expect(requests).toHaveLength(modelCalls);
      expect(full.tripwire?.reason).toBe('Not allowed, try again.');
      expect(full.text).toBe('');
      expect(JSON.stringify(full.response?.messages ?? [])).not.toContain('REJECTED');
      const saved = await savedThread(memory);
      expect(saved.some(m => m.role === 'user')).toBe(true);
      expect(JSON.stringify(saved)).not.toContain('REJECTED');
    });
  }
});

/** generate() runs on the plain agent only: durable wrappers expose stream() only. */
describe('A rejected processOutputStep reply is dropped through generate() (#26048)', () => {
  const getMock = useLoopScenarioAimock();

  for (const { retry, label, maxProcessorRetries, modelCalls } of CASES) {
    it(`generate(): ${label}`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: REJECTED });
      const memory = await newMemory();
      const { agent } = await createSharedAgent(llm, { memory });

      const result = await agent.generate('hello', {
        memory: { thread: THREAD, resource: RESOURCE },
        outputProcessors: [guard(retry)],
        ...(maxProcessorRetries ? { maxProcessorRetries } : {}),
      });

      expect(llm.getRequests()).toHaveLength(modelCalls);
      expect(result.finishReason).toBe('tripwire');
      expect(result.tripwire?.reason).toBe('Not allowed, try again.');
      expect(result.text).toBe('');
      expect(JSON.stringify(result.response?.messages ?? [])).not.toContain('REJECTED');
      const saved = await savedThread(memory);
      expect(saved.some(m => m.role === 'user')).toBe(true);
      expect(JSON.stringify(saved)).not.toContain('REJECTED');
    });
  }

  it('generate(): keeps an accepted tool step when a later text step is rejected after retries', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [{ name: 'lookup', arguments: '{"q":"x"}' }] });
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: REJECTED });
    const memory = await newMemory();
    const { agent } = await createSharedAgent(llm, { memory, tools: { lookup } });

    const result = await agent.generate('hello', {
      memory: { thread: THREAD, resource: RESOURCE },
      outputProcessors: [guard(true)],
      maxProcessorRetries: 1,
      stopWhen: stepCountIs(5),
    });

    // One tool-call turn, then the rejected reply and its single retry.
    expect(llm.getRequests()).toHaveLength(3);
    expect(result.finishReason).toBe('tripwire');
    expect(result.text).toBe('');
    const saved = JSON.stringify(await savedThread(memory));
    expect(saved).toContain('TOOL_RESULT_OK');
    expect(saved).not.toContain('REJECTED');
  });
});
