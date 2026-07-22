import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));
vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

const originalEnv = { ...process.env };

function createRequestContext(projectPath: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
    sandboxAllowedPaths: [],
  });
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: {
      state: {
        get: getState,
      },
    },
  });
  return requestContext;
}

function toStream(chunks: any[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('mastracode workspace sandbox environment', () => {
  it('provides an isolated workspace for Factory supervisor sessions without a project path', async () => {
    const requestContext = new RequestContext();
    const getState = () => ({ factorySupervisor: true });
    requestContext.set('controller', {
      modeId: 'build',
      getState,
      session: { state: { get: getState } },
    });

    const { getDynamicWorkspace } = await import('../workspace.js');
    const workspace = await getDynamicWorkspace({ requestContext: requestContext as any });

    expect(workspace.id).toBe('mastracode-factory-supervisor');
    expect(workspace.sandbox).toBeUndefined();
  });

  it('passes arbitrary parent environment variables to local subprocesses', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-env-'));

    try {
      process.env.MASTRACODE_TEST_ENV = 'works';
      const { getDynamicWorkspace } = await import('../workspace.js');
      const workspace = await getDynamicWorkspace({ requestContext: createRequestContext(tempDir) as any });

      const result = await workspace.sandbox!.executeCommand!('node -e "console.log(process.env.MASTRACODE_TEST_ENV)"');

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('works');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('runs hook manager around workspace tools through agent hooks', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-hooks-'));

    try {
      const { getDynamicWorkspace } = await import('../workspace.js');
      const { createToolHooks } = await import('../tools.js');
      const requestContext = createRequestContext(tempDir) as any;
      const hookManager = {
        runPreToolUse: vi.fn(async () => ({ allowed: true })),
        runPostToolUse: vi.fn(async () => undefined),
      };
      let callCount = 0;
      await fs.writeFile(path.join(tempDir, 'hooked.txt'), 'original');
      const workspace = await getDynamicWorkspace({ requestContext });
      const agent = new Agent({
        id: 'mc-workspace-hook-agent',
        name: 'MC Workspace Hook Agent',
        instructions: 'You are a test agent.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: toStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolCallType: 'function',
                    toolName: 'write_file',
                    input: JSON.stringify({ path: 'hooked.txt', content: 'hooked', overwrite: true }),
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                  },
                ]),
              };
            }

            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: toStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Done.' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]),
            };
          },
        }) as any,
        workspace,
        hooks: createToolHooks(hookManager as any),
      });

      const result = await agent.stream('Write hooked.txt', { requestContext });
      const chunks: any[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(hookManager.runPreToolUse).toHaveBeenCalledWith('write_file', {
        path: 'hooked.txt',
        content: 'hooked',
        overwrite: true,
      });
      expect(hookManager.runPostToolUse).toHaveBeenCalledWith(
        'write_file',
        { path: 'hooked.txt', content: 'hooked', overwrite: true },
        expect.anything(),
        false,
      );
      await expect(fs.readFile(path.join(tempDir, 'hooked.txt'), 'utf8')).resolves.toBe('hooked');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
