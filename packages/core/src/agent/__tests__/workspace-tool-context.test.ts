import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { LocalFilesystem } from '../../workspace/filesystem';
import { Workspace } from '../../workspace/workspace';
import { Agent } from '../agent';

/**
 * Tests for workspace availability in tool execution context.
 *
 * These tests verify that:
 * 1. Workspace is passed to tools during agent execution (COR-426)
 * 2. Tools can access workspace.filesystem and workspace.sandbox
 * 3. Dynamic workspace configuration works (COR-411)
 */

// Note: v1 legacy path is deprecated and doesn't support workspace in tool context
// Tests only run for v2 and v3
function workspaceToolContextTest(version: 'v2' | 'v3') {
  let tempDir: string;
  let mockModel: MockLanguageModelV2 | MockLanguageModelV3;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tool-test-'));

    if (version === 'v2') {
      mockModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-workspace-1',
              toolName: 'workspaceTool',
              input: '{"action":"test"}',
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-workspace-1',
              toolName: 'workspaceTool',
              input: '{"action":"test"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });
    } else {
      // v3
      mockModel = new MockLanguageModelV3({
        doGenerate: async () => ({
          finishReason: 'tool-calls',
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-workspace-1',
              toolName: 'workspaceTool',
              input: '{"action":"test"}',
            },
          ],
          warnings: [],
        }),
        doStream: async () => ({
          stream: convertArrayToReadableStreamV3([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-workspace-1',
              toolName: 'workspaceTool',
              input: '{"action":"test"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 20, text: 20, reasoning: undefined },
              },
            },
          ]),
        }),
      });
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createWorkspace = (id: string) => {
    const filesystem = new LocalFilesystem({ basePath: tempDir });
    return new Workspace({
      id,
      name: `Test Workspace ${id}`,
      filesystem,
    });
  };

  describe(`${version} - Workspace in Tool Context`, () => {
    describe('Agent-level workspace', () => {
      it('should make workspace available to tools in generate', async () => {
        const workspace = createWorkspace('agent-workspace');
        let capturedWorkspace: Workspace | undefined;

        const workspaceTool = createTool({
          id: 'workspace-tool',
          description: 'A tool that verifies workspace is available',
          inputSchema: z.object({ action: z.string() }),
          execute: (_input, context) => {
            capturedWorkspace = context.workspace;
            return Promise.resolve({
              workspaceAvailable: !!context.workspace,
              workspaceId: context.workspace?.id,
              filesystemAvailable: !!context.workspace?.filesystem,
            });
          },
        });

        const agent = new Agent({
          id: 'workspace-test-agent',
          name: 'Workspace Test Agent',
          instructions: 'You are an agent that tests workspace availability.',
          model: mockModel,
          tools: { workspaceTool },
          workspace,
        });

        const response = await agent.generate('Use the workspace-tool');
        const toolCall = response.toolResults.find(
          (result: any) => result.payload.toolName === 'workspaceTool',
        ).payload;

        expect(toolCall?.result?.workspaceAvailable).toBe(true);
        expect(toolCall?.result?.workspaceId).toBe('agent-workspace');
        expect(toolCall?.result?.filesystemAvailable).toBe(true);
        expect(capturedWorkspace).toBe(workspace);
      });

      it('should make workspace available to tools in stream', async () => {
        const workspace = createWorkspace('stream-workspace');
        let capturedWorkspace: Workspace | undefined;

        const workspaceTool = createTool({
          id: 'workspace-tool',
          description: 'A tool that verifies workspace is available',
          inputSchema: z.object({ action: z.string() }),
          execute: (_input, context) => {
            capturedWorkspace = context.workspace;
            return Promise.resolve({
              workspaceAvailable: !!context.workspace,
              workspaceId: context.workspace?.id,
            });
          },
        });

        const agent = new Agent({
          id: 'workspace-test-agent',
          name: 'Workspace Test Agent',
          instructions: 'You are an agent that tests workspace availability.',
          model: mockModel,
          tools: { workspaceTool },
          workspace,
        });

        const stream = await agent.stream('Use the workspace-tool');
        await stream.consumeStream();
        const toolCall = (await stream.toolResults).find(
          (result: any) => result.payload.toolName === 'workspaceTool',
        ).payload;

        expect(toolCall?.result?.workspaceAvailable).toBe(true);
        expect(toolCall?.result?.workspaceId).toBe('stream-workspace');
        expect(capturedWorkspace).toBe(workspace);
      });
    });

    describe('Mastra-level workspace', () => {
      it('should make global workspace available to tools', async () => {
        const workspace = createWorkspace('global-workspace');
        let capturedWorkspace: Workspace | undefined;

        const workspaceTool = createTool({
          id: 'workspace-tool',
          description: 'A tool that verifies workspace is available',
          inputSchema: z.object({ action: z.string() }),
          execute: (_input, context) => {
            capturedWorkspace = context.workspace;
            return Promise.resolve({
              workspaceAvailable: !!context.workspace,
              workspaceId: context.workspace?.id,
            });
          },
        });

        const agent = new Agent({
          id: 'workspace-test-agent',
          name: 'Workspace Test Agent',
          instructions: 'You are an agent that tests workspace availability.',
          model: mockModel,
          tools: { workspaceTool },
        });

        const mastra = new Mastra({
          agents: { agent },
          workspace,
          logger: false,
        });

        const testAgent = mastra.getAgent('agent');

        const response = await testAgent.generate('Use the workspace-tool');
        const toolCall = response.toolResults.find(
          (result: any) => result.payload.toolName === 'workspaceTool',
        ).payload;

        expect(toolCall?.result?.workspaceAvailable).toBe(true);
        expect(toolCall?.result?.workspaceId).toBe('global-workspace');
        expect(capturedWorkspace).toBe(workspace);
      });
    });

    describe('No workspace configured', () => {
      it('should have undefined workspace when not configured', async () => {
        let capturedWorkspace: Workspace | undefined = undefined;
        let executeCalled = false;

        const workspaceTool = createTool({
          id: 'workspace-tool',
          description: 'A tool that verifies workspace is available',
          inputSchema: z.object({ action: z.string() }),
          execute: (_input, context) => {
            executeCalled = true;
            capturedWorkspace = context.workspace;
            return Promise.resolve({
              workspaceAvailable: !!context.workspace,
              workspaceId: context.workspace?.id,
            });
          },
        });

        const agent = new Agent({
          id: 'no-workspace-agent',
          name: 'No Workspace Agent',
          instructions: 'You are an agent without a workspace.',
          model: mockModel,
          tools: { workspaceTool },
        });

        const response = await agent.generate('Use the workspace-tool');
        const toolCall = response.toolResults.find(
          (result: any) => result.payload.toolName === 'workspaceTool',
        ).payload;

        expect(executeCalled).toBe(true);
        expect(toolCall?.result?.workspaceAvailable).toBe(false);
        expect(toolCall?.result?.workspaceId).toBeUndefined();
        expect(capturedWorkspace).toBeUndefined();
      });
    });

    describe('Agent workspace priority over Mastra workspace', () => {
      it('should use agent workspace over mastra workspace', async () => {
        const globalWorkspace = createWorkspace('global-workspace');
        const agentWorkspace = createWorkspace('agent-workspace');
        let capturedWorkspaceId: string | undefined;

        const workspaceTool = createTool({
          id: 'workspace-tool',
          description: 'A tool that verifies workspace is available',
          inputSchema: z.object({ action: z.string() }),
          execute: (_input, context) => {
            capturedWorkspaceId = context.workspace?.id;
            return Promise.resolve({
              workspaceId: context.workspace?.id,
            });
          },
        });

        const agent = new Agent({
          id: 'workspace-test-agent',
          name: 'Workspace Test Agent',
          instructions: 'You are an agent that tests workspace availability.',
          model: mockModel,
          tools: { workspaceTool },
          workspace: agentWorkspace,
        });

        const mastra = new Mastra({
          agents: { agent },
          workspace: globalWorkspace,
          logger: false,
        });

        const testAgent = mastra.getAgent('agent');

        const response = await testAgent.generate('Use the workspace-tool');
        const toolCall = response.toolResults.find(
          (result: any) => result.payload.toolName === 'workspaceTool',
        ).payload;

        // Agent workspace should take priority
        expect(toolCall?.result?.workspaceId).toBe('agent-workspace');
        expect(capturedWorkspaceId).toBe('agent-workspace');
      });
    });

    describe('Workspace with filesystem operations', () => {
      it('should allow tools to use workspace.filesystem', async () => {
        const workspace = createWorkspace('fs-workspace');

        // Create a mock model that calls fileTool (not workspaceTool)
        let fileToolMockModel: MockLanguageModelV2 | MockLanguageModelV3;
        if (version === 'v2') {
          fileToolMockModel = new MockLanguageModelV2({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              content: [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-file-1',
                  toolName: 'fileTool',
                  input: '{"action":"test"}',
                },
              ],
              warnings: [],
            }),
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-file-1',
                  toolName: 'fileTool',
                  input: '{"action":"test"}',
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            }),
          });
        } else {
          // v3
          fileToolMockModel = new MockLanguageModelV3({
            doGenerate: async () => ({
              finishReason: 'tool-calls',
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 20, text: 20, reasoning: undefined },
              },
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-file-1',
                  toolName: 'fileTool',
                  input: '{"action":"test"}',
                },
              ],
              warnings: [],
            }),
            doStream: async () => ({
              stream: convertArrayToReadableStreamV3([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-file-1',
                  toolName: 'fileTool',
                  input: '{"action":"test"}',
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: {
                    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 20, text: 20, reasoning: undefined },
                  },
                },
              ]),
            }),
          });
        }

        const fileTool = createTool({
          id: 'file-tool',
          description: 'A tool that uses workspace filesystem',
          inputSchema: z.object({ action: z.string() }),
          execute: async (_input, context) => {
            if (!context.workspace?.filesystem) {
              return { error: 'No filesystem available' };
            }

            // Write a test file
            await context.workspace.filesystem.writeFile('test.txt', 'Hello from tool!');

            // Read it back (returns Buffer, convert to string)
            const contentBuffer = await context.workspace.filesystem.readFile('test.txt');
            const content =
              typeof contentBuffer === 'string' ? contentBuffer : Buffer.from(contentBuffer).toString('utf-8');

            return {
              success: true,
              content,
            };
          },
        });

        const agent = new Agent({
          id: 'fs-test-agent',
          name: 'Filesystem Test Agent',
          instructions: 'You are an agent that tests filesystem.',
          model: fileToolMockModel,
          tools: { fileTool: fileTool as any },
          workspace,
        });

        const response = await agent.generate('Use the file-tool');
        const toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'fileTool').payload;

        expect(toolCall?.result?.success).toBe(true);
        expect(toolCall?.result?.content).toBe('Hello from tool!');

        // Verify file exists on disk
        const filePath = path.join(tempDir, 'test.txt');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        expect(fileContent).toBe('Hello from tool!');
      });
    });
  });
}

// Run tests for v2 and v3 SDK versions (v1 legacy doesn't support workspace in tool context)
workspaceToolContextTest('v2');
workspaceToolContextTest('v3');

describe('Dynamic workspace configuration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-dynamic-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createWorkspace = (id: string) => {
    const filesystem = new LocalFilesystem({ basePath: tempDir });
    return new Workspace({
      id,
      name: `Test Workspace ${id}`,
      filesystem,
    });
  };

  const createMockModel = () =>
    new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'tool-call',
            toolCallType: 'function',
            toolCallId: 'call-workspace-1',
            toolName: 'workspaceTool',
            input: '{"action":"test"}',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-workspace-1',
            toolName: 'workspaceTool',
            input: '{"action":"test"}',
            providerExecuted: false,
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

  it('should support dynamic workspace via function', async () => {
    const workspace1 = createWorkspace('workspace-1');
    const workspace2 = createWorkspace('workspace-2');

    const workspaceTool = createTool({
      id: 'workspace-tool',
      description: 'A tool that verifies workspace is available',
      inputSchema: z.object({ action: z.string() }),
      execute: (_input, context) => {
        return Promise.resolve({
          workspaceId: context.workspace?.id,
        });
      },
    });

    // Agent with dynamic workspace that selects based on requestContext
    const agent = new Agent({
      id: 'dynamic-workspace-agent',
      name: 'Dynamic Workspace Agent',
      instructions: 'You are an agent with dynamic workspace.',
      model: createMockModel(),
      tools: { workspaceTool },
      workspace: ({ requestContext }) => {
        const workspaceId = requestContext.get('workspaceId');
        return workspaceId === 'workspace-2' ? workspace2 : workspace1;
      },
    });

    // First call with workspace-1
    const requestContext1 = new RequestContext([['workspaceId', 'workspace-1']]);
    const response1 = await agent.generate('Use the workspace-tool', { requestContext: requestContext1 });
    const toolCall1 = response1.toolResults.find((result: any) => result.payload.toolName === 'workspaceTool').payload;

    expect(toolCall1?.result?.workspaceId).toBe('workspace-1');

    // Second call with workspace-2
    const requestContext2 = new RequestContext([['workspaceId', 'workspace-2']]);
    const response2 = await agent.generate('Use the workspace-tool', { requestContext: requestContext2 });
    const toolCall2 = response2.toolResults.find((result: any) => result.payload.toolName === 'workspaceTool').payload;

    expect(toolCall2?.result?.workspaceId).toBe('workspace-2');
  });

  it('should support dynamic workspace with mastra access', async () => {
    const workspace = createWorkspace('registered-workspace');
    let capturedWorkspaceId: string | undefined;

    const workspaceTool = createTool({
      id: 'workspace-tool',
      description: 'A tool that verifies workspace is available',
      inputSchema: z.object({ action: z.string() }),
      execute: (_input, context) => {
        capturedWorkspaceId = context.workspace?.id;
        return Promise.resolve({
          workspaceId: context.workspace?.id,
        });
      },
    });

    // Agent with dynamic workspace that uses mastra to look up workspace
    const agent = new Agent({
      id: 'mastra-lookup-agent',
      name: 'Mastra Lookup Agent',
      instructions: 'You are an agent that looks up workspace from mastra.',
      model: createMockModel(),
      tools: { workspaceTool },
      workspace: ({ mastra, requestContext }) => {
        const workspaceId = requestContext.get('workspaceId');
        if (workspaceId && mastra) {
          return mastra.getWorkspaceById(workspaceId);
        }
        return undefined;
      },
    });

    const mastra = new Mastra({
      agents: { agent },
      logger: false,
    });

    // Register workspace with mastra
    mastra.addWorkspace(workspace);

    const testAgent = mastra.getAgent('agent');
    const requestContext = new RequestContext([['workspaceId', 'registered-workspace']]);

    const response = await testAgent.generate('Use the workspace-tool', { requestContext });
    const toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'workspaceTool').payload;

    expect(toolCall?.result?.workspaceId).toBe('registered-workspace');
    expect(capturedWorkspaceId).toBe('registered-workspace');
  });

  it('should support async dynamic workspace function', async () => {
    const workspace = createWorkspace('async-workspace');
    let capturedWorkspaceId: string | undefined;

    const workspaceTool = createTool({
      id: 'workspace-tool',
      description: 'A tool that verifies workspace is available',
      inputSchema: z.object({ action: z.string() }),
      execute: (_input, context) => {
        capturedWorkspaceId = context.workspace?.id;
        return Promise.resolve({
          workspaceId: context.workspace?.id,
        });
      },
    });

    // Agent with async dynamic workspace
    const agent = new Agent({
      id: 'async-workspace-agent',
      name: 'Async Workspace Agent',
      instructions: 'You are an agent with async workspace resolution.',
      model: createMockModel(),
      tools: { workspaceTool },
      workspace: async () => {
        // Simulate async workspace lookup (e.g., from database)
        await new Promise(resolve => setTimeout(resolve, 10));
        return workspace;
      },
    });

    const response = await agent.generate('Use the workspace-tool');
    const toolCall = response.toolResults.find((result: any) => result.payload.toolName === 'workspaceTool').payload;

    expect(toolCall?.result?.workspaceId).toBe('async-workspace');
    expect(capturedWorkspaceId).toBe('async-workspace');
  });
});

// Note: Processor workspace integration (passing workspace to/from processors) is not yet implemented.
// The types (ProcessInputStepArgs.workspace, ProcessInputStepResult.workspace) were added to define
// the interface, but the execution flow doesn't yet pass workspace to processors or handle
// workspace returned from processors. This is a future enhancement.
//
// Current dynamic workspace support is via:
// 1. Agent config function: workspace: ({ requestContext, mastra }) => Workspace
// 2. prepareStep returning workspace (via PrepareStepResult.workspace type)
