import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { dispatchDueNotifications } from '@mastra/core/notifications';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { LocalFilesystem, Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';
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

    const { controller, codeAgent, mastra } = await mountRestrictedAgentControllerOnMastra({
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

    // Persisted allow rules would auto-approve tools just like yolo; clients may only tighten approval.
    await expect(session.permissions.setForCategory({ category: 'execute', policy: 'allow' })).rejects.toThrow(
      'Invalid state update',
    );
    await expect(session.permissions.setForTool({ toolName: 'view', policy: 'allow' })).rejects.toThrow(
      'Invalid state update',
    );
    expect(session.resolveToolApproval('view')).toBe('ask');
    expect(session.permissions.getRules()).toEqual({ categories: {}, tools: {} });
    await session.permissions.setForTool({ toolName: 'view', policy: 'deny' });
    expect(session.resolveToolApproval('view')).toBe('deny');
    await session.permissions.setForTool({ toolName: 'view', policy: 'ask' });

    // A client-selected model id must not add provider-side fallback models to the host's model.
    await session.model.switch('anthropic/claude-fable-5');
    await session.sendMessage({ content: 'Delete protected.txt' });

    const streamOptions = stream.mock.calls[0]![1];
    expect(streamOptions?.providerOptions?.anthropic).toBeUndefined();
    expect(streamOptions?.activeTools).toEqual(['view']);
    expect(streamOptions?.activeTools).not.toContain('delete_file');
    expect(deleteFile).not.toHaveBeenCalled();
    await expect(filesystem.readFile('protected.txt', { encoding: 'utf-8' })).resolves.toBe('keep me');

    // The model catalog must not reveal which providers the server process has credentials for.
    await expect(controller.listAvailableModels()).resolves.toEqual([]);

    const streamCalls = stream.mock.calls.length;

    // The generic agent routes resolve agents through Mastra, outside controller approval.
    expect(mastra.listAgents()).toEqual({});
    expect(() => mastra.getAgentById(codeAgent.id)).toThrow();

    // Mastra's dispatcher would run a delivery outside the controller, so nothing is scheduled for it.
    for (const priority of ['low', 'urgent'] as const) {
      const sent = await session.sendNotificationSignal({ source: 'ci', kind: 'status', priority, summary: 'Done' });
      expect(sent.decision?.action).toBe('persist');
      expect(sent.record).toMatchObject({ status: 'pending', deliverAt: undefined, summaryAt: undefined });
    }
    expect(stream).toHaveBeenCalledTimes(streamCalls);
    const notifications = (await mastra.getStorage()!.getStore('notifications'))!;

    // A scheduled record from a regular Mastra Code agent on the same thread must not absorb a restricted send.
    const scheduled = await notifications.createNotification({
      agentId: 'code-agent',
      resourceId: session.identity.getResourceId(),
      threadId: session.thread.getId()!,
      source: 'ci',
      kind: 'status',
      summary: 'Queued',
      coalesceKey: 'ci-status',
      deliverAt: new Date(0),
    });
    const coalescable = await session.sendNotificationSignal({
      source: 'ci',
      kind: 'status',
      summary: 'Done',
      coalesceKey: 'ci-status',
    });
    expect(coalescable.record.id).not.toBe(scheduled.id);
    expect(coalescable.record).toMatchObject({ agentId: codeAgent.id, deliverAt: undefined });
    await expect(
      notifications.getNotification({ threadId: scheduled.threadId, id: scheduled.id }),
    ).resolves.toMatchObject({
      summary: 'Queued',
    });
    await notifications.updateNotification({ id: scheduled.id, threadId: scheduled.threadId, status: 'discarded' });
    const dispatched = await dispatchDueNotifications({
      mastra,
      storage: notifications,
      now: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    expect(dispatched).toMatchObject({ delivered: [], failed: [] });
  });

  it('reports no observational memory model when the injected memory configures one', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({ storage, options: { observationalMemory: { model: 'openai/gpt-4o-mini' } } });
    const { controller } = await mountRestrictedAgentControllerOnMastra({
      project: {
        resourceId: 'remote-project-1',
        name: 'remote-project',
        rootPath: '/remote/workspace',
      },
      model: new MastraLanguageModelV2Mock({}),
      instructions: 'Use only host-provided capabilities.',
      modes: [{ id: 'build', metadata: { default: true } }],
      allowedTools: [],
      workspace: new Workspace({
        id: 'remote-workspace',
        filesystem: new LocalFilesystem({ basePath: tempDirectory }),
      }),
      storage,
      memory,
      initialState: { observerModelSelection: 'openai/gpt-5', reflectorModelId: 'openai/gpt-5' },
    });
    const session = await controller.createSession({ id: 'session-om', ownerId: 'owner-1' });
    await session.thread.create();

    for (const role of [session.om.observer, session.om.reflector]) {
      expect(role.model()).toBeUndefined();
      expect(role.modelId()).toBeUndefined();
      expect(role.resolvedModel()).toBeUndefined();
    }

    // Session tags are seeded into state unvalidated, so they can't name a state field.
    for (const tags of [
      { observerModelSelection: 'openai/gpt-5' },
      { skipGlobalInstructions: 'false' },
      { projectPath: '/other/workspace' },
    ]) {
      await expect(controller.createSession({ id: 'session-tags', ownerId: 'owner-1', tags })).rejects.toMatchObject({
        message: expect.stringContaining("can't set state fields"),
        details: { status: 400 },
      });
    }
    expect(await controller.getSession('session-tags')).toBeUndefined();
    const scoped = await controller.createSession({
      id: 'session-scoped',
      ownerId: 'owner-1',
      tags: { worktree: 'a' },
    });
    expect(scoped.om.observer.modelId()).toBeUndefined();

    await expect(session.om.observer.switchModel({ modelId: 'openai/gpt-5' })).rejects.toThrow('Invalid state update');
    await expect(session.om.reflector.switchModel({ modelId: 'auto' })).rejects.toThrow('Invalid state update');
    expect(session.om.observer.modelId()).toBeUndefined();
    expect(session.om.reflector.modelId()).toBeUndefined();
  });
});
