import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { ProcessInputArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { StorageThreadType } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateThreadTitleMock = vi.hoisted(() => vi.fn());
vi.mock('@mastra/code-sdk', () => ({
  generateThreadTitle: (options: { prompt: string }) => generateThreadTitleMock(options),
}));

import { createThreadTitleGenerator, FactoryThreadTitleProcessor, type ThreadTitleThreads } from './thread-title.js';

function userMessage(text: string): MastraDBMessage {
  return {
    id: `msg-${Math.random()}`,
    role: 'user',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  } as unknown as MastraDBMessage;
}

function assistantMessage(): MastraDBMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'Working on it.' }] },
  } as unknown as MastraDBMessage;
}

function threadRow(title?: string): StorageThreadType {
  return { id: 'thread-1', resourceId: 'resource-1', title, createdAt: new Date(), updatedAt: new Date() };
}

function createThreads({ title }: { title?: string } = {}) {
  let current = threadRow(title);
  const threads: ThreadTitleThreads & { getThreadById: ReturnType<typeof vi.fn>; setTitle(title: string): void } = {
    getThreadById: vi.fn(async () => current),
    updateThread: vi.fn(async ({ title: next }: { title?: string }) => {
      current = { ...current, title: next };
      return current;
    }),
    setTitle(next: string) {
      current = { ...current, title: next };
    },
  };
  return threads;
}

function createProcessor({
  threads,
  generateTitle = () => Promise.resolve('Login redirect fix'),
}: {
  threads: ThreadTitleThreads;
  generateTitle?: () => Promise<string | undefined>;
}) {
  const generateTitleMock = vi.fn(generateTitle);
  const processor = new FactoryThreadTitleProcessor({
    generateTitle: generateTitleMock,
    threads: () => Promise.resolve(threads),
  });
  return { processor, generateTitle: generateTitleMock };
}

function inputArgs(messages: MastraDBMessage[], requestContext?: RequestContext): ProcessInputArgs {
  return {
    messages,
    requestContext,
    abortSignal: undefined,
    state: {},
    systemMessages: [],
    retryCount: 0,
  } as unknown as ProcessInputArgs;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FactoryThreadTitleProcessor', () => {
  it('names an untitled thread from the first user message and returns messages untouched', async () => {
    const threads = createThreads();
    const { processor, generateTitle } = createProcessor({ threads });
    const messages = [userMessage('Fix the login redirect loop')];

    await expect(processor.processInput(inputArgs(messages))).resolves.toBe(messages);

    await vi.waitFor(() =>
      expect(threads.updateThread).toHaveBeenCalledWith({ id: 'thread-1', title: 'Login redirect fix' }),
    );
    expect(generateTitle).toHaveBeenCalledWith('Fix the login redirect loop', undefined);
  });

  it('passes the run request context to the generator so tenant credentials resolve', async () => {
    const threads = createThreads();
    const { processor, generateTitle } = createProcessor({ threads });
    const requestContext = {} as RequestContext;

    await processor.processInput(inputArgs([userMessage('hello')], requestContext));
    await vi.waitFor(() => expect(threads.updateThread).toHaveBeenCalled());

    expect(generateTitle).toHaveBeenCalledWith('hello', requestContext);
  });

  it('leaves titled threads alone', async () => {
    const threads = createThreads({ title: 'Issue #12: Login loop' });
    const { processor, generateTitle } = createProcessor({ threads });

    await processor.processInput(inputArgs([userMessage('hello')]));
    await Promise.resolve();

    expect(generateTitle).not.toHaveBeenCalled();
    expect(threads.updateThread).not.toHaveBeenCalled();
  });

  it('keeps a title the user set while generation was in flight', async () => {
    const threads = createThreads();
    const { processor } = createProcessor({
      threads,
      generateTitle: async () => {
        // The user renames through another surface while the request runs.
        threads.setTitle('My own name');
        return 'Login redirect fix';
      },
    });

    await processor.processInput(inputArgs([userMessage('hello')]));
    await vi.waitFor(() => expect(threads.getThreadById).toHaveBeenCalledTimes(2));

    expect(threads.updateThread).not.toHaveBeenCalled();
  });

  it('generates at most once per thread while a generation is running', async () => {
    const threads = createThreads();
    let releaseGeneration: ((title: string | undefined) => void) | undefined;
    const generationGate = new Promise<string | undefined>(resolve => {
      releaseGeneration = resolve;
    });
    const { processor, generateTitle } = createProcessor({ threads, generateTitle: () => generationGate });

    await processor.processInput(inputArgs([userMessage('first')]));
    await processor.processInput(inputArgs([userMessage('second'), assistantMessage()]));
    releaseGeneration?.('A title');
    await vi.waitFor(() => expect(threads.updateThread).toHaveBeenCalled());

    expect(generateTitle).toHaveBeenCalledTimes(1);
  });

  it('skips runs without a user message or without a memory store', async () => {
    const noUserThreads = createThreads();
    const { processor: noUserProcessor, generateTitle: noUserGenerate } = createProcessor({
      threads: noUserThreads,
    });
    await noUserProcessor.processInput(inputArgs([assistantMessage()]));
    await Promise.resolve();
    expect(noUserGenerate).not.toHaveBeenCalled();

    const missingStoreGenerate = vi.fn(() => Promise.resolve('Titled'));
    const missingStoreProcessor = new FactoryThreadTitleProcessor({
      generateTitle: missingStoreGenerate,
      threads: () => Promise.resolve(undefined),
    });
    await missingStoreProcessor.processInput(inputArgs([userMessage('hello')]));
    await Promise.resolve();
    expect(missingStoreGenerate).not.toHaveBeenCalled();
  });

  it('warns instead of throwing when generation fails', async () => {
    const threads = createThreads();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = new FactoryThreadTitleProcessor({
      generateTitle: () => Promise.reject(new Error('provider down')),
      threads: () => Promise.resolve(threads),
    });

    await failing.processInput(inputArgs([userMessage('hello')]));
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[Factory thread-title] Unable to generate a thread title.', expect.any(Error)),
    );
    warn.mockRestore();

    expect(threads.updateThread).not.toHaveBeenCalled();
  });
});

describe('createThreadTitleGenerator', () => {
  it('passes the configured model through to the SDK generator', async () => {
    const generate = createThreadTitleGenerator({ model: 'google/gemini-2.5-flash', thinkingLevel: 'low' });

    await generate('prompt');

    expect(generateThreadTitleMock).toHaveBeenCalledWith({
      prompt: 'prompt',
      requestContext: undefined,
      model: 'google/gemini-2.5-flash',
      thinkingLevel: 'low',
    });
  });
});
