import { expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../../memory';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { RequestContext } from '../../../../request-context';
import type { ChunkType } from '../../../../stream/types';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Input processor pipeline: how a chain of input processors runs before the model request.
 *
 * Several processors run in the order they are declared, each seeing the previous one's output.
 * `processLLMRequest` rewrites the provider prompt after `processInput`. An `abort()` stops the
 * chain, skips the model, and surfaces a tripwire (with a default reason when none is given)
 * without persisting anything to memory. Processors can also be resolved per request from the
 * request context.
 */

const textMessage = (text: string): MastraDBMessage => ({
  id: crypto.randomUUID(),
  role: 'user',
  content: { format: 2, parts: [{ type: 'text', text }] },
  createdAt: new Date(),
});

const serializedMessages = (request: { body?: any } | undefined) => JSON.stringify(request?.body?.messages ?? []);

describeForAllEngines('AIMock loop scenario: input processor pipeline', engine => {
  const getMock = useLoopScenarioAimock();

  it('runs input processors in sequence, in declared order, before the model request', async () => {
    const seen: string[] = [];
    const first: Processor = {
      id: 'first-processor',
      processInput: async ({ messages }) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        seen.push('first');
        return [...messages, textMessage('FIRST_MARKER')];
      },
    };
    const second: Processor = {
      id: 'second-processor',
      processInput: ({ messages }) => {
        // Sequential: the async first processor has finished and its message is visible here.
        seen.push(JSON.stringify(messages).includes('FIRST_MARKER') ? 'second-after-first' : 'second-before-first');
        return [...messages, textMessage('SECOND_MARKER')];
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello pipeline',
      inputProcessors: [first, second],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Pipeline reply.' });
      },
    });

    expect(await output.text).toContain('Pipeline reply.');
    expect(seen).toEqual(['first', 'second-after-first']);
    expect(requests).toHaveLength(1);
    const serialized = serializedMessages(requests[0]);
    expect(serialized.indexOf('FIRST_MARKER')).toBeGreaterThan(-1);
    expect(serialized.indexOf('SECOND_MARKER')).toBeGreaterThan(serialized.indexOf('FIRST_MARKER'));
  });

  it('lets processLLMRequest rewrite the provider prompt after processInput', async () => {
    let llmRequestCalls = 0;
    const inputProcessor: Processor = {
      id: 'input-processor',
      processInput: ({ messages }) => [...messages, textMessage('INPUT_PROCESSOR_MARKER')],
    };
    const requestProcessor: Processor = {
      id: 'request-processor',
      processLLMRequest: async ({ prompt }) => {
        llmRequestCalls += 1;
        return {
          prompt: prompt.map(message =>
            message.role === 'user'
              ? { ...message, content: [{ type: 'text' as const, text: 'REQUEST_PROCESSOR_MARKER' }] }
              : message,
          ),
        };
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Original user text',
      inputProcessors: [inputProcessor, requestProcessor],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Rewritten reply.' });
      },
    });

    expect(await output.text).toContain('Rewritten reply.');
    expect(llmRequestCalls).toBe(1);
    expect(requests).toHaveLength(1);
    const serialized = serializedMessages(requests[0]);
    expect(serialized).toContain('REQUEST_PROCESSOR_MARKER');
    expect(serialized).not.toContain('INPUT_PROCESSOR_MARKER');
    expect(serialized).not.toContain('Original user text');
  });

  it('reports a default tripwire reason when abort() is called without one', async () => {
    const abortProcessor: Processor = {
      id: 'abort-processor',
      processInput: ({ abort }) => {
        abort();
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'This should be aborted',
      inputProcessors: [abortProcessor],
      fixtures: llm => {
        llm.onMessage(/.*/, { content: 'The model should never run.' });
      },
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of output.fullStream as AsyncIterable<ChunkType>) {
      chunks.push(chunk);
    }

    const tripwire = chunks.find(chunk => chunk.type === 'tripwire') as { payload?: any } | undefined;
    expect(tripwire, 'expected a tripwire chunk').toBeDefined();
    expect(tripwire?.payload?.reason).toBe('Tripwire triggered by abort-processor');
    expect(chunks.some(chunk => chunk.type === 'text-delta')).toBe(false);
    expect(requests).toHaveLength(0);
    expect(await output.text).toBe('');

    const fullOutput = await output.getFullOutput();
    expect(fullOutput.tripwire?.reason).toBe('Tripwire triggered by abort-processor');
  });

  it('does not run later processors once an earlier one aborts', async () => {
    let laterProcessorRan = false;
    const abortFirst: Processor = {
      id: 'abort-first',
      processInput: ({ abort }) => {
        abort('Stop here');
      },
    };
    const later: Processor = {
      id: 'later-processor',
      processInput: ({ messages }) => {
        laterProcessorRan = true;
        return [...messages, textMessage('LATER_MARKER')];
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Stop at the first processor',
      inputProcessors: [abortFirst, later],
      fixtures: llm => {
        llm.onMessage(/.*/, { content: 'The model should never run.' });
      },
    });

    const fullOutput = await output.getFullOutput();
    expect(fullOutput.tripwire?.reason).toBe('Stop here');
    expect(laterProcessorRan).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it('resolves function-based input processors from the request context', async () => {
    const shared = await createSharedAgent(getMock(), {
      engine,
      inputProcessors: ({ requestContext }: { requestContext: RequestContext }) => [
        {
          id: 'dynamic-processor',
          processInput: ({ messages }: { messages: MastraDBMessage[] }) => [
            ...messages,
            textMessage(`dynamic: ${requestContext.get('processorMessage') ?? 'DEFAULT_MARKER'}`),
          ],
        },
      ],
    });

    const requestContext = new RequestContext();
    requestContext.set('processorMessage', 'DYNAMIC_MARKER');

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Hello dynamic processors',
      requestContext,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Dynamic reply.' });
      },
    });

    expect(await output.text).toContain('Dynamic reply.');
    expect(requests).toHaveLength(1);
    const serialized = serializedMessages(requests[0]);
    expect(serialized).toContain('dynamic: DYNAMIC_MARKER');
    expect(serialized).not.toContain('DEFAULT_MARKER');
  });

  it('persists nothing to the memory thread when an input processor trips the wire', async () => {
    const memory = new MockMemory();
    const threadId = 'tripwire-thread';
    const resourceId = 'tripwire-resource';
    const blockAll: Processor = {
      id: 'tripwire-abort',
      processInput: ({ abort }) => {
        abort('Blocked by policy');
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'blocked request',
      memory,
      threadId,
      resourceId,
      inputProcessors: [blockAll],
      fixtures: llm => {
        llm.onMessage(/.*/, { content: 'The model should never run.' });
      },
    });

    for await (const _chunk of output.fullStream) {
      // drain
    }
    const fullOutput = await output.getFullOutput();
    expect(fullOutput.tripwire?.reason).toBe('Blocked by policy');
    expect(requests).toHaveLength(0);

    // The tripwire bails before the model runs and before anything is saved, so the thread
    // holds neither the blocked user message nor a terminal error part.
    const recalled = await memory.recall({ threadId, resourceId });
    expect(recalled?.messages ?? []).toEqual([]);
  });
});
