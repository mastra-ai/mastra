import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import type { IMastraLogger } from '../logger';
import { ProcessorRunner } from './runner';
import { AgentsMDInjector } from './tool-result-reminder';
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

const AGENTS_MD_CONTENT = '# Project AGENTS\n\nUse these instructions when working in this directory.';

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

function createToolCallResponseMessage(args: {
  toolCallId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
}): MastraDBMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolName: args.toolName,
            toolCallId: args.toolCallId,
            args: args.toolArgs,
            state: 'result',
            result: { ok: true },
          },
        },
      ],
    } as MastraDBMessage['content'],
    createdAt: new Date(),
    threadId: 'test-thread',
  };
}

describe('AgentsMDInjector integration through ProcessorRunner', () => {
  let messageList: MessageList;

  beforeEach(() => {
    messageList = new MessageList({ threadId: 'test-thread' });
  });

  it('auto-loads AGENTS.md when a tool call references a path near an instruction file', async () => {
    messageList.add([{ role: 'user', content: 'Read the source file' }], 'input');
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-1',
          toolName: 'view',
          toolArgs: { path: '/repo/src/components/Button.tsx' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) =>
        path === '/repo/src/components/AGENTS.md' || path === '/repo/src/components/Button.tsx',
      isDirectory: (path: string) => path === '/repo/src/components' || path === '/repo/src' || path === '/repo',
      readFile: (path: string) => {
        if (path === '/repo/src/components/AGENTS.md') return AGENTS_MD_CONTENT;
        throw new Error(`Unexpected read: ${path}`);
      },
    });

    const chunks: unknown[] = [];
    const writer: ProcessorStreamWriter = {
      custom: async chunk => {
        chunks.push(chunk);
      },
    };

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer,
    });

    // The AGENTS.md content should be injected as a signal message
    const signalMessages = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signalMessages).toHaveLength(1);
    expect(signalMessages[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: AGENTS_MD_CONTENT }),
    );

    // The signal should have proper metadata
    const signalMeta = signalMessages[0]!.content.metadata?.signal as Record<string, unknown> | undefined;
    expect(signalMeta).toBeDefined();
    expect(signalMeta!.type).toBe('reactive');
    expect(signalMeta!.tagName).toBe('system-reminder');
    expect(signalMeta!.attributes).toEqual(
      expect.objectContaining({ type: 'dynamic-agents-md', path: '/repo/src/components/AGENTS.md' }),
    );
  });

  it('injected AGENTS.md content appears in the LLM prompt', async () => {
    messageList.add([{ role: 'user', content: 'Help me with this code' }], 'input');
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-2',
          toolName: 'read',
          toolArgs: { filePath: '/project/lib/utils.ts' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) => path === '/project/lib/AGENTS.md' || path === '/project/lib/utils.ts',
      isDirectory: (path: string) => path === '/project/lib' || path === '/project',
      readFile: () => AGENTS_MD_CONTENT,
    });

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer: { custom: async () => {} },
    });

    // The AGENTS.md content should appear in the LLM prompt
    const promptMessages = await messageList.get.all.aiV5.prompt();
    const promptTexts = promptMessages.filter((m: any) => m.role === 'user').map((m: any) => extractPromptText(m));

    const hasAgentsMd = promptTexts.some(
      (text: string) => text.includes('system-reminder') && text.includes(AGENTS_MD_CONTENT),
    );
    expect(hasAgentsMd).toBe(true);
  });

  it('stream data part is emitted for the AGENTS.md signal', async () => {
    messageList.add([{ role: 'user', content: 'Show me the code' }], 'input');
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-3',
          toolName: 'view',
          toolArgs: { path: '/repo/AGENTS.md' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) => path === '/repo/AGENTS.md',
      isDirectory: () => false,
      readFile: () => AGENTS_MD_CONTENT,
    });

    const chunks: unknown[] = [];
    const writer: ProcessorStreamWriter = {
      custom: async chunk => {
        chunks.push(chunk);
      },
    };

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer,
    });

    // A data-signal chunk should have been emitted
    expect(chunks).toEqual([
      expect.objectContaining({
        type: 'data-signal',
        data: expect.objectContaining({
          type: 'reactive',
          tagName: 'system-reminder',
          contents: AGENTS_MD_CONTENT,
          metadata: expect.objectContaining({
            path: '/repo/AGENTS.md',
            type: 'dynamic-agents-md',
          }),
        }),
        transient: true,
      }),
    ]);
  });

  it('does not duplicate AGENTS.md when a signal-based reminder already exists', async () => {
    messageList.add([{ role: 'user', content: 'First question' }], 'input');

    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-prior',
          toolName: 'view',
          toolArgs: { path: '/repo/src/index.ts' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) =>
        path === '/repo/AGENTS.md' || path === '/repo/src/index.ts' || path === '/repo/src/other.ts',
      isDirectory: (path: string) => path === '/repo' || path === '/repo/src',
      readFile: () => AGENTS_MD_CONTENT,
    });

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    // First injection
    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer: { custom: async () => {} },
    });

    const signalsAfterFirst = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signalsAfterFirst).toHaveLength(1);

    // Simulate another tool call to the same area
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-second',
          toolName: 'view',
          toolArgs: { path: '/repo/src/other.ts' },
        }),
      ],
      'response',
    );

    // Second run should NOT inject a duplicate
    const runner2 = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner2.runProcessInputStep({
      messageList,
      stepNumber: 2,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-3',
      rotateResponseMessageId: () => 'response-4',
      writer: { custom: async () => {} },
    });

    const signalsAfterSecond = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signalsAfterSecond).toHaveLength(1);
  });

  it('injects AGENTS.md for directory-based tool calls', async () => {
    messageList.add([{ role: 'user', content: 'List the files' }], 'input');
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-dir',
          toolName: 'list_directory',
          toolArgs: { path: '/repo/src/components' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) =>
        path === '/repo/src/components' || path === '/repo/src/components/AGENTS.md' || path === '/repo/src/AGENTS.md',
      isDirectory: (path: string) => path === '/repo/src/components' || path === '/repo/src' || path === '/repo',
      readFile: (path: string) => {
        if (path === '/repo/src/components/AGENTS.md') return 'Component instructions';
        throw new Error(`Unexpected read: ${path}`);
      },
    });

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'Component instructions' }),
    );
  });

  it('injects AGENTS.md from the production list files tool through ProcessorRunner', async () => {
    messageList.add([{ role: 'user', content: 'List packages/core' }], 'input');
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-list-files',
          toolName: 'mastra_workspace_list_files',
          toolArgs: { path: '/repo/packages/core' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) => path === '/repo/packages/core' || path === '/repo/packages/core/AGENTS.md',
      isDirectory: (path: string) => path === '/repo/packages/core' || path === '/repo/packages' || path === '/repo',
      readFile: (path: string) => {
        if (path === '/repo/packages/core/AGENTS.md') return 'Core package instructions';
        throw new Error(`Unexpected read: ${path}`);
      },
    });
    const rotateResponseMessageId = vi.fn(() => 'response-2');
    const writer: ProcessorStreamWriter = { custom: vi.fn(async () => {}) };

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId,
      writer,
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(1);
    expect(signals[0]!.content.parts[0]).toEqual(
      expect.objectContaining({ type: 'text', text: 'Core package instructions' }),
    );
    expect(signals[0]!.content.metadata?.signal).toEqual(
      expect.objectContaining({ attributes: { type: 'dynamic-agents-md', path: '/repo/packages/core/AGENTS.md' } }),
    );
    expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
    expect(writer.custom).toHaveBeenCalledWith(expect.objectContaining({ type: 'data-signal' }));
  });

  it('no injection when tool call path has no nearby AGENTS.md', async () => {
    messageList.add([{ role: 'user', content: 'Read the file' }], 'input');
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-no-agents',
          toolName: 'view',
          toolArgs: { path: '/repo/src/main.ts' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) => path === '/repo/src/main.ts',
      isDirectory: (path: string) => path === '/repo/src' || path === '/repo',
      readFile: () => {
        throw new Error('Should not be called');
      },
    });

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      writer: { custom: async () => {} },
    });

    const signals = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signals).toHaveLength(0);
  });

  it('AGENTS.md injection survives across multiple LLM steps', async () => {
    messageList.add([{ role: 'user', content: 'Start working' }], 'input');

    // Step 1: tool call finds a path near AGENTS.md
    messageList.add(
      [
        createToolCallResponseMessage({
          toolCallId: 'call-step1',
          toolName: 'view',
          toolArgs: { path: '/repo/src/index.ts' },
        }),
      ],
      'response',
    );

    const injector = new AgentsMDInjector({
      pathExists: (path: string) => path === '/repo/AGENTS.md' || path === '/repo/src/index.ts',
      isDirectory: (path: string) => path === '/repo' || path === '/repo/src',
      readFile: () => AGENTS_MD_CONTENT,
    });

    const runner = new ProcessorRunner({
      inputProcessors: [injector],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    await runner.runProcessInputStep({
      messageList,
      stepNumber: 1,
      steps: [],
      model: {} as any,
      tools: {},
      retryCount: 0,
      messageId: 'response-1',
      rotateResponseMessageId: () => 'response-2',
      writer: { custom: async () => {} },
    });

    // Signal injected in step 1
    const signalsStep1 = messageList.get.all.db().filter(m => m.role === 'signal');
    expect(signalsStep1).toHaveLength(1);

    // Add assistant response and another user message
    messageList.add(
      [
        {
          id: 'assistant-2',
          role: 'assistant' as const,
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'Done' }] },
          createdAt: new Date(),
          threadId: 'test-thread',
        },
      ],
      'response',
    );

    // The AGENTS.md signal should still be visible in the prompt for step 2
    const promptMessages = await messageList.get.all.aiV5.prompt();
    const promptTexts = promptMessages.filter((m: any) => m.role === 'user').map((m: any) => extractPromptText(m));

    const hasAgentsMd = promptTexts.some(
      (text: string) => text.includes('system-reminder') && text.includes(AGENTS_MD_CONTENT),
    );
    expect(hasAgentsMd).toBe(true);
  });
});
