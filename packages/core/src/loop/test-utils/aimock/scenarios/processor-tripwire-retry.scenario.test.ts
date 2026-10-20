import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { InputProcessor, OutputProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import type { ChunkType } from '../../../../stream/types';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Story: a support agent behind guardrails that can send a draft back for a rewrite
 * (abort with retry), attach typed details to a block (abort metadata), and give up after
 * a retry budget (maxProcessorRetries).
 *
 * If retry breaks, the customer sees the rejected draft, the model is re-sent the draft it
 * was told to drop, or the retry rewrites the prompt prefix so the provider cache misses on
 * every retry. If metadata or processorId break, the app cannot tell which guardrail fired
 * or why.
 */

type WireMessage = { role: string; content: unknown };

const textOf = (message: WireMessage): string =>
  typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

const messagesOf = (request: { body: unknown }) => (request.body as { messages: WireMessage[] }).messages;

const tripwireChunk = (chunks: ChunkType[]) => {
  const tripwires = chunks.flatMap(c => (c.type === 'tripwire' ? [c.payload] : []));
  expect(tripwires).toHaveLength(1);
  return tripwires[0];
};

const REJECTED_JSON = '{"answer":"REJECTED","score":1}';
const ACCEPTED_JSON = '{"answer":"ACCEPTED","score":9}';
const retrySchema = z.object({ answer: z.string(), score: z.number() });

const rejectFirstStructuredAttempt: OutputProcessor = {
  id: 'reject-first-structured-attempt',
  processOutputStep: async ({ text, abort, retryCount, messageList }) => {
    if (retryCount === 0 && text?.includes('REJECTED')) {
      abort('Structured output was rejected, please retry', { retry: true });
    }
    return messageList;
  },
};

describeForAllEngines('Processor tripwire retry, metadata and retry budget', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: abort(reason, { retry, metadata }) in processInput must surface reason, retry,
  // typed metadata and the processor id on the single tripwire chunk, before any model call.
  it('an input block carries its reason, retry flag, typed metadata and processor id', async () => {
    const piiGuard: InputProcessor = {
      id: 'pii-processor',
      processInput: async ({ messages, abort }) => {
        abort('PII detected in input', { retry: true, metadata: { fields: ['email', 'phone'], severity: 'high' } });
        return messages;
      },
    };

    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My email is test@test.com',
      collectChunks: true,
      inputProcessors: [piiGuard],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'unused' });
      },
    });

    expect(requests).toHaveLength(0);
    expect(tripwireChunk(chunks!)).toMatchObject({
      reason: 'PII detected in input',
      retry: true,
      metadata: { fields: ['email', 'phone'], severity: 'high' },
      processorId: 'pii-processor',
    });
  });

  // Technical: abort(reason, { retry, metadata }) from processOutputStream must surface reason,
  // retry, metadata and processor id on the tripwire chunk, and no model text reaches the stream.
  it('a streamed reply blocked mid-stream carries its reason, retry flag, metadata and processor id', async () => {
    const toxicity: OutputProcessor = {
      id: 'toxicity-processor',
      processOutputStream: async ({ part, abort }) => {
        if (part.type === 'text-delta' && part.payload.text?.includes('toxic')) {
          abort('Toxic content detected', { retry: true, metadata: { category: 'hate_speech', confidence: 0.95 } });
        }
        return part;
      },
    };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      collectChunks: true,
      outputProcessors: [toxicity],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'toxic content here' });
      },
    });

    expect(chunks!.map(c => c.type)).not.toContain('text-delta');
    expect(tripwireChunk(chunks!)).toMatchObject({
      reason: 'Toxic content detected',
      retry: true,
      metadata: { category: 'hate_speech', confidence: 0.95 },
      processorId: 'toxicity-processor',
    });
  });

  // Technical: on a first attempt every processor hook receives retryCount 0.
  it('input, stream and result processors all see retryCount 0 on the first attempt', async () => {
    const seen: Record<string, number[]> = { input: [], stream: [], result: [] };
    const counter: OutputProcessor = {
      id: 'retry-count-observer',
      processInput: async ({ messages, retryCount }) => {
        seen.input!.push(retryCount);
        return messages;
      },
      processOutputStream: async ({ part, retryCount }) => {
        if (part.type === 'text-delta') seen.stream!.push(retryCount);
        return part;
      },
      processOutputResult: async ({ messages, retryCount }) => {
        seen.result!.push(retryCount);
        return messages;
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      inputProcessors: [counter],
      outputProcessors: [counter],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'All good' });
      },
    });

    expect(await output.text).toBe('All good');
    expect(seen.input).toEqual([0]);
    expect(seen.result).toEqual([0]);
    expect(seen.stream!.length).toBeGreaterThan(0);
    expect(new Set(seen.stream)).toEqual(new Set([0]));
  });

  // Technical: a processOutputStep retry re-calls the model with the abort reason appended as
  // the last user message (one system message, rejected draft not re-sent); the rejected step
  // keeps its tripwire and the final text is only the accepted reply.
  it('a rejected draft is retried with feedback, never re-sent, and only the accepted reply is returned', async () => {
    const rejected: string[] = [];
    const fabricationDetector: OutputProcessor = {
      id: 'fabrication-detector',
      processOutputStep: async ({ text, abort, retryCount, messageList }) => {
        if (retryCount === 0) {
          rejected.push(text ?? '');
          abort('Fabrication detected, please regenerate', { retry: true });
        }
        return messageList;
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is the capital of France?',
      maxProcessorRetries: 3,
      outputProcessors: [fabricationDetector],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'fabricated response that should be rejected' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'corrected response' });
      },
    });

    expect(rejected).toEqual(['fabricated response that should be rejected']);
    expect(requests).toHaveLength(2);
    const retry = messagesOf(requests[1]!);
    expect(retry.filter(m => m.role === 'system')).toHaveLength(1);
    expect(retry.some(m => m.role === 'assistant' && textOf(m).includes(rejected[0]!))).toBe(false);
    expect(retry.at(-1)!.role).toBe('user');
    expect(textOf(retry.at(-1)!)).toContain('Fabrication detected, please regenerate');

    const full = await output.getFullOutput();
    expect(full.text).toBe('corrected response');
    expect(full.tripwire).toBeUndefined();
    expect(full.steps).toHaveLength(2);
    expect((full.steps[0] as { tripwire?: { reason: string } }).tripwire?.reason).toBe(
      'Fabrication detected, please regenerate',
    );
    expect((full.steps[1] as { tripwire?: unknown }).tripwire).toBeUndefined();
  });

  // Technical: across tool steps and two retries, every request extends the previous one
  // (prompt-cache friendly) and the feedback is the verbatim system-reminder as the last message.
  //
  // Engine gap (durable, evented): on the second retry the request drops the first tool call
  // and its result (call `a`), so request 5 no longer extends request 4 and the provider prompt
  // cache misses (#27561). Deterministic, so it.fails until the durable retry path keeps earlier steps.
  const DROPS_EARLY_TOOL_TURN_ON_SECOND_RETRY = engine === 'durable' || engine === 'evented';
  (DROPS_EARLY_TOOL_TURN_ON_SECOND_RETRY ? it.fails : it)(
    'retries only append to the prompt, so every request extends the previous one',
    async () => {
      const lookup = createTool({
        id: 'lookup',
        description: 'Look up a value',
        inputSchema: z.object({ key: z.string() }),
        execute: async ({ key }) => ({ value: key }),
      });
      const qualityChecker: OutputProcessor = {
        id: 'quality-checker',
        processOutputStep: async ({ text, abort, retryCount, messageList }) => {
          if (retryCount === 0 && text?.includes('bad response')) {
            abort('Response quality too low, please improve', { retry: true });
          }
          return messageList;
        },
      };

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Hello',
        tools: { lookup },
        maxSteps: 10,
        maxProcessorRetries: 3,
        outputProcessors: [qualityChecker],
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'a', name: 'lookup', arguments: { key: 'a' } }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'bad response' });
          llm.on(
            { endpoint: 'chat', sequenceIndex: 2 },
            { toolCalls: [{ id: 'b', name: 'lookup', arguments: { key: 'b' } }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'bad response' });
          llm.on({ endpoint: 'chat', sequenceIndex: 4 }, { content: 'good response' });
        },
      });

      expect(await output.text).toBe('good response');
      expect(requests).toHaveLength(5);
      const prompts = requests.map(messagesOf);

      const feedback = '<system-reminder>Response quality too low, please improve</system-reminder>';
      const feedbackCount = (prompt: WireMessage[]) =>
        prompt.filter(m => m.role === 'user' && textOf(m).includes(feedback)).length;
      expect(feedbackCount(prompts[2]!)).toBe(1);
      expect(feedbackCount(prompts[4]!)).toBe(2);
      expect(prompts[2]!.at(-1)!.role).toBe('user');
      expect(textOf(prompts[2]!.at(-1)!)).toContain(feedback);
      expect(prompts[4]!.at(-1)!.role).toBe('user');
      expect(textOf(prompts[4]!.at(-1)!)).toContain(feedback);

      // Gap-hitting assertion last: see DROPS_EARLY_TOOL_TURN_ON_SECOND_RETRY.
      for (let i = 1; i < prompts.length; i++) {
        expect(prompts[i]!.filter(m => m.role === 'system')).toHaveLength(1);
        expect(prompts[i]!.slice(0, prompts[i - 1]!.length)).toEqual(prompts[i - 1]);
      }
    },
  );

  // Technical: each retry increments retryCount; the processor sees 0, 1, 2 across three calls.
  it('retryCount increments on each retry until the processor accepts', async () => {
    const counts: number[] = [];
    const picky: OutputProcessor = {
      id: 'retry-count-tracking-processor',
      processOutputStep: async ({ abort, retryCount, messageList }) => {
        counts.push(retryCount);
        if (retryCount < 2) abort('Need more retries', { retry: true });
        return messageList;
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      maxProcessorRetries: 5,
      outputProcessors: [picky],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'response 1' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'response 2' });
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'response 3' });
      },
    });

    expect(requests).toHaveLength(3);
    expect(await output.text).toBe('response 3');
    expect(counts).toEqual([0, 1, 2]);
  });

  // Technical: once maxProcessorRetries is spent the run stops with the processor's tripwire.
  it('a guardrail that is never satisfied stops after the retry budget with its tripwire', async () => {
    const neverSatisfied: OutputProcessor = {
      id: 'always-retry-processor',
      processOutputStep: async ({ abort, messageList }) => {
        abort('Never satisfied', { retry: true });
        return messageList;
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      maxProcessorRetries: 2,
      outputProcessors: [neverSatisfied],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'response' });
      },
    });

    expect(requests).toHaveLength(3);
    const full = await output.getFullOutput();
    expect(full.tripwire).toMatchObject({ reason: 'Never satisfied', processorId: 'always-retry-processor' });
  });

  // Technical: with structuredOutput, a retried step must replace the rejected object, so the
  // object promise (captured early or awaited after draining) resolves to the accepted attempt.
  it('a structured answer sent back for a retry resolves to the accepted object', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      collectChunks: true,
      maxProcessorRetries: 3,
      structuredOutput: { schema: retrySchema },
      outputProcessors: [rejectFirstStructuredAttempt],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: REJECTED_JSON });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: ACCEPTED_JSON });
      },
    });

    expect(requests).toHaveLength(2);
    const full = await output.getFullOutput();
    expect(full.tripwire).toBeUndefined();
    expect(full.text).toContain('ACCEPTED');
    expect(full.object).toEqual({ answer: 'ACCEPTED', score: 9 });
    expect(await output.object).toEqual({ answer: 'ACCEPTED', score: 9 });
  });
});

/**
 * generate() and undrained-stream variants run on the plain agent only: the harness drains
 * every engine's stream, and durable wrappers expose stream() only.
 */
describe('Processor retry through generate() and an undrained stream', () => {
  const getMock = useLoopScenarioAimock();

  const structuredFixtures = (llm: ReturnType<typeof getMock>) => {
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: REJECTED_JSON });
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: ACCEPTED_JSON });
  };

  it('generate() returns the accepted structured object, not the rejected attempt', async () => {
    const llm = getMock();
    structuredFixtures(llm);
    const { agent } = await createSharedAgent(llm);

    const result = await agent.generate('Hello', {
      structuredOutput: { schema: retrySchema },
      outputProcessors: [rejectFirstStructuredAttempt],
      maxProcessorRetries: 3,
    });

    expect(llm.getRequests()).toHaveLength(2);
    expect(result.tripwire).toBeUndefined();
    expect(result.object).toEqual({ answer: 'ACCEPTED', score: 9 });
  });

  it('awaiting object without touching fullStream resolves to the accepted attempt', async () => {
    const llm = getMock();
    structuredFixtures(llm);
    const { agent } = await createSharedAgent(llm);

    const stream = await agent.stream('Hello', {
      structuredOutput: { schema: retrySchema },
      outputProcessors: [rejectFirstStructuredAttempt],
      maxProcessorRetries: 3,
    });

    expect(await stream.object).toEqual({ answer: 'ACCEPTED', score: 9 });
    expect(llm.getRequests()).toHaveLength(2);
  });

  it('an object promise captured before the retry settles resolves to the accepted attempt', async () => {
    const llm = getMock();
    structuredFixtures(llm);
    const { agent } = await createSharedAgent(llm);

    const stream = await agent.stream('Hello', {
      structuredOutput: { schema: retrySchema },
      outputProcessors: [rejectFirstStructuredAttempt],
      maxProcessorRetries: 3,
    });
    const objectPromise = stream.object;
    await stream.consumeStream();

    expect(await objectPromise).toEqual({ answer: 'ACCEPTED', score: 9 });
    expect(llm.getRequests()).toHaveLength(2);
  });

  it('generate() retries with feedback and keeps the rejected step tripwire', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'bad response that needs improvement' });
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'improved response' });
    const { agent } = await createSharedAgent(llm);
    const checker: OutputProcessor = {
      id: 'retry-triggering-processor',
      processOutputStep: async ({ text, abort, retryCount, messageList }) => {
        if (retryCount === 0 && text?.includes('bad response')) {
          abort('Response quality too low, please improve', { retry: true });
        }
        return messageList;
      },
    };

    const result = await agent.generate('Hello', { outputProcessors: [checker], maxProcessorRetries: 3 });

    const requests = llm.getRequests();
    expect(requests).toHaveLength(2);
    const retry = messagesOf(requests[1]!);
    expect(retry.filter(m => m.role === 'system')).toHaveLength(1);
    expect(retry.some(m => m.role === 'assistant' && textOf(m).includes('bad response'))).toBe(false);
    expect(retry.at(-1)!.role).toBe('user');
    expect(textOf(retry.at(-1)!)).toContain('Response quality too low');
    expect(result.text).toBe('improved response');
    expect(result.tripwire).toBeUndefined();
    expect(result.steps).toHaveLength(2);
    expect((result.steps[0] as { tripwire?: { reason: string } }).tripwire?.reason).toBe(
      'Response quality too low, please improve',
    );
    expect((result.steps[1] as { tripwire?: unknown }).tripwire).toBeUndefined();
  });
});
