import { describe, expect, it, vi } from 'vitest';
import type { MessageList, MastraDBMessage } from '../agent/message-list';
import { MastraLanguageModelV3Mock } from '../loop/test-utils/MastraLanguageModelV3Mock';
import type { RequestContext } from '../request-context';
import { ToolResultReminderProcessor } from './tool-result-reminder';
import type { ProcessOutputStepArgs, ProcessorStreamWriter, ToolCallInfo } from './index';

const REMINDER_TEXT = 'Remember to cite project instructions when using AGENTS.md guidance.';
const FILE_CONTENT = '# Nested AGENTS\n\nUse the nested instructions when replying.';

type TestTextPart = {
  type: 'text';
  text: string;
};

type TestToolInvocation = {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  state: 'result';
  result: unknown;
};

type TestToolInvocationPart = {
  type: 'tool-invocation';
  toolInvocation: TestToolInvocation;
};

type TestMessageContent = {
  format: 2;
  parts: Array<TestTextPart | TestToolInvocationPart>;
  toolInvocations?: TestToolInvocation[];
};

class TestMessageList {
  private readonly messages: MastraDBMessage[] = [];

  get get() {
    return {
      all: {
        db: () => this.messages,
      },
    };
  }

  add(message: string, _source: 'user' | 'response' | 'input') {
    this.messages.push(createUserMessage(message));
    return this;
  }

  push(...messages: MastraDBMessage[]) {
    this.messages.push(...messages);
  }
}

function createUserMessage(text: string): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    } as MastraDBMessage['content'],
    createdAt: new Date(),
    threadId: 'test-thread',
  };
}

function createAssistantMessage(content: TestMessageContent): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: content as unknown as MastraDBMessage['content'],
    createdAt: new Date(),
    threadId: 'test-thread',
  };
}

function createToolCall(args: Record<string, unknown>, toolName = 'view'): ToolCallInfo {
  return {
    toolName,
    toolCallId: `call-${Math.random().toString(36).slice(2, 8)}`,
    args,
  };
}

function createProcessOutputStepArgs(
  messageList: TestMessageList,
  toolCalls: ToolCallInfo[],
  customImpl?: ProcessorStreamWriter['custom'],
  rotateResponseMessageId?: () => string,
): ProcessOutputStepArgs {
  const requestContext = {
    get: () => undefined,
    set: () => undefined,
    has: () => false,
    delete: () => false,
    clear: () => undefined,
    values: () => [],
    entries: () => [],
    keys: () => [],
  } as unknown as RequestContext;

  const writer = {
    custom: customImpl ?? (async () => undefined),
  } satisfies ProcessorStreamWriter;

  return {
    stepNumber: 0,
    steps: [],
    messageId: 'response-1',
    rotateResponseMessageId,
    finishReason: 'tool-calls',
    toolCalls,
    text: undefined,
    systemMessages: [],
    state: {},
    messages: messageList.get.all.db(),
    messageList: messageList as unknown as MessageList,
    abort: () => {
      throw new Error('abort not expected');
    },
    abortSignal: new AbortController().signal,
    requestContext,
    retryCount: 0,
    writer,
    model: new MastraLanguageModelV3Mock({}),
  } as ProcessOutputStepArgs;
}

function extractReminderMarkup(messageList: TestMessageList): string[] {
  return messageList.get.all
    .db()
    .filter(message => message.role === 'user')
    .map(message => getMessageText(message))
    .filter(text => text.includes('<system-reminder'));
}

function getMessageText(message: MastraDBMessage): string {
  const content = message.content as unknown as TestMessageContent;
  return content.parts
    .filter((part): part is TestTextPart => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

describe('ToolResultReminderProcessor', () => {
  it('emits a transient data-system-reminder chunk with instruction file contents', async () => {
    const messageList = new TestMessageList();
    const chunks: Array<{ type: string; data?: unknown; transient?: boolean }> = [];

    messageList.push(createAssistantMessage({ format: 2, parts: [] }));

    const testProcessor = new ToolResultReminderProcessor({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/agents/nested/file.ts',
      readFile: () => FILE_CONTENT,
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(
        messageList,
        [createToolCall({ path: '/repo/src/agents/nested/file.ts' })],
        async chunk => {
          chunks.push(chunk as { type: string; data?: unknown; transient?: boolean });
        },
      ),
    );

    expect(chunks).toEqual([
      {
        type: 'data-system-reminder',
        data: {
          message: FILE_CONTENT,
          reminderType: 'dynamic-agents-md',
          path: '/repo/src/agents/nested/AGENTS.md',
        },
        transient: true,
      },
    ]);
  });

  it('injects metadata-rich reminder for direct AGENTS.md path references', async () => {
    const messageList = new TestMessageList();
    messageList.push(createUserMessage('Open the instructions'), createAssistantMessage({ format: 2, parts: [] }));

    const testProcessor = new ToolResultReminderProcessor({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: () => false,
      readFile: () => FILE_CONTENT,
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(messageList, [createToolCall({ path: '/repo/src/agents/nested/AGENTS.md' })]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/src/agents/nested/AGENTS.md"># Nested AGENTS\n\nUse the nested instructions when replying.</system-reminder>`,
    ]);
  });

  it('injects reminder for tool calls array format', async () => {
    const messageList = new TestMessageList();
    messageList.push(createAssistantMessage({ format: 2, parts: [] }));

    const testProcessor = new ToolResultReminderProcessor({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/CLAUDE.md',
      isDirectory: () => false,
      readFile: () => 'Project guidance from CLAUDE',
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(messageList, [createToolCall({ filePath: '/repo/CLAUDE.md' }, 'read')]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/CLAUDE.md">Project guidance from CLAUDE</system-reminder>`,
    ]);
  });

  it('rotates the active response id before persisting an injected reminder', async () => {
    const messageList = new TestMessageList();
    messageList.push(createAssistantMessage({ format: 2, parts: [] }));
    const rotateResponseMessageId = vi.fn(() => 'response-2');

    const testProcessor = new ToolResultReminderProcessor({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: () => false,
      readFile: () => FILE_CONTENT,
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(
        messageList,
        [createToolCall({ path: '/repo/src/agents/nested/AGENTS.md' })],
        undefined,
        rotateResponseMessageId,
      ),
    );

    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('does not inject for instruction files already loaded statically', async () => {
    const messageList = new TestMessageList();
    messageList.push(createAssistantMessage({ format: 2, parts: [] }));

    const testProcessor = new ToolResultReminderProcessor({
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/deep/file.ts',
      readFile: () => FILE_CONTENT,
      getIgnoredInstructionPaths: () => ['/repo/AGENTS.md'],
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(messageList, [createToolCall({ path: '/repo/src/deep/file.ts' })]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([]);
  });

  it('falls back to configured reminder text when file cannot be read', async () => {
    const messageList = new TestMessageList();
    messageList.push(createAssistantMessage({ format: 2, parts: [] }));

    const testProcessor = new ToolResultReminderProcessor({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/agents/nested/file.ts',
      readFile: () => {
        throw new Error('nope');
      },
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(messageList, [createToolCall({ path: '/repo/src/agents/nested/file.ts' })]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/src/agents/nested/AGENTS.md">${REMINDER_TEXT}</system-reminder>`,
    ]);
  });

  it('does not inject duplicate reminder for the same path and content', async () => {
    const messageList = new TestMessageList();
    messageList.push(
      createUserMessage(
        `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Project guidance from AGENTS</system-reminder>`,
      ),
      createAssistantMessage({ format: 2, parts: [] }),
    );

    const testProcessor = new ToolResultReminderProcessor({
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/index.ts',
      readFile: () => 'Project guidance from AGENTS',
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(messageList, [createToolCall({ path: '/repo/src/index.ts' })]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Project guidance from AGENTS</system-reminder>`,
    ]);
  });

  it('injects a new reminder when the path differs', async () => {
    const messageList = new TestMessageList();
    messageList.push(
      createUserMessage(
        `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Root guidance</system-reminder>`,
      ),
      createAssistantMessage({ format: 2, parts: [] }),
    );

    const testProcessor = new ToolResultReminderProcessor({
      pathExists: path => String(path) === '/repo/nested/AGENTS.md' || String(path) === '/repo/AGENTS.md',
      isDirectory: path => String(path) === '/repo' || String(path) === '/repo/nested',
      readFile: path => (String(path) === '/repo/nested/AGENTS.md' ? 'Nested guidance' : 'Root guidance'),
    });

    await testProcessor.processOutputStep(
      createProcessOutputStepArgs(messageList, [createToolCall({ path: '/repo/nested/file.ts' })]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Root guidance</system-reminder>`,
      `<system-reminder type="dynamic-agents-md" path="/repo/nested/AGENTS.md">Nested guidance</system-reminder>`,
    ]);
  });
});
