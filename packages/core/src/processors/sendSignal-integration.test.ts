import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import { isTransientSignalMessage } from '../agent/signals';
import type { IMastraLogger } from '../logger';
import { ProcessorRunner } from './runner';
import type { ProcessorStreamWriter } from './index';

const mockLogger: IMastraLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trackException: vi.fn(),
  getTransports: vi.fn(() => []),
  listLogs: vi.fn(() => []),
  listLogsByRunId: vi.fn(() => []),
} as any;

/**
 * Extract flattened text from a prompt message's content (string or parts array).
 */
function extractPromptText(message: { role: string; content: unknown }): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');
  }
  return '';
}

describe('sendSignal integration through ProcessorRunner', () => {
  let messageList: MessageList;

  beforeEach(() => {
    messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add([{ role: 'user', content: 'hello' }], 'input');
  });

  it('signal from processInputStep appears in the LLM prompt', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'signal-sender',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'Remember to follow AGENTS.md instructions.',
              attributes: { type: 'dynamic-agents-md', path: '/repo/AGENTS.md' },
              metadata: { path: '/repo/AGENTS.md', type: 'dynamic-agents-md' },
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer: { custom: async () => {} },
    });

    // Signal should be in the DB message list
    const dbMessages = messageList.get.all.db();
    const signalMessages = dbMessages.filter(m => m.role === 'signal');
    expect(signalMessages).toHaveLength(1);
    expect(signalMessages[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'Remember to follow AGENTS.md instructions.' }),
    );

    // Signal should appear in the LLM prompt as a user message with XML markup
    const promptMessages = await messageList.get.all.aiV5.prompt();
    const userMessages = promptMessages.filter((m: any) => m.role === 'user');
    const signalInPrompt = userMessages.find((m: any) => {
      const text = extractPromptText(m);
      return text.includes('system-reminder') && text.includes('AGENTS.md');
    });
    expect(signalInPrompt).toBeDefined();
  });

  it('signal metadata is preserved through real MessageList round-trip', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'metadata-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'Check this out',
              attributes: { type: 'dynamic-agents-md', path: '/project/AGENTS.md' },
              metadata: { path: '/project/AGENTS.md', type: 'dynamic-agents-md' },
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer: { custom: async () => {} },
    });

    const signalMsg = messageList.get.all.db().find(m => m.role === 'signal');
    expect(signalMsg).toBeDefined();

    // Verify metadata.signal is preserved with the right structure
    const signalMeta = signalMsg!.content.metadata?.signal as Record<string, unknown> | undefined;
    expect(signalMeta).toBeDefined();
    expect(signalMeta!.type).toBe('reactive');
    expect(signalMeta!.tagName).toBe('system-reminder');
    expect(signalMeta!.attributes).toEqual(
      expect.objectContaining({ type: 'dynamic-agents-md', path: '/project/AGENTS.md' }),
    );
    expect(signalMeta!.metadata).toEqual(
      expect.objectContaining({ path: '/project/AGENTS.md', type: 'dynamic-agents-md' }),
    );
  });

  it('sendSignal emits a data part to the stream writer', async () => {
    const chunks: unknown[] = [];
    const writer: ProcessorStreamWriter = {
      custom: async chunk => {
        chunks.push(chunk);
      },
    };

    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'stream-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'stream test',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        type: 'data-signal',
        data: expect.objectContaining({
          type: 'reactive',
          tagName: 'system-reminder',
          contents: 'stream test',
        }),
      }),
    );
  });

  it('sendSignal rotates the response message ID and updates the step result', async () => {
    const rotateResponseMessageId = vi.fn(() => 'rotated-id');

    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'rotate-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'rotated',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    const result = await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId,
      writer: { custom: async () => {} },
    });

    // rotateResponseMessageId was invoked
    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);

    // The step result's messageId reflects the rotated value, proving the
    // rotation propagated to the step state (not just the callback invocation).
    expect(result.messageId).toBe('rotated-id');
  });

  it('multiple sendSignal calls from different processors are all preserved', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'signal-1',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'first reminder',
              attributes: { path: '/a/AGENTS.md' },
            });
          },
        },
        {
          id: 'signal-2',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'second reminder',
              attributes: { path: '/b/AGENTS.md' },
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: vi.fn(() => `rotated-${Math.random()}`),
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(2);

    // Both signals should also appear in the LLM prompt
    const promptMessages = await messageList.get.all.aiV5.prompt();
    const signalTexts = promptMessages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => extractPromptText(m))
      .filter((t: string) => t.includes('system-reminder'));
    expect(signalTexts).toHaveLength(2);
  });

  it('sendSignal is available in processOutputResult context', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [
        {
          id: 'output-signal',
          processOutputResult: async ({ sendSignal, messages }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'output context signal',
            });
            return messages;
          },
        },
      ],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runOutputProcessors(messageList, undefined, undefined, 0, { custom: async () => {} });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'output context signal' }),
    );
  });

  it('sendSignal is available in processAPIError context', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      errorProcessors: [
        {
          id: 'error-signal',
          processAPIError: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'error context signal',
            });
            return { retry: false };
          },
        },
      ],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessAPIError({
      error: new Error('test error'),
      messages: messageList.get.all.db(),
      messageList,
      stepNumber: 0,
      steps: [],
      retryCount: 0,
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'error context signal' }),
    );
  });

  it('sendSignal without writer still adds message to the list', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'no-writer-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'no writer test',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      // No writer provided
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
  });

  it('sendSignal without rotateResponseMessageId still adds signal', async () => {
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'no-rotate-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'no rotate test',
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      // No rotateResponseMessageId
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(expect.objectContaining({ type: 'text', text: 'no rotate test' }));
  });

  it('threads transient: true from a processor sendSignal through to the DB message', async () => {
    // Regression: MessageList.addSignal rebuilds the signal via createSignal, so it must forward
    // the transient flag. Otherwise transient signals sent from a processor (the main use case)
    // lose the flag before toDBMessage() and get persisted.
    const runner = new ProcessorRunner({
      inputProcessors: [
        {
          id: 'transient-signal',
          processInputStep: async ({ sendSignal }) => {
            await sendSignal?.({
              type: 'system-reminder',
              contents: 'transient steering reminder',
              transient: true,
            });
          },
        },
      ],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 0,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    // The flag survived addSignal → the save-time filters will drop this from storage.
    expect((signals[0]!.content.metadata?.signal as Record<string, unknown>).transient).toBe(true);
    expect(isTransientSignalMessage(signals[0]!)).toBe(true);
  });

  describe('transient signals are deduplicated and kept last', () => {
    const MARKER = 'stay on the current task';

    /**
     * Drive N steps of one turn through the same runner and MessageList, measuring the
     * prompt as the model would receive it: right after the step's processors run, and
     * before the loop appends the assistant turn that follows.
     */
    async function runSteps(runner: ProcessorRunner, steps: number) {
      const seen: { copies: number; lastIndex: number; total: number }[] = [];
      for (let step = 0; step < steps; step++) {
        // Each step but the first is preceded by the previous step's assistant turn.
        if (step > 0) {
          messageList.add([{ role: 'assistant', content: `step ${step - 1}` }], 'response');
        }

        await runner.runProcessInputStep({
          messageList,
          stepNumber: step,
          steps: [],
          model: {} as any,
          tools: {},
          retryCount: 0,
          messageId: `response-${step}`,
          writer: { custom: async () => {} },
        });

        const prompt = messageList.get.all.aiV5.prompt();
        const texts = prompt.map(extractPromptText);
        seen.push({
          copies: texts.filter(t => t.includes(MARKER)).length,
          lastIndex: texts.reduce((acc, t, i) => (t.includes(MARKER) ? i : acc), -1),
          total: prompt.length,
        });
      }
      return seen;
    }

    function makeRunner(returnMode: 'nothing' | 'messageList' | 'ctxMessages') {
      return new ProcessorRunner({
        inputProcessors: [
          {
            id: 'steering-reminder',
            processInputStep: async (args: any) => {
              await args.sendSignal?.({ type: 'reactive', contents: MARKER, transient: true });
              if (returnMode === 'messageList') return args.messageList;
              if (returnMode === 'ctxMessages') return args.messages;
              return undefined;
            },
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });
    }

    it('keeps exactly one copy across the steps of a turn', async () => {
      const seen = await runSteps(makeRunner('nothing'), 4);

      expect(seen.map(s => s.copies)).toEqual([1, 1, 1, 1]);
      expect(messageList.get.all.db().filter(m => m.role === 'signal')).toHaveLength(1);
    });

    it('re-emits the reminder as the last prompt message on every step', async () => {
      const seen = await runSteps(makeRunner('nothing'), 4);

      // The reminder is always the final entry, so the model reads it last.
      expect(seen.every(s => s.lastIndex === s.total - 1)).toBe(true);
    });

    it('reuses the same stable id instead of minting a new one per step', async () => {
      await runSteps(makeRunner('nothing'), 3);

      const signals = messageList.get.all.db().filter(m => m.role === 'signal');
      expect(signals).toHaveLength(1);
      expect(signals[0]!.id).toBe('transient:steering-reminder:system-reminder');
    });

    it('behaves the same when the processor returns the messageList it mutated', async () => {
      const seen = await runSteps(makeRunner('messageList'), 4);

      expect(seen.map(s => s.copies)).toEqual([1, 1, 1, 1]);
      expect(seen.every(s => s.lastIndex === s.total - 1)).toBe(true);
    });

    it('does not duplicate the reminder when the processor returns the ctx.messages snapshot', async () => {
      // Returning the pre-call snapshot makes the runner re-apply it, which reverts the
      // reposition — but the stable id means the row is replaced, never duplicated.
      const seen = await runSteps(makeRunner('ctxMessages'), 4);

      expect(seen.map(s => s.copies)).toEqual([1, 1, 1, 1]);
      expect(messageList.get.all.db().filter(m => m.role === 'signal')).toHaveLength(1);
    });

    it('leaves a non-transient signal untouched', async () => {
      const runner = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'persisted-reminder',
            processInputStep: async ({ sendSignal }: any) => {
              await sendSignal?.({ type: 'reactive', contents: MARKER });
            },
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const seen = await runSteps(runner, 3);

      // No stable id and no removal: the pre-existing accumulate-per-step behaviour stands.
      expect(seen.map(s => s.copies)).toEqual([1, 2, 3]);
    });
  });
});
