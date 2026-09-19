import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent/agent';
import { DEFAULT_GOAL_JUDGE_PROMPT } from '../../agent/goal/objective';
import { MessageList } from '../../agent/message-list';
import { signalToXmlMarkup } from '../../agent/signals';
import { ConsoleLogger } from '../../logger';
import { ProcessorRunner } from '../../processors/runner';
import { LocalFilesystem, LocalSandbox, Workspace } from '../../workspace';
import type { PromptContext } from '../index';
import { buildBasePrompt, createCodingAgent } from '../index';

const MODEL = 'openai/gpt-4o-mini';

function baseConfig(overrides: Partial<Parameters<typeof createCodingAgent>[0]> = {}) {
  return {
    id: 'test-coding-agent',
    name: 'Test Coding Agent',
    model: MODEL,
    instructions: 'You are a helpful coding assistant.',
    tools: {},
    ...overrides,
  };
}

function promptContext(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    projectPath: '/repo',
    projectName: 'repo',
    platform: 'darwin',
    date: '2026-06-30',
    mode: 'build',
    toolGuidance: '',
    ...overrides,
  };
}

describe('createCodingAgent', () => {
  it('keeps ProviderHistoryCompat in the default error processors', async () => {
    const agent = createCodingAgent(baseConfig());
    expect((await agent.listErrorProcessors()).map(processor => processor.id)).toContain('provider-history-compat');
  });

  it('returns an Agent', () => {
    const agent = createCodingAgent(baseConfig());
    expect(agent).toBeInstanceOf(Agent);
    expect(agent.id).toBe('test-coding-agent');
  });

  it('repairs a malformed tool id instead of blindly replaying the rejected request', async () => {
    const agent = createCodingAgent(baseConfig());
    const messageList = new MessageList({ threadId: 'test-thread' });
    messageList.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'test-thread',
        content: {
          format: 2 as const,
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                step: 0,
                toolCallId: 'call.with.dots',
                toolName: 'readFile',
                args: {},
                result: 'ok',
              },
            },
          ],
        },
      },
      'response',
    );

    // Anthropic rejects tool_use ids outside `^[a-zA-Z0-9_-]+$`. It arrives as a
    // 400, which is exactly what the blind retry's bad-request matcher claims.
    const error = Object.assign(new Error('tool_use.id: "call.with.dots" should match pattern ^[a-zA-Z0-9_-]+$'), {
      statusCode: 400,
    });

    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      errorProcessors: await agent.listErrorProcessors(),
      logger: new ConsoleLogger({ level: 'error' }),
      agentName: 'test-coding-agent',
    });

    const result = await runner.runProcessAPIError({
      error,
      messages: messageList.get.all.db(),
      messageList,
      stepNumber: 0,
      steps: [],
      retryCount: 0,
    });

    const toolCallIds = messageList.get.all
      .db()
      .flatMap(message => message.content?.parts ?? [])
      .filter(part => part.type === 'tool-invocation')
      .map(part => part.toolInvocation.toolCallId);

    expect(result).toEqual({ retry: true });
    expect(toolCallIds).toEqual(['call_with_dots']);
  });

  it('recovers a prefill rejection instead of blindly replaying the rejected request', async () => {
    const agent = createCodingAgent(baseConfig());
    const messageList = new MessageList({ threadId: 'test-thread' });

    // Same 400 shape as above, but the text a provider returns when the history
    // ends on an assistant turn. Only PrefillErrorHandler knows how to fix it.
    const error = Object.assign(new Error('This model does not support assistant message prefill'), {
      statusCode: 400,
    });

    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      errorProcessors: await agent.listErrorProcessors(),
      logger: new ConsoleLogger({ level: 'error' }),
      agentName: 'test-coding-agent',
    });

    const result = await runner.runProcessAPIError({
      error,
      messages: messageList.get.all.db(),
      messageList,
      stepNumber: 0,
      steps: [],
      retryCount: 0,
    });

    // Assert on the signal the handler emits, not just the word "continue", so
    // a seeded conversation could not satisfy this vacuously.
    const reminders = messageList.get.all
      .db()
      .map(
        message =>
          message.content?.metadata?.signal as { tagName?: string; attributes?: { type?: string } } | undefined,
      );

    expect(result).toEqual({ retry: true });
    expect(
      reminders.some(
        signal =>
          signal?.tagName === 'system-reminder' && signal.attributes?.type === 'anthropic-prefill-processor-retry',
      ),
    ).toBe(true);
  });

  it('builds a default local workspace when none is provided', async () => {
    const agent = createCodingAgent(baseConfig());
    const workspace = await agent.getWorkspace();

    expect(workspace).toBeInstanceOf(Workspace);
    expect(workspace?.filesystem).toBeInstanceOf(LocalFilesystem);
    expect(workspace?.sandbox).toBeInstanceOf(LocalSandbox);
  });

  it('roots the default workspace at basePath', async () => {
    const agent = createCodingAgent(baseConfig({ basePath: '/custom/base' }));
    const workspace = await agent.getWorkspace();

    expect((workspace?.sandbox as LocalSandbox).workingDirectory).toBe('/custom/base');
  });

  it('builds no default workspace when workspace is explicitly undefined', async () => {
    const agent = createCodingAgent(baseConfig({ workspace: undefined }));
    const workspace = await agent.getWorkspace();

    expect(workspace).toBeUndefined();
  });

  it('uses a caller-provided workspace verbatim', async () => {
    const custom = new Workspace({
      filesystem: new LocalFilesystem({ basePath: '/somewhere' }),
      sandbox: new LocalSandbox({ workingDirectory: '/somewhere' }),
    });

    const agent = createCodingAgent(baseConfig({ workspace: custom }));
    const workspace = await agent.getWorkspace();

    expect(workspace).toBe(custom);
  });

  it('defaults the goal prompt when a goal is configured without one', () => {
    const agent = createCodingAgent(
      baseConfig({
        goal: { judge: MODEL, maxRuns: 5 },
      }),
    );
    expect(agent.__getGoalConfig()?.prompt).toBe(DEFAULT_GOAL_JUDGE_PROMPT);
  });

  it('defaults the goal prompt when prompt is explicitly undefined', () => {
    const agent = createCodingAgent(
      baseConfig({
        goal: { judge: MODEL, maxRuns: 5, prompt: undefined },
      }),
    );
    expect(agent.__getGoalConfig()?.prompt).toBe(DEFAULT_GOAL_JUDGE_PROMPT);
  });

  it('accepts caller-provided signals and error processors', () => {
    const agent = createCodingAgent(
      baseConfig({
        signals: [],
        errorProcessors: [],
      }),
    );
    expect(agent).toBeInstanceOf(Agent);
  });

  it('does not include TaskSignalProvider when no memory is configured', async () => {
    const agent = createCodingAgent(baseConfig());
    const tools = await agent.listTools();
    expect(Object.keys(tools)).not.toContain('task_write');
    expect(Object.keys(tools)).not.toContain('task_check');
  });

  it('includes TaskSignalProvider when memory is configured', async () => {
    const memory = {} as any;
    const agent = createCodingAgent(baseConfig({ memory }));
    const tools = await agent.listTools();
    expect(Object.keys(tools)).toContain('task_write');
    expect(Object.keys(tools)).toContain('task_check');
  });

  it('merges TaskSignalProvider into caller-provided signals when memory is configured', async () => {
    const memory = {} as any;
    const agent = createCodingAgent(
      baseConfig({
        memory,
        signals: [],
      }),
    );
    const tools = await agent.listTools();
    expect(Object.keys(tools)).toContain('task_write');
  });

  it('does not add TaskSignalProvider to caller-provided signals when no memory', async () => {
    const agent = createCodingAgent(
      baseConfig({
        signals: [],
      }),
    );
    const tools = await agent.listTools();
    expect(Object.keys(tools)).not.toContain('task_write');
  });
});

describe('buildBasePrompt', () => {
  it('defaults the product name and co-author to Mastra Code and the platform bot', () => {
    const prompt = buildBasePrompt(promptContext());
    expect(prompt).toContain('You are Mastra Code, an interactive CLI coding agent');
    expect(prompt).toContain(
      'Co-Authored-By: mastra-platform[bot] <284800079+mastra-platform[bot]@users.noreply.github.com>',
    );
  });

  it('parameterizes productName and coAuthorName', () => {
    const prompt = buildBasePrompt(promptContext({ productName: 'Acme Coder', coAuthorName: 'Acme Bot' }));
    expect(prompt).toContain('You are Acme Coder, an interactive CLI coding agent');
    expect(prompt).toContain('Acme Coder has a goal mode');
    expect(prompt).toContain('Co-Authored-By: Acme Bot <284800079+mastra-platform[bot]@users.noreply.github.com>');
  });

  it('does not include the model id in the Co-Authored-By line', () => {
    const prompt = buildBasePrompt(promptContext({ modelId: 'openai/gpt-4o' }));
    expect(prompt).toContain(
      'Co-Authored-By: mastra-platform[bot] <284800079+mastra-platform[bot]@users.noreply.github.com>',
    );
    expect(prompt).not.toContain('Co-Authored-By: mastra-platform[bot] (openai/gpt-4o)');
  });

  it('parameterizes the Co-Authored-By email', () => {
    const prompt = buildBasePrompt(promptContext({ coAuthorName: 'Acme Bot', coAuthorEmail: 'bot@acme.dev' }));
    expect(prompt).toContain('Co-Authored-By: Acme Bot <bot@acme.dev>');
  });

  it('names the delivery wrapper the runtime emits, and no other', () => {
    const wrapped = signalToXmlMarkup({
      type: 'user',
      attributes: { delivery: 'while-active' },
      contents: 'fix the bug',
    });
    const openingTag = wrapped.slice(0, wrapped.indexOf('>') + 1);
    const emittedTagName = openingTag.slice(1, openingTag.indexOf(' '));
    const prompt = buildBasePrompt(promptContext());
    const namedTagNames = new Set([...prompt.matchAll(/<([a-zA-Z][\w-]*) delivery="/g)].map(([, name]) => name));

    expect(prompt).toContain(openingTag);
    expect(namedTagNames).toEqual(new Set([emittedTagName]));
  });
});
