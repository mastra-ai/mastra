import { describe, expect, it, vi } from 'vitest';

import { RemoteController } from './remote-controller.js';
import { RemoteSession } from './remote-session.js';

const address = { url: 'https://factory.test', session: { token: 't', orgId: 'o' } };

function fakeRemote() {
  let onEvent: (event: any) => void = () => {};
  const remote = {
    create: vi.fn(async () => {}),
    state: vi.fn(async () => ({
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'anthropic/claude-opus-4-5',
      running: false,
      settings: { yolo: true, thinkingLevel: 'high', notifications: 'off', smartEditing: true },
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    })),
    getPermissions: vi.fn(async () => ({ categories: { execute: 'ask' }, tools: {} })),
    setPermissionForCategory: vi.fn(async () => {}),
    approveTool: vi.fn(async (): Promise<any> => ({ accepted: true })),
    respondToToolSuspension: vi.fn(async () => {}),
    subscribe: vi.fn(async (options: { onEvent: (event: any) => void }) => {
      onEvent = options.onEvent;
      return { unsubscribe: vi.fn() };
    }),
    sendMessage: vi.fn(async () => {}),
    followUp: vi.fn(async () => {}),
    switchModel: vi.fn(async () => {}),
    setState: vi.fn(async () => {}),
  };
  return { remote, emit: (event: any) => onEvent(event) };
}

async function connected() {
  const { remote, emit } = fakeRemote();
  const session = new RemoteSession(address, 'res-1', remote as any);
  await session.connect();
  return { session, remote, emit };
}

describe('RemoteSession', () => {
  it('is addressed by its session id and works on the resource the Factory reports', async () => {
    const { remote } = fakeRemote();
    remote.create.mockResolvedValueOnce({ sessionId: 'res-1', resourceId: 'factory-1' } as any);
    const session = new RemoteSession(address, 'res-1', remote as any);
    await session.connect();
    expect(session.identity.getId()).toBe('res-1');
    expect(session.identity.getResourceId()).toBe('factory-1');
    expect(remote.create).toHaveBeenCalledWith();
  });

  it('hydrates settings, token usage, and permission rules', async () => {
    const { session } = await connected();
    expect(session.state.get()).toMatchObject({ yolo: true, thinkingLevel: 'high' });
    expect(session.getTokenUsage()).toMatchObject({ totalTokens: 15 });
    expect(session.permissions.getRules()).toEqual({ categories: { execute: 'ask' }, tools: {} });
  });

  it('resolves the mode name and metadata from the controller modes', async () => {
    const { session } = await connected();
    session.setModes([{ id: 'build', name: 'Build', metadata: { color: '#fff' } } as any]);
    expect(session.mode.resolve()).toMatchObject({ name: 'Build', metadata: { color: '#fff' } });
  });

  it("forwards a message's scopes to the Factory, which decides whether to accept them", async () => {
    const { session, remote } = await connected();
    await session.sendMessage({ content: 'fix it', scopes: ['request:r25'] });
    expect(remote.sendMessage).toHaveBeenCalledWith({ content: 'fix it', files: undefined, scopes: ['request:r25'] });
    await session.sendMessage({ content: 'plain' });
    expect(remote.sendMessage).toHaveBeenLastCalledWith({ content: 'plain', files: undefined });
  });

  it('forwards attachments with a sent message', async () => {
    const { session, remote } = await connected();
    const files = [{ data: 'aGk=', mediaType: 'text/plain', filename: 'a.txt' }];
    session.sendSignal({ type: 'user', content: 'see file', files } as any);
    expect(remote.sendMessage).toHaveBeenCalledWith({ content: 'see file', files });
  });

  it('surfaces a rejected tool approval as an error event', async () => {
    const { session, remote } = await connected();
    remote.approveTool.mockResolvedValueOnce({ accepted: false, reason: 'not_pending' });
    const listener = vi.fn();
    session.subscribe(listener);
    session.respondToToolApproval({ decision: 'approve', toolCallId: 'call-1' });
    await vi.waitFor(() => expect(listener).toHaveBeenCalled());
    expect(listener.mock.calls[0][0].type).toBe('error');
    expect(listener.mock.calls[0][0].error.message).toContain('not_pending');
  });

  it('forwards "always allow" to the Factory as a thread grant, not a session policy', async () => {
    const { session, remote } = await connected();
    session.respondToToolApproval({ decision: 'always_allow_category', toolCallId: 'call-1' });
    await vi.waitFor(() =>
      expect(remote.approveTool).toHaveBeenCalledWith('call-1', true, { alwaysAllowCategory: true }),
    );
    expect(remote.setPermissionForCategory).not.toHaveBeenCalled();
  });

  it('rejects a suspension response when nothing is suspended', async () => {
    const { session } = await connected();
    await expect(session.respondToToolSuspension({ resumeData: 'yes' })).rejects.toThrow(/No pending/);
  });

  it('hydrates from the Factory snapshot', async () => {
    const { session } = await connected();
    expect(session.thread.getId()).toBe('thread-1');
    expect(session.mode.get()).toBe('build');
    expect(session.model.get()).toBe('anthropic/claude-opus-4-5');
    expect(session.identity.getResourceId()).toBe('res-1');
  });

  it('mirrors stream events and forwards them to listeners', async () => {
    const { session, emit } = await connected();
    const listener = vi.fn();
    session.subscribe(listener);

    emit({ type: 'model_changed', modelId: 'openai/gpt-5' });
    emit({ type: 'thread_changed', threadId: 'thread-2' });
    emit({ type: 'state_changed', state: { yolo: true }, changedKeys: ['yolo'] });

    expect(session.model.get()).toBe('openai/gpt-5');
    expect(session.thread.getId()).toBe('thread-2');
    expect(session.state.get()).toMatchObject({ yolo: true });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('rehydrates wire display state objects into Maps', async () => {
    const { session, emit } = await connected();
    emit({
      type: 'display_state_changed',
      displayState: {
        activeTools: { call1: { name: 'view' } },
        toolInputBuffers: {},
        pendingSuspensions: {},
        pendingApprovals: {},
        activeSubagents: {},
        modifiedFiles: { 'a.ts': { operations: [] } },
        tasks: [],
      },
    });
    const display = session.displayState.get();
    expect(display.activeTools).toBeInstanceOf(Map);
    expect(display.activeTools.get('call1')).toEqual({ name: 'view' });
    expect(display.modifiedFiles.has('a.ts')).toBe(true);
  });

  it('sends signals as messages when idle and follow-ups while running', async () => {
    const { session, remote, emit } = await connected();
    await session.sendSignal({ type: 'user', content: 'hi' } as any).persisted;
    expect(remote.sendMessage).toHaveBeenCalledWith('hi');

    emit({ type: 'agent_start' });
    await session.sendSignal({ type: 'user', content: 'more' } as any).persisted;
    expect(remote.followUp).toHaveBeenCalledWith('more');
  });

  it('maps the Factory echo of a sent user message onto the local id', async () => {
    const { session, emit } = await connected();
    const seen: any[] = [];
    session.subscribe(event => void seen.push(event));
    const signal = session.sendSignal({ type: 'user', content: 'hi' } as any);
    await signal.persisted;

    const echo = {
      id: 'server-1',
      role: 'signal',
      content: { format: 2, parts: [], metadata: { signal: { type: 'user' } } },
    };
    const stateSignal = {
      id: 'state-1',
      role: 'signal',
      content: { format: 2, parts: [], metadata: { signal: { type: 'state' } } },
    };
    emit({ type: 'message_start', message: echo });
    emit({ type: 'message_end', message: echo });
    emit({ type: 'message_start', message: stateSignal });
    emit({ type: 'message_start', message: { id: 'a-1', role: 'assistant', content: {} } });

    expect(seen.map(e => e.message.id)).toEqual([signal.id, signal.id, 'state-1', 'a-1']);
  });

  it('forwards model switches with positional args', async () => {
    const { session, remote } = await connected();
    await session.model.switch('openai/gpt-5', { thinkingLevel: 'high' });
    expect(remote.switchModel).toHaveBeenCalledWith('openai/gpt-5', { thinkingLevel: 'high' });
  });
});

describe('RemoteController', () => {
  function controller(models: unknown[] = []) {
    const remote = {
      listModes: vi.fn(async () => [{ id: 'build', name: 'Build' }]),
      listModels: vi.fn(async () => models),
    };
    return { controller: new RemoteController(address, remote as any), remote };
  }

  it('lists Factory modes after connect', async () => {
    const { controller: c } = controller();
    await c.connect();
    expect(c.listModes()).toEqual([{ id: 'build', name: 'Build' }]);
  });

  it('caches models until invalidated', async () => {
    const { controller: c, remote } = controller([{ id: 'a/b' }]);
    await c.listAvailableModels();
    await c.listAvailableModels();
    expect(remote.listModels).toHaveBeenCalledTimes(1);
    c.invalidateAvailableModelsCache();
    await c.listAvailableModels();
    expect(remote.listModels).toHaveBeenCalledTimes(2);
  });

  it('reports Factory auth status for the current model', async () => {
    const { controller: c } = controller([{ id: 'anthropic/x', hasApiKey: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' }]);
    expect(await c.getCurrentModelAuthStatus({ model: { get: () => 'anthropic/x' } })).toEqual({
      hasAuth: false,
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    });
    expect(await c.getCurrentModelAuthStatus({ model: { get: () => 'unknown/y' } })).toEqual({ hasAuth: true });
  });
});
