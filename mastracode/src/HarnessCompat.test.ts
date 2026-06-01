import { beforeEach, describe, expect, it, vi } from 'vitest';

let legacyState: Record<string, unknown>;
let legacySetState: ReturnType<typeof vi.fn<(updates: Record<string, unknown>) => void>>;
let legacySwitchThread: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacySwitchMode: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacySetThreadSetting: ReturnType<typeof vi.fn<(opts: unknown) => void>>;
let legacyListModes: ReturnType<typeof vi.fn<() => unknown[]>>;

vi.mock('@mastra/core/harness', () => ({
  Harness: class {
    constructor(_args: unknown) {}

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

    getResourceId() {
      return 'resource-id';
    }

    listModes() {
      return legacyListModes();
    }
  },
}));

const buildMode = { id: 'build', agentId: 'agent', defaultModelId: 'default-model' };
const planMode = { id: 'plan', agentId: 'agent', defaultModelId: 'plan-model' };

function createSession() {
  let modelId = 'session-model';
  let subagentModelId: string | undefined = 'session-subagent-model';
  let mode = buildMode;

  return {
    getModelId: vi.fn(() => modelId),
    setModelId: vi.fn((next: string) => {
      modelId = next;
    }),
    getSubagentModelId: vi.fn(() => subagentModelId),
    setSubagentModelId: vi.fn((next: string | undefined) => {
      subagentModelId = next;
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

  it('composes model, mode, and default subagent model from the active session', async () => {
    const { HarnessCompat } = await import('./HarnessCompat.js');
    const session = createSession();
    const harnessV1 = {
      session: vi.fn(async () => session),
      getMode: vi.fn((modeId: string) => (modeId === 'plan' ? planMode : buildMode)),
    };

    const harness = new HarnessCompat({} as never, harnessV1 as never);
    await harness.switchThread({ threadId: 'thread-id' });

    expect(harness.getState()).toMatchObject({
      projectPath: '/repo',
      currentModelId: 'session-model',
      modeId: 'build',
      subagentModelId: 'session-subagent-model',
    });
    expect(harnessV1.session).toHaveBeenCalledWith({ threadId: 'thread-id', resourceId: 'resource-id' });
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
      subagentModelId: 'new-session-subagent-model',
      modeId: 'plan',
      projectPath: '/new-repo',
    } as never);

    expect(session.setModelId).toHaveBeenCalledWith('new-session-model');
    expect(session.setSubagentModelId).toHaveBeenCalledWith('new-session-subagent-model');
    expect(session.setMode).toHaveBeenCalledWith(planMode);
    expect(legacySwitchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    expect(legacySetState).toHaveBeenCalledWith({ projectPath: '/new-repo' });
    expect(harness.getState()).toMatchObject({
      projectPath: '/new-repo',
      currentModelId: 'new-session-model',
      modeId: 'plan',
      subagentModelId: 'new-session-subagent-model',
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
    expect(harness.getSubagentModelId()).toBe('session-subagent-model');

    await harness.setSubagentModelId({ modelId: 'default-subagent-model' });

    expect(session.setSubagentModelId).toHaveBeenCalledWith('default-subagent-model');
    expect(legacySetThreadSetting).toHaveBeenCalledWith({ key: 'subagentModelId', value: 'default-subagent-model' });
  });
});
