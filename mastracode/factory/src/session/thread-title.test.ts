import { MessageList } from '@mastra/core/agent/message-list';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { ProcessInputArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateThreadTitleMock = vi.hoisted(() => vi.fn());
vi.mock('@mastra/code-sdk', () => ({
  generateThreadTitle: (options: { prompt: string }) => generateThreadTitleMock(options),
}));

import { FactoryThreadTitleProcessor, type ThreadTitleThreads, type TitleGenerationSetting } from './thread-title.js';

function userMessage(text: string): MastraDBMessage {
  return {
    id: 'msg-1',
    role: 'user',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function assistantMessage(): MastraDBMessage {
  return {
    id: 'msg-2',
    role: 'assistant',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: 'Working on it.' }] },
  };
}

function threadRow(title?: string) {
  return { id: 'thread-1', resourceId: 'resource-1', title, createdAt: new Date(), updatedAt: new Date() };
}

function createThreads({ title }: { title?: string } = {}) {
  let current = threadRow(title);
  const threads: ThreadTitleThreads & { getThreadById: ReturnType<typeof vi.fn>; setTitle(title: string): void } = {
    getThreadById: vi.fn(async () => current),
    updateThread: vi.fn(async ({ title: next }: { id: string; title?: string }) => {
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
  setting = { enabled: true },
  resolveSetting,
}: {
  threads: ThreadTitleThreads;
  setting?: TitleGenerationSetting | undefined;
  resolveSetting?: (requestContext?: RequestContext) => Promise<TitleGenerationSetting | undefined>;
}) {
  const resolveSettingMock = resolveSetting ?? vi.fn(() => Promise.resolve(setting));
  const processor = new FactoryThreadTitleProcessor({
    resolveSetting: resolveSettingMock,
    threads: () => Promise.resolve(threads),
  });
  return { processor, resolveSetting: resolveSettingMock };
}

function inputArgs(messages: MastraDBMessage[], requestContext?: RequestContext): ProcessInputArgs {
  return {
    messages,
    messageList: new MessageList(),
    requestContext,
    abortSignal: undefined,
    state: {},
    systemMessages: [],
    retryCount: 0,
    abort: () => {
      throw new Error('not used');
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  generateThreadTitleMock.mockResolvedValue('Login redirect fix');
});

describe('FactoryThreadTitleProcessor', () => {
  it('returns synchronously — the pipeline never awaits naming', () => {
    const threads = createThreads();
    let resolveSetting: ((value: TitleGenerationSetting) => void) | undefined;
    const settingGate = new Promise<TitleGenerationSetting>(resolve => {
      resolveSetting = resolve;
    });
    const { processor } = createProcessor({ threads, resolveSetting: () => settingGate });
    const messages = [userMessage('Fix the login redirect loop')];

    expect(processor.processInput(inputArgs(messages))).toBe(messages);
    resolveSetting?.({ enabled: true });

    return vi.waitFor(() =>
      expect(threads.updateThread).toHaveBeenCalledWith({ id: 'thread-1', title: 'Login redirect fix' }),
    );
  });

  it('passes the run request context to the setting lookup and the generator', async () => {
    const threads = createThreads();
    const requestContext = new RequestContext();
    const { processor, resolveSetting } = createProcessor({ threads });

    await processor.processInput(inputArgs([userMessage('hello')], requestContext));
    await vi.waitFor(() => expect(threads.updateThread).toHaveBeenCalled());

    expect(resolveSetting).toHaveBeenCalledWith(requestContext);
    expect(generateThreadTitleMock).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'hello', requestContext }));
  });

  it('skips the model call entirely when the org disabled generation', async () => {
    const threads = createThreads();
    const { processor, resolveSetting } = createProcessor({ threads, setting: { enabled: false } });

    await processor.processInput(inputArgs([userMessage('hello')]));
    await vi.waitFor(() => expect(resolveSetting).toHaveBeenCalled());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(generateThreadTitleMock).not.toHaveBeenCalled();
    expect(threads.getThreadById).not.toHaveBeenCalled();
    expect(threads.updateThread).not.toHaveBeenCalled();
  });

  it('skips when the setting cannot be resolved', async () => {
    const threads = createThreads();
    const { processor } = createProcessor({ threads, resolveSetting: () => Promise.resolve(undefined) });

    await processor.processInput(inputArgs([userMessage('hello')]));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(generateThreadTitleMock).not.toHaveBeenCalled();
    expect(threads.updateThread).not.toHaveBeenCalled();
  });

  it('forwards the configured model and thinking level', async () => {
    const threads = createThreads();
    const { processor } = createProcessor({
      threads,
      setting: { enabled: true, modelId: 'google/gemini-2.5-flash', thinkingLevel: 'low' },
    });

    await processor.processInput(inputArgs([userMessage('hello')]));
    await vi.waitFor(() => expect(threads.updateThread).toHaveBeenCalled());

    expect(generateThreadTitleMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'google/gemini-2.5-flash', thinkingLevel: 'low' }),
    );
  });

  it('leaves titled threads alone', async () => {
    const threads = createThreads({ title: 'Issue #12: Login loop' });
    const { processor } = createProcessor({ threads });

    await processor.processInput(inputArgs([userMessage('hello')]));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(generateThreadTitleMock).not.toHaveBeenCalled();
    expect(threads.updateThread).not.toHaveBeenCalled();
  });

  it('keeps a title the user set while the setting was being resolved', async () => {
    const threads = createThreads();
    const { processor } = createProcessor({
      threads,
      resolveSetting: async () => {
        threads.setTitle('My own name');
        return { enabled: true };
      },
    });

    await processor.processInput(inputArgs([userMessage('hello')]));
    await vi.waitFor(() => expect(threads.getThreadById).toHaveBeenCalled());

    expect(threads.updateThread).not.toHaveBeenCalled();
  });

  it('generates at most once per thread while a generation is running', async () => {
    const threads = createThreads();
    let releaseGeneration: ((title: string | undefined) => void) | undefined;
    const generationGate = new Promise<string | undefined>(resolve => {
      releaseGeneration = resolve;
    });
    generateThreadTitleMock.mockReturnValue(generationGate);
    const { processor } = createProcessor({ threads });

    await processor.processInput(inputArgs([userMessage('first')]));
    await processor.processInput(inputArgs([userMessage('second'), assistantMessage()]));
    releaseGeneration?.('A title');
    await vi.waitFor(() => expect(threads.updateThread).toHaveBeenCalled());

    expect(generateThreadTitleMock).toHaveBeenCalledTimes(1);
  });

  it('skips runs without a user message or without a memory store', async () => {
    const noUserThreads = createThreads();
    const { processor: noUserProcessor } = createProcessor({ threads: noUserThreads });
    await noUserProcessor.processInput(inputArgs([assistantMessage()]));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(generateThreadTitleMock).not.toHaveBeenCalled();

    const missingStoreProcessor = new FactoryThreadTitleProcessor({
      resolveSetting: () => Promise.resolve({ enabled: true }),
      threads: () => Promise.resolve(undefined),
    });
    await missingStoreProcessor.processInput(inputArgs([userMessage('hello')]));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(generateThreadTitleMock).not.toHaveBeenCalled();
  });

  it('warns instead of throwing when generation fails', async () => {
    const threads = createThreads();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = new FactoryThreadTitleProcessor({
      resolveSetting: () => Promise.resolve({ enabled: true }),
      threads: () => Promise.resolve(threads),
    });
    generateThreadTitleMock.mockRejectedValue(new Error('provider down'));

    await failing.processInput(inputArgs([userMessage('hello')]));
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[Factory thread-title] Unable to generate a thread title.', expect.any(Error)),
    );
    warn.mockRestore();

    expect(threads.updateThread).not.toHaveBeenCalled();
  });
});
