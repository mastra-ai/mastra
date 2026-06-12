import { beforeEach, describe, expect, it, vi } from 'vitest';

let legacyState: Record<string, unknown>;
let legacySetState: ReturnType<typeof vi.fn<(updates: Record<string, unknown>) => void>>;
let legacySwitchThread: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacySwitchMode: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacySetThreadSetting: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacyListModes: ReturnType<typeof vi.fn<() => unknown[]>>;

vi.mock('@mastra/core/harness', () => ({
  Harness: class {
    constructor(_args: unknown) {
      void (this as { setState: (updates: Record<string, unknown>) => Promise<void> }).setState({
        currentModelId: 'constructor-model',
      });
    }

    getState() {
      return legacyState;
    }

    setState(updates: Record<string, unknown>) {
      legacySetState(updates);
      legacyState = { ...legacyState, ...updates };
      return Promise.resolve();
    }

    switchThread(opts: unknown) {
      legacySwitchThread(opts);
      return Promise.resolve();
    }

    switchMode(opts: unknown) {
      legacySwitchMode(opts);
      return Promise.resolve();
    }

    setThreadSetting(opts: unknown) {
      legacySetThreadSetting(opts);
      return Promise.resolve();
    }

    getSubagentModelId({ agentType }: { agentType?: string } = {}) {
      if (agentType) {
        const perType = legacyState[`subagentModelId_${agentType}`];
        if (typeof perType === 'string') return perType;
      }
      const global = legacyState.subagentModelId;
      return typeof global === 'string' ? global : null;
    }

    async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }) {
      const key = agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
      await this.setState({ [key]: modelId });
      await this.setThreadSetting({ key, value: modelId });
    }

    getResourceId() {
      return 'resource-id';
    }

    listModes() {
      return legacyListModes();
    }
  },
}));

const buildMode = { id: 'build', defaultModelId: 'default-model', metadata: { agentId: 'agent' } };
const planMode = { id: 'plan', defaultModelId: 'plan-model', metadata: { agentId: 'agent' } };

function createSession(initialModelId = 'session-model') {
  let modelId = initialModelId;
  let mode = buildMode;
  let state: Record<string, unknown> = { projectPath: '/session-repo' };

  return {
    getState: vi.fn(() => state),
    setState: vi.fn((updates: Record<string, unknown>) => {
      state = { ...state, ...updates };
      return Promise.resolve();
    }),
    getModelId: vi.fn(() => modelId),
    setModelId: vi.fn((next: string) => {
      modelId = next;
    }),
    getMode: vi.fn(() => mode),
    setMode: vi.fn(next => {
      mode = next;
    }),
  };
}

describe('HarnessCompat session-derived state', () => {
  beforeEach(() => {
    legacyState = { projectPath: '/repo', subagentModelId_worker: 'worker-model' };
    legacySetState = vi.fn();
    legacySwitchThread = vi.fn();
    legacySwitchMode = vi.fn();
    legacySetThreadSetting = vi.fn();
    legacyListModes = vi.fn(() => []);
  });

  it('composes model and mode from the active session', async () => {
    const { HarnessCompat } = await import('./HarnessCompat.js');
    const session = createSession();
    const harnessV1 = {
      session: vi.fn(async () => session),
      getMode: vi.fn((modeId: string) => (modeId === 'plan' ? planMode : buildMode)),
    };

    const harness = new HarnessCompat({} as never, harnessV1 as never);
    await harness.switchThread({ threadId: 'thread-id' });

    expect(harness.getState()).toMatchObject({
      projectPath: '/session-repo',
      currentModelId: 'session-model',
      modeId: 'build',
    });
    expect(harnessV1.session).toHaveBeenCalledWith({ threadId: 'thread-id', resourceId: 'resource-id' });
  });

  it('preserves the current model when switching threads', async () => {
    const { HarnessCompat } = await import('./HarnessCompat.js');
    const firstSession = createSession('selected-model');
    const secondSession = createSession('stored-thread-model');
    const harnessV1 = {
      session: vi.fn().mockResolvedValueOnce(firstSession).mockResolvedValueOnce(secondSession),
      getMode: vi.fn((modeId: string) => (modeId === 'plan' ? planMode : buildMode)),
    };

    const harness = new HarnessCompat({} as never, harnessV1 as never);
    await harness.switchThread({ threadId: 'first-thread' });
    await harness.switchThread({ threadId: 'second-thread' });

    expect(secondSession.setModelId).toHaveBeenCalledWith('selected-model');
    expect(harness.getState()).toMatchObject({ currentModelId: 'selected-model' });
  });

  it('routes session-derived setState fields to the session and harness fields to legacy state', async () => {
    const { HarnessCompat } = await import('./HarnessCompat.js');
    const session = createSession();
    const harnessV1 = {
      session: vi.fn(async () => session),
      getMode: vi.fn((modeId: string) => (modeId === 'plan' ? planMode : buildMode)),
    };

    const harness = new HarnessCompat({} as never, harnessV1 as never);
    await harness.switchThread({ threadId: 'thread-id' });

    await harness.setState({
      currentModelId: 'new-session-model',
      modeId: 'plan',
      projectPath: '/new-repo',
    } as never);

    expect(session.setModelId).toHaveBeenCalledWith('new-session-model');
    expect(session.setMode).toHaveBeenCalledWith(planMode);
    expect(legacySwitchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    expect(session.setState).toHaveBeenCalledWith({ projectPath: '/new-repo' });
    expect(legacySetState).toHaveBeenCalledWith({ projectPath: '/new-repo' });
    expect(harness.getState()).toMatchObject({
      projectPath: '/new-repo',
      currentModelId: 'new-session-model',
      modeId: 'plan',
    });
  });

  it('keeps per-agent subagent model overrides in harness state', async () => {
    const { HarnessCompat } = await import('./HarnessCompat.js');
    const session = createSession();
    const harnessV1 = {
      session: vi.fn(async () => session),
      getMode: vi.fn((modeId: string) => (modeId === 'plan' ? planMode : buildMode)),
    };

    const harness = new HarnessCompat({} as never, harnessV1 as never);
    await harness.switchThread({ threadId: 'thread-id' });

    expect(harness.getSubagentModelId({ agentType: 'worker' })).toBe('worker-model');
    expect(harness.getSubagentModelId()).toBeNull();

    await harness.setSubagentModelId({ modelId: 'default-subagent-model' });

    expect(legacySetState).toHaveBeenCalledWith({ subagentModelId: 'default-subagent-model' });
    expect(harness.getSubagentModelId()).toBe('default-subagent-model');
  });
});
