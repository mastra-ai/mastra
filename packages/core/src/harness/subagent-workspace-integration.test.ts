import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WORKSPACE_TOOLS } from '../workspace/constants';
import { LocalFilesystem } from '../workspace/filesystem';
import { Workspace } from '../workspace/workspace';
import { createSubagentTool } from './tools';
import type { HarnessSubagent } from './types';

describe('subagent workspace tool integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-ws-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  function createWorkspace() {
    return new Workspace({
      id: 'test-ws',
      name: 'Test Workspace',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
  }

  it('subagent executes a workspace read_file tool against a real file', async () => {
    const testContent = 'Hello from workspace!';
    await fs.writeFile(path.join(tempDir, 'hello.txt'), testContent);

    const workspace = createWorkspace();

    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${callCount}`,
                modelId: 'mock',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'ws-tool-1',
                toolName: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
                input: JSON.stringify({ path: '/hello.txt' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: `id-${callCount}`,
              modelId: 'mock',
              timestamp: new Date(0),
            },
            { type: 'text-delta', textDelta: 'File read successfully.' },
            {
              type: 'finish',
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const subagents: HarnessSubagent[] = [
      {
        id: 'explorer',
        name: 'Explorer',
        description: 'Reads files.',
        instructions: 'Read files.',
        allowedWorkspaceTools: [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE, WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES],
      },
    ];

    const tool = createSubagentTool({
      subagents,
      resolveModel: () => model as any,
      fallbackModelId: 'mock',
    });

    const result = await (tool as any).execute(
      { agentType: 'explorer', task: 'Read hello.txt' },
      { workspace, agent: { toolCallId: 'tc-1' } },
    );

    expect(result.isError).toBe(false);
    // Subagent tool result must not include the internal `<subagent-meta />`
    // tag in model-facing content (it would otherwise leak into the parent
    // model's context and could be echoed back as visible assistant text).
    expect(result.content).not.toContain('<subagent-meta');
  });

  it('prepareStep only sends allowed workspace tools to the model', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'test');

    const workspace = createWorkspace();

    // Capture the tools the model actually receives
    let receivedToolNames: string[] = [];

    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        callCount++;
        // Capture tool names from the prepared tools
        if (options?.tools) {
          receivedToolNames = options.tools.map((t: any) => t.name);
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: `id-${callCount}`,
              modelId: 'mock',
              timestamp: new Date(0),
            },
            { type: 'text-delta', textDelta: 'Done.' },
            {
              type: 'finish',
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const subagents: HarnessSubagent[] = [
      {
        id: 'reader',
        name: 'Reader',
        description: 'Only read tools.',
        instructions: 'Only read.',
        // Only allow read_file and list_files — NOT write_file or execute_command
        allowedWorkspaceTools: [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE, WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES],
      },
    ];

    const tool = createSubagentTool({
      subagents,
      resolveModel: () => model as any,
      fallbackModelId: 'mock',
    });

    await (tool as any).execute(
      { agentType: 'reader', task: 'List files' },
      { workspace, agent: { toolCallId: 'tc-2' } },
    );

    // The model should have received ONLY the allowed workspace tools
    expect(receivedToolNames).toContain(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(receivedToolNames).toContain(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    // Write and execute tools should NOT be sent to the model
    expect(receivedToolNames).not.toContain(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(receivedToolNames).not.toContain(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });
});
