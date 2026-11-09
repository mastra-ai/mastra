import { expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { MockMemory } from '../../../../memory/mock';
import type { ChunkType } from '../../../../stream/types';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Regression class: what a failed or cancelled turn leaves in the memory thread.
 *
 * - A provider failure before any output saves the user message and an assistant
 *   message carrying the error, so the thread shows why the turn failed.
 * - An output processor that rewrites the streamed error chunk does not change
 *   the error that is saved.
 * - A reply dropped mid-stream keeps the partial text next to the error part.
 * - A failure that a model retry recovers from leaves no error part behind.
 * - Cancelling before the model sends anything saves only the user message, and
 *   the next turn still sees it.
 */

const PROVIDER_500 = {
  error: { message: 'PERSISTENCE_PROVIDER_BOOM', type: 'server_error', code: 'internal_error' },
  status: 500,
} as const;

const PARTIAL_REPLY = 'Your order shipped on Monday and should arrive by';
const midStreamDrop = { chunkSize: 5, latency: 20, disconnectAfterMs: 150 };

function errorParts(messages: MastraDBMessage[]) {
  return messages.flatMap(message => (message.content.parts ?? []).filter(part => part.type === 'error'));
}

describeForAllEngines('AIMock loop scenario: persistence of failed turns', engine => {
  const getMock = useLoopScenarioAimock();

  it('a provider failure before any output saves the user message and the error', async () => {
    const memory = new MockMemory();
    const threadId = `failed-before-output-${engine}`;
    const resourceId = 'customer-failed';

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'FAILED_BEFORE_OUTPUT_PROMPT',
      memory,
      threadId,
      resourceId,
      maxRetries: 0,
      errorProcessors: [],
      fixtures: llm => {
        llm.onMessage(/.*/, PROVIDER_500);
      },
    });

    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0]!.body?.messages)).toContain('FAILED_BEFORE_OUTPUT_PROMPT');
    expect(await memory.getThreadById({ threadId })).toMatchObject({ id: threadId, resourceId });
    await expect
      .poll(async () => (await memory.recall({ threadId, resourceId })).messages.map(m => m.role))
      .toEqual(['user', 'assistant']);
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(JSON.stringify(messages[0]!.content)).toContain('FAILED_BEFORE_OUTPUT_PROMPT');
    expect(messages[1]!.content.parts.map(part => part.type)).toEqual(['error']);
    expect(JSON.stringify(errorParts(messages))).toContain('PERSISTENCE_PROVIDER_BOOM');
  });

  it('a provider HTTP failure saves its status code and response body with the error', async () => {
    const memory = new MockMemory();
    const threadId = `provider-http-details-${engine}`;
    const resourceId = 'customer-http-details';

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'HTTP_DETAILS_PROMPT',
      memory,
      threadId,
      resourceId,
      maxRetries: 0,
      errorProcessors: [],
      fixtures: llm => {
        llm.onMessage(/.*/, {
          error: { message: 'PROVIDER_400_EXPLANATION', type: 'invalid_request_error' },
          status: 400,
        });
      },
    });

    await expect
      .poll(async () => (await memory.recall({ threadId, resourceId })).messages.map(m => m.role))
      .toEqual(['user', 'assistant']);
    const [errorPart] = errorParts((await memory.recall({ threadId, resourceId })).messages);
    expect(errorPart).toMatchObject({ type: 'error', error: { statusCode: 400 } });
    expect(JSON.parse((errorPart as { error: { responseBody: string } }).error.responseBody)).toMatchObject({
      error: { message: 'PROVIDER_400_EXPLANATION', type: 'invalid_request_error' },
    });
  });

  it('saves the provider error even when an output processor rewrites the streamed error chunk', async () => {
    const memory = new MockMemory();
    const threadId = `rewritten-error-${engine}`;
    const resourceId = 'customer-rewritten';
    const seenErrors: string[] = [];

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Look up my order.',
      memory,
      threadId,
      resourceId,
      maxRetries: 0,
      errorProcessors: [],
      collectChunks: true,
      outputProcessors: [
        {
          id: 'replace-terminal-error-chunk',
          processOutputStream: ({ part }: { part: ChunkType }) => {
            if (part.type !== 'error') return part;
            seenErrors.push(JSON.stringify(part.payload.error));
            return { ...part, payload: { ...part.payload, error: new Error('PROCESSOR_REPLACEMENT') } };
          },
        },
      ],
      fixtures: llm => {
        llm.onMessage(/.*/, PROVIDER_500);
      },
    });

    // Guard: the processor really saw and rewrote the error the caller receives.
    expect(seenErrors).toHaveLength(1);
    expect(JSON.stringify(chunks!.filter(c => c.type === 'error'))).toContain('PROCESSOR_REPLACEMENT');

    await expect.poll(async () => errorParts((await memory.recall({ threadId, resourceId })).messages)).toHaveLength(1);
    const saved = JSON.stringify(errorParts((await memory.recall({ threadId, resourceId })).messages));
    expect(saved).toContain('PERSISTENCE_PROVIDER_BOOM');
    expect(saved).not.toContain('PROCESSOR_REPLACEMENT');
  });

  it('a failure recovered by a model retry saves the recovered reply and no error part', async () => {
    const memory = new MockMemory();
    const threadId = `recovered-${engine}`;
    const resourceId = 'customer-recovered';
    let attempt = 0;

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order?',
      memory,
      threadId,
      resourceId,
      maxRetries: 1,
      errorProcessors: [],
      fixtures: llm => {
        llm.onMessage(/.*/, () => {
          attempt += 1;
          return attempt === 1 ? PROVIDER_500 : { content: 'Recovered: it shipped on Monday.' };
        });
      },
    });

    expect(await output.text).toBe('Recovered: it shipped on Monday.');
    expect(requests).toHaveLength(2);
    await expect
      .poll(async () => (await memory.recall({ threadId, resourceId })).messages.map(m => m.role))
      .toEqual(['user', 'assistant']);
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages[1]!.content.parts.filter(part => part.type === 'text').map(part => part.text)).toEqual([
      'Recovered: it shipped on Monday.',
    ]);
    expect(errorParts(messages)).toEqual([]);
  });

  it('a reply dropped mid-stream keeps the partial text next to the error', async () => {
    const memory = new MockMemory();
    const threadId = `dropped-mid-reply-${engine}`;
    const resourceId = 'customer-dropped';

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order?',
      memory,
      threadId,
      resourceId,
      maxRetries: 0,
      errorProcessors: [],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: PARTIAL_REPLY }, midStreamDrop);
      },
    });

    // Guard: the reply really streamed some text before the connection dropped.
    const streamed = chunks!
      .filter(c => c.type === 'text-delta')
      .map(c => c.payload.text)
      .join('');
    expect(streamed.length).toBeGreaterThan(0);
    expect(streamed.length).toBeLessThan(PARTIAL_REPLY.length);
    expect(chunks!.some(c => c.type === 'error')).toBe(true);

    await expect.poll(async () => errorParts((await memory.recall({ threadId, resourceId })).messages)).toHaveLength(1);
    const { messages } = await memory.recall({ threadId, resourceId });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.content.parts.map(part => part.type)).toEqual(['text', 'error']);
    expect(messages[1]!.content.parts[0]).toMatchObject({ type: 'text', text: streamed });
  });

  it('cancelling before the model sends anything saves only the user message and the next turn sees it', async () => {
    const llm = getMock();
    const controller = new AbortController();
    let attempt = 0;
    llm.onMessage(
      /.*/,
      () => {
        attempt += 1;
        if (attempt === 1) controller.abort();
        return { content: attempt === 1 ? 'never delivered' : 'Second reply.' };
      },
      { latency: 200 },
    );
    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, { engine, memory });
    const threadId = `abort-before-output-${engine}`;
    const resourceId = 'customer-abort-early';

    const first = await agent.stream('MESSAGE_BEFORE_ABORT', {
      memory: { thread: threadId, resource: resourceId },
      abortSignal: controller.signal,
    });
    const firstOutput = isDurableEngineVariant(engine) ? (first as unknown as { output: typeof first }).output : first;
    let firstText = '';
    try {
      for await (const chunk of firstOutput.fullStream) {
        if (chunk.type === 'text-delta') firstText += chunk.payload.text;
      }
    } catch {
      // Durable streams can reject with AbortError after the abort chunk.
    }
    expect(firstText).toBe('');

    await expect
      .poll(async () => (await memory.recall({ threadId, resourceId })).messages.map(m => m.role))
      .toEqual(['user']);
    expect(errorParts((await memory.recall({ threadId, resourceId })).messages)).toEqual([]);

    const second = await agent.stream('MESSAGE_AFTER_ABORT', {
      memory: { thread: threadId, resource: resourceId },
    });
    const secondOutput = isDurableEngineVariant(engine)
      ? (second as unknown as { output: typeof second }).output
      : second;
    expect(await secondOutput.text).toBe('Second reply.');

    const requests = llm.getRequests();
    expect(requests).toHaveLength(2);
    const secondPrompt = JSON.stringify(requests[1]!.body?.messages);
    expect(secondPrompt).toContain('MESSAGE_BEFORE_ABORT');
    expect(secondPrompt).toContain('MESSAGE_AFTER_ABORT');
    await expect
      .poll(async () => (await memory.recall({ threadId, resourceId })).messages.map(m => m.role))
      .toEqual(['user', 'user', 'assistant']);
    expect(errorParts((await memory.recall({ threadId, resourceId })).messages)).toEqual([]);
  });
});
