/**
 * Repro for https://github.com/mastra-ai/mastra/issues/21054 at the
 * AgentController/Session level (the layer Mastra Code CLI runs on).
 *
 * A tool that throws (ENOENT-style filesystem error) must not halt the run:
 * the error is fed back to the model as a tool error, the loop continues, and
 * the model produces a recovery answer.
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../../workspace/constants';
import { LocalFilesystem } from '../../workspace/filesystem';
import { Workspace } from '../../workspace/workspace';

import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

vi.setConfig({ testTimeout: 30_000 });

function toolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'view',
        input: '{"path": ".changeset/missing.md"}',
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

function recoveryTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-2', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'That file does not exist.' });
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

describe('AgentController: tool execution failure recovery (#21054)', () => {
  it('continues the run after a tool throws and lets the model answer', async () => {
    const fileError = Object.assign(new Error('File not found: .changeset/missing.md'), {
      name: 'FileNotFoundError',
      code: 'ENOENT',
      path: '.changeset/missing.md',
    });

    const viewTool = createTool({
      id: 'view',
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      execute: async () => {
        throw fileError;
      },
    });

    const prompts: any[] = [];
    let callCount = 0;
    const model = new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }: any) => {
        callCount++;
        prompts.push(prompt);
        return { stream: callCount === 1 ? toolCallStream() : recoveryTextStream() };
      },
    });

    const agent = new Agent({
      id: 'agent-tool-error',
      name: 'Agent Tool Error',
      instructions: 'You are a helpful assistant.',
      model,
      tools: { view: viewTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { 'agent-tool-error': agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent('agent-tool-error');

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-tool-error',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();

    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'view .changeset/missing.md' });

    // The model must be called a second time (the loop continued after the failure).
    expect(callCount).toBe(2);

    // The second prompt must contain the tool failure so the model can recover.
    const secondPrompt = JSON.stringify(prompts[1] ?? []);
    expect(secondPrompt).toMatch(/File not found/);

    // The run must not end in an error state.
    const agentEnd = events.find(e => e.type === 'agent_end');
    expect(agentEnd?.reason).not.toBe('error');

    // The tool failure surfaces as a tool_end with isError, not a run-fatal error event.
    const toolEnd = events.find(e => e.type === 'tool_end' && e.toolCallId === 'call-1');
    expect(toolEnd?.isError).toBe(true);

    // The recovery answer is streamed.
    const messageEnd = [...events].reverse().find(e => e.type === 'message_end');
    const text = JSON.stringify(messageEnd?.message.content.parts ?? []);
    expect(text).toContain('That file does not exist.');
  });

  it('continues the run when an APPROVED tool throws (approval suspend/resume path)', async () => {
    const fileError = Object.assign(new Error('EACCES: permission denied, open /etc/shadow'), {
      name: 'PermissionDeniedError',
      code: 'EACCES',
      path: '/etc/shadow',
    });

    const viewTool = createTool({
      id: 'view',
      description: 'Read a file',
      inputSchema: z.object({ path: z.string() }),
      requireApproval: true,
      execute: async () => {
        throw fileError;
      },
    });

    const prompts: any[] = [];
    let callCount = 0;
    const model = new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }: any) => {
        callCount++;
        prompts.push(prompt);
        return { stream: callCount === 1 ? toolCallStream() : recoveryTextStream() };
      },
    });

    const agent = new Agent({
      id: 'agent-tool-error-approval',
      name: 'Agent Tool Error Approval',
      instructions: 'You are a helpful assistant.',
      model,
      tools: { view: viewTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { 'agent-tool-error-approval': agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent('agent-tool-error-approval');

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-tool-error-approval',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session-approval', ownerId: 'test-owner' });
    await session.thread.create();

    const events: any[] = [];
    const ended = new Promise<void>(resolve => {
      session.subscribe((event: any) => {
        events.push(event);
        if (event.type === 'agent_end') resolve();
      });
    });
    session.subscribe((event: any) => {
      if (event.type === 'tool_approval_required') {
        void session.respondToToolApproval({ decision: 'approve' });
      }
    });

    await session.sendMessage({ content: 'view /etc/shadow' });
    await ended;

    // No fatal error event; run must not end in error.
    const agentEnd = events.find(e => e.type === 'agent_end');
    expect(events.filter(e => e.type === 'error')).toEqual([]);
    expect(agentEnd?.reason).not.toBe('error');

    // The loop continued: model called again with the failure in context.
    expect(callCount).toBe(2);
    const secondPrompt = JSON.stringify(prompts[1] ?? []);
    expect(secondPrompt).toMatch(/EACCES/);

    // The recovery answer is streamed.
    const messageEnd = [...events].reverse().find(e => e.type === 'message_end');
    const text = JSON.stringify(messageEnd?.message.content.parts ?? []);
    expect(text).toContain('That file does not exist.');
  });

  it('continues the run when the workspace view tool hits FileNotFoundError (full Mastra Code stack)', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-error-ws-'));
    try {
      const workspace = new Workspace({
        id: 'test-ws',
        name: 'Test Workspace',
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: { [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { name: 'view' } },
      });

      const prompts: any[] = [];
      let callCount = 0;
      const model = new MastraLanguageModelV2Mock({
        doStream: async ({ prompt }: any) => {
          callCount++;
          prompts.push(prompt);
          return { stream: callCount === 1 ? toolCallStream() : recoveryTextStream() };
        },
      });

      const agent = new Agent({
        id: 'agent-ws-tool-error',
        name: 'Agent WS Tool Error',
        instructions: 'You are a helpful assistant.',
        model,
      });

      const storage = new InMemoryStore();
      const mastra = new Mastra({ agents: { 'agent-ws-tool-error': agent }, logger: false, storage });
      const registeredAgent = mastra.getAgent('agent-ws-tool-error');

      const controller = new AgentController({
        workspace,
        id: 'controller-ws-tool-error',
        storage,
        modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
        initialState: { yolo: true } as any,
      });

      await controller.init();
      const session = await controller.createSession({ id: 'test-session-ws', ownerId: 'test-owner' });
      await session.thread.create();

      const events: any[] = [];
      session.subscribe((event: any) => {
        events.push(event);
      });

      await session.sendMessage({ content: 'view .changeset/missing.md' });

      // No fatal error event; run must not end in error.
      expect(events.filter(e => e.type === 'error')).toEqual([]);
      expect(events.find(e => e.type === 'agent_end')?.reason).not.toBe('error');

      // The loop continued: model called again with the failure in context.
      expect(callCount).toBe(2);
      const secondPrompt = JSON.stringify(prompts[1] ?? []);
      expect(secondPrompt).toMatch(/File not found/);

      // The recovery answer is streamed.
      const messageEnd = [...events].reverse().find(e => e.type === 'message_end');
      const text = JSON.stringify(messageEnd?.message.content.parts ?? []);
      expect(text).toContain('That file does not exist.');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
