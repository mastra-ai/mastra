import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { LocalFilesystem, Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountRestrictedAgentControllerOnMastra } from './restricted.js';

/** Creates a model stream that requests one workspace tool. */
function toolCallStream(toolName: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'response-1',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'tool-call-1',
        toolName,
        input: '{"path":"protected.txt"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      controller.close();
    },
  });
}

/** Creates the final text response after a tool-call turn. */
function textStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'response-2',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Done.' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      controller.close();
    },
  });
}

describe('restricted workspace tool enforcement', () => {
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'restricted-workspace-'));
  });

  afterEach(async () => {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  });

  it('hides and blocks a workspace tool omitted from the global allowlist', async () => {
    const filesystem = new LocalFilesystem({ basePath: tempDirectory });
    await filesystem.writeFile('protected.txt', 'keep me');
    const deleteFile = vi.spyOn(filesystem, 'deleteFile');
    let modelCall = 0;
    const model = new MastraLanguageModelV2Mock({
      doStream: async () => ({
        stream: modelCall++ === 0 ? toolCallStream('delete_file') : textStream(),
      }),
    });
    const workspace = new Workspace({
      id: 'remote-workspace',
      filesystem,
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { name: 'view' },
        [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { name: 'delete_file' },
      },
    });

    const { controller, codeAgent } = await mountRestrictedAgentControllerOnMastra({
      project: {
        resourceId: 'remote-project-1',
        name: 'remote-project',
        rootPath: '/remote/workspace',
      },
      model,
      instructions: 'Use only host-provided capabilities.',
      modes: [{ id: 'build', metadata: { default: true } }],
      allowedTools: ['view'],
      workspace,
      storage: new InMemoryStore(),
      memory: false,
    });
    const stream = vi.spyOn(codeAgent, 'stream');
    const session = await controller.createSession({ id: 'session-1', ownerId: 'owner-1' });
    await session.thread.create();

    expect(session.state.get().yolo).toBe(false);
    await expect(session.state.set({ yolo: true } as never)).rejects.toThrow('Invalid state update');
    expect(session.state.get().yolo).toBe(false);

    await session.sendMessage({ content: 'Delete protected.txt' });

    const streamOptions = stream.mock.calls[0]![1];
    expect(streamOptions?.activeTools).toEqual(['view']);
    expect(streamOptions?.activeTools).not.toContain('delete_file');
    expect(deleteFile).not.toHaveBeenCalled();
    await expect(filesystem.readFile('protected.txt', { encoding: 'utf-8' })).resolves.toBe('keep me');
  });
});
