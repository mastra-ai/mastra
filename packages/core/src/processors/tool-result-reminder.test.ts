import { describe, expect, it, vi } from 'vitest';
import type { MessageList, MastraDBMessage } from '../agent/message-list';
import { MastraLanguageModelV3Mock } from '../loop/test-utils/MastraLanguageModelV3Mock';
import type { RequestContext } from '../request-context';
import { AgentsMDInjector } from './tool-result-reminder';
import type { ProcessInputStepArgs, ProcessorStreamWriter, ToolCallInfo } from './index';

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
  state: 'call' | 'result';
  result?: unknown;
};

type TestToolInvocationPart = {
  type: 'tool-invocation';
  toolInvocation: TestToolInvocation;
};

type TestMessageContent = {
  format: 2;
  parts: Array<TestTextPart | TestToolInvocationPart>;
  toolInvocations?: TestToolInvocation[];
  metadata?: Record<string, unknown>;
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

  add(message: string | MastraDBMessage, _source: 'user' | 'response' | 'input') {
    this.messages.push(typeof message === 'string' ? createUserMessage(message) : message);
    return this;
  }

  push(...messages: MastraDBMessage[]) {
    this.messages.push(...messages);
  }
}

function createUserMessage(text: string, metadata?: Record<string, unknown>): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      ...(metadata ? { metadata } : {}),
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

function createToolInvocationPart(
  toolCallId: string,
  args: Record<string, unknown>,
  state: 'call' | 'result',
  result?: unknown,
): TestToolInvocationPart {
  return {
    type: 'tool-invocation',
    toolInvocation: {
      toolName: 'mkdir',
      toolCallId,
      args,
      state,
      ...(state === 'result' ? { result } : {}),
    },
  };
}

function createToolCall(args: Record<string, unknown>, toolName = 'view', toolCallId?: string): ToolCallInfo {
  return {
    toolName,
    toolCallId: toolCallId ?? `call-${Math.random().toString(36).slice(2, 8)}`,
    args,
  };
}

function createProcessInputStepArgs(
  messageList: TestMessageList,
  toolCalls: ToolCallInfo[],
  writer?: ProcessorStreamWriter,
  rotateResponseMessageId?: () => string,
): ProcessInputStepArgs {
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
    model: new MastraLanguageModelV3Mock({}),
    writer,
  } as ProcessInputStepArgs;
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

describe('AgentsMDInjector', () => {
  it('injects metadata-rich reminder for direct AGENTS.md path references', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-agents';
    messageList.push(
      createUserMessage('Open the instructions'),
      createAssistantMessage({
        format: 2,
        parts: [
          createToolInvocationPart(toolCallId, { path: '/repo/src/agents/nested/AGENTS.md' }, 'result', { ok: true }),
        ],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: () => false,
      readFile: () => FILE_CONTENT,
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [
        createToolCall({ path: '/repo/src/agents/nested/AGENTS.md' }, 'view', toolCallId),
      ]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/src/agents/nested/AGENTS.md"># Nested AGENTS\n\nUse the nested instructions when replying.</system-reminder>`,
    ]);
    const injectedReminder = messageList.get.all.db().at(-1);
    expect(injectedReminder?.content.metadata).toEqual({
      dynamicAgentsMdReminder: {
        path: '/repo/src/agents/nested/AGENTS.md',
        type: 'dynamic-agents-md',
      },
    });
  });

  it('injects reminder for tool calls array format', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-read';
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { filePath: '/repo/CLAUDE.md' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/CLAUDE.md',
      isDirectory: () => false,
      readFile: () => 'Project guidance from CLAUDE',
    });

    const chunks: Array<{ type: string; data?: unknown; transient?: boolean }> = [];
    const writer: ProcessorStreamWriter = {
      custom: async chunk => {
        chunks.push(chunk as { type: string; data?: unknown; transient?: boolean });
      },
    };

    await testProcessor.processInputStep(
      createProcessInputStepArgs(
        messageList,
        [createToolCall({ filePath: '/repo/CLAUDE.md' }, 'read', toolCallId)],
        writer,
      ),
    );

    expect(chunks).toEqual([
      {
        type: 'data-system-reminder',
        data: {
          message: 'Project guidance from CLAUDE',
          reminderType: 'dynamic-agents-md',
          path: '/repo/CLAUDE.md',
        },
        transient: true,
      },
    ]);
    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/CLAUDE.md">Project guidance from CLAUDE</system-reminder>`,
    ]);
  });

  it('rotates the active response id before persisting an injected reminder', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-result';
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [
          createToolInvocationPart(toolCallId, { path: '/repo/src/agents/nested/AGENTS.md' }, 'result', { ok: true }),
        ],
      }),
    );
    const rotateResponseMessageId = vi.fn(() => 'response-2');

    const testProcessor = new AgentsMDInjector({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: () => false,
      readFile: () => FILE_CONTENT,
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(
        messageList,
        [createToolCall({ path: '/repo/src/agents/nested/AGENTS.md' }, 'view', toolCallId)],
        undefined,
        rotateResponseMessageId,
      ),
    );

    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
  });

  it('does not detect a reminder from tool args while the tool invocation is still missing a result', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-pending';
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: 'src/agents/nested' }, 'call')],
      }),
    );

    const rotateResponseMessageId = vi.fn(() => 'response-2');
    const testProcessor = new AgentsMDInjector({
      reminderText: REMINDER_TEXT,
      pathExists: path =>
        String(path) === '/repo/src/agents/nested' || String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: path => String(path) === '/repo/src/agents/nested',
      readFile: () => FILE_CONTENT,
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(
        messageList,
        [createToolCall({ path: '/repo/src/agents/nested' }, 'mkdir', toolCallId)],
        undefined,
        rotateResponseMessageId,
      ),
    );

    expect(rotateResponseMessageId).not.toHaveBeenCalled();
    expect(extractReminderMarkup(messageList)).toEqual([]);
  });

  it('does not inject for instruction files already loaded statically', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-static';
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: '/repo/src/deep/file.ts' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/deep/file.ts',
      readFile: () => FILE_CONTENT,
      getIgnoredInstructionPaths: () => ['/repo/AGENTS.md'],
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [createToolCall({ path: '/repo/src/deep/file.ts' }, 'view', toolCallId)]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([]);
  });

  it('falls back to configured reminder text when file cannot be read', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-fallback';
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [
          createToolInvocationPart(toolCallId, { path: '/repo/src/agents/nested/file.ts' }, 'result', { ok: true }),
        ],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      reminderText: REMINDER_TEXT,
      pathExists: path => String(path) === '/repo/src/agents/nested/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/agents/nested/file.ts',
      readFile: () => {
        throw new Error('nope');
      },
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [
        createToolCall({ path: '/repo/src/agents/nested/file.ts' }, 'view', toolCallId),
      ]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/src/agents/nested/AGENTS.md">${REMINDER_TEXT}</system-reminder>`,
    ]);
  });

  it('does not inject duplicate reminder for the same path and content', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-duplicate';
    messageList.push(
      createUserMessage(
        `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Project guidance from AGENTS</system-reminder>`,
      ),
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: '/repo/src/index.ts' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/index.ts',
      readFile: () => 'Project guidance from AGENTS',
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [createToolCall({ path: '/repo/src/index.ts' }, 'view', toolCallId)]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Project guidance from AGENTS</system-reminder>`,
    ]);
  });

  it('does not inject duplicate reminder when a prior reminder for the same path has different content', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-duplicate-path';
    messageList.push(
      createUserMessage(
        `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">[truncated older content]</system-reminder>`,
      ),
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: '/repo/src/index.ts' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: path => String(path) !== '/repo/src/index.ts',
      readFile: () => 'Project guidance from AGENTS',
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [createToolCall({ path: '/repo/src/index.ts' }, 'view', toolCallId)]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">[truncated older content]</system-reminder>`,
    ]);
  });

  it('injects a new reminder when the path differs', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-different-path';
    messageList.push(
      createUserMessage(
        `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Root guidance</system-reminder>`,
      ),
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: '/repo/nested/file.ts' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      pathExists: path => String(path) === '/repo/nested/AGENTS.md' || String(path) === '/repo/AGENTS.md',
      isDirectory: path => String(path) === '/repo' || String(path) === '/repo/nested',
      readFile: path => (String(path) === '/repo/nested/AGENTS.md' ? 'Nested guidance' : 'Root guidance'),
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [createToolCall({ path: '/repo/nested/file.ts' }, 'view', toolCallId)]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">Root guidance</system-reminder>`,
      `<system-reminder type="dynamic-agents-md" path="/repo/nested/AGENTS.md">Nested guidance</system-reminder>`,
    ]);
  });

  it('truncates reminder content that exceeds maxTokens', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-truncated';
    const longContent = [
      '# Root AGENTS',
      '',
      ...Array.from({ length: 20 }, () => 'alpha beta gamma delta epsilon zeta'),
    ].join('\n');
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: '/repo/AGENTS.md' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      maxTokens: 10,
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: () => false,
      readFile: () => longContent,
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [createToolCall({ path: '/repo/AGENTS.md' }, 'view', toolCallId)]),
    );

    const [reminder] = extractReminderMarkup(messageList);
    expect(reminder.startsWith('<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md">')).toBe(true);
    expect(reminder.endsWith('</system-reminder>')).toBe(true);
    expect(reminder.match(/<system-reminder/g)?.length).toBe(1);
    expect(reminder.match(/<\/system-reminder>/g)?.length).toBe(1);
    expect(reminder).toContain('[truncated — showing first ~');
    expect(reminder).toContain('of ~');
    expect(reminder).toContain('# Root AGENTS');
  });

  it('leaves reminder content unchanged when it is under maxTokens', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-short';
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: '/repo/AGENTS.md' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      maxTokens: 1000,
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: () => false,
      readFile: () => FILE_CONTENT,
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [createToolCall({ path: '/repo/AGENTS.md' }, 'view', toolCallId)]),
    );

    expect(extractReminderMarkup(messageList)).toEqual([
      `<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md"># Nested AGENTS\n\nUse the nested instructions when replying.</system-reminder>`,
    ]);
  });

  it('truncates at newline boundaries when possible', async () => {
    const messageList = new TestMessageList();
    const toolCallId = 'call-newline';
    const content = ['# Root AGENTS', '', 'first line words', 'second line words', 'third line words'].join('\n');
    messageList.push(
      createAssistantMessage({
        format: 2,
        parts: [createToolInvocationPart(toolCallId, { path: '/repo/AGENTS.md' }, 'result', { ok: true })],
      }),
    );

    const testProcessor = new AgentsMDInjector({
      maxTokens: 6,
      pathExists: path => String(path) === '/repo/AGENTS.md',
      isDirectory: () => false,
      readFile: () => content,
    });

    await testProcessor.processInputStep(
      createProcessInputStepArgs(messageList, [createToolCall({ path: '/repo/AGENTS.md' }, 'view', toolCallId)]),
    );

    const [reminder] = extractReminderMarkup(messageList);
    expect(reminder).toContain('<system-reminder type="dynamic-agents-md" path="/repo/AGENTS.md"># Root AGENTS');
    expect(reminder).not.toContain('first line words');
    expect(reminder).not.toContain('second line words');
    expect(reminder).toContain('[truncated — showing first ~');
    expect(reminder.endsWith('</system-reminder>')).toBe(true);
  });
});
