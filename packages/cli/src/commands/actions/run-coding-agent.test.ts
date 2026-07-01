import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../..', () => ({
  analytics: {
    trackCommandExecution: vi.fn(async ({ execution }: { execution: () => Promise<void> }) => {
      await execution();
    }),
  },
  origin: 'test',
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

vi.mock('../utils', () => ({
  shouldSkipDotenvLoading: vi.fn().mockReturnValue(false),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('main\n'),
}));

const createCodingAgentMock = vi.fn();
const buildBasePromptMock = vi.fn().mockReturnValue('You are a coding agent.');
const streamMock = vi.fn();

vi.mock('@mastra/core/coding-agent', () => ({
  createCodingAgent: createCodingAgentMock,
  buildBasePrompt: buildBasePromptMock,
}));

function makeAsyncIterable(chunks: Array<{ type: string; payload?: Record<string, unknown> }>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe('runCodingAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    buildBasePromptMock.mockReturnValue('You are a coding agent.');
    streamMock.mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'text-delta', payload: { text: 'Hello ' } },
        { type: 'text-delta', payload: { text: 'world!' } },
      ]),
    });
    createCodingAgentMock.mockReturnValue({
      stream: streamMock,
    });
  });

  it('calls createCodingAgent with model, instructions, basePath, and tools', async () => {
    const { runCodingAgent } = await import('./run-coding-agent');

    await runCodingAgent({
      prompt: 'Fix the bug',
      model: 'openai/gpt-4o',
      basePath: '/repo',
    });

    expect(createCodingAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-4o',
        instructions: 'You are a coding agent.',
        basePath: '/repo',
        tools: {},
      }),
    );
  });

  it('calls buildBasePrompt with a PromptContext including modelId and projectPath', async () => {
    const { runCodingAgent } = await import('./run-coding-agent');

    await runCodingAgent({
      prompt: 'Fix the bug',
      model: 'openai/gpt-4o',
      basePath: '/repo',
    });

    expect(buildBasePromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: '/repo',
        projectName: 'repo',
        modelId: 'openai/gpt-4o',
        mode: 'build',
        gitBranch: 'main',
      }),
    );
  });

  it('calls agent.stream with the prompt string', async () => {
    const { runCodingAgent } = await import('./run-coding-agent');

    await runCodingAgent({
      prompt: 'Fix the bug',
      model: 'openai/gpt-4o',
    });

    expect(streamMock).toHaveBeenCalledWith('Fix the bug');
  });

  it('writes text-delta chunks to stdout', async () => {
    const { runCodingAgent } = await import('./run-coding-agent');

    await runCodingAgent({
      prompt: 'Fix the bug',
      model: 'openai/gpt-4o',
    });

    expect(process.stdout.write).toHaveBeenCalledWith('Hello ');
    expect(process.stdout.write).toHaveBeenCalledWith('world!');
  });

  it('writes tool-call names to stderr', async () => {
    streamMock.mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-call', payload: { toolName: 'read_file' } },
        { type: 'text-delta', payload: { text: 'done' } },
      ]),
    });

    const { runCodingAgent } = await import('./run-coding-agent');

    await runCodingAgent({
      prompt: 'Read the file',
      model: 'openai/gpt-4o',
    });

    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('read_file'));
  });

  it('defaults basePath to process.cwd()', async () => {
    const { runCodingAgent } = await import('./run-coding-agent');

    await runCodingAgent({
      prompt: 'Fix the bug',
      model: 'openai/gpt-4o',
    });

    expect(buildBasePromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: process.cwd(),
      }),
    );
  });

  it('tracks the command via analytics', async () => {
    const { analytics } = await import('../..');
    const { runCodingAgent } = await import('./run-coding-agent');

    await runCodingAgent({
      prompt: 'Fix the bug',
      model: 'openai/gpt-4o',
    });

    expect(analytics.trackCommandExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'mastra -p',
        origin: 'test',
      }),
    );
  });
});
