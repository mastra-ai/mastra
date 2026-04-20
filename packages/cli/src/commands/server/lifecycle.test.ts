import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockResolveAuth = vi.fn();
const mockResolveProjectId = vi.fn();
const mockPauseServerProject = vi.fn();
const mockRestartServerProject = vi.fn();
const mockPollServerDeploy = vi.fn();

vi.mock('./env.js', () => ({
  resolveAuth: (...args: unknown[]) => mockResolveAuth(...args),
  resolveProjectId: (...args: unknown[]) => mockResolveProjectId(...args),
}));

vi.mock('./platform-api.js', () => ({
  pauseServerProject: (...args: unknown[]) => mockPauseServerProject(...args),
  restartServerProject: (...args: unknown[]) => mockRestartServerProject(...args),
  pollServerDeploy: (...args: unknown[]) => mockPollServerDeploy(...args),
}));

const mockIntro = vi.fn();
const mockOutro = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();
const mockLogStep = vi.fn();
const mockLogError = vi.fn();
const mockLogWarning = vi.fn();

vi.mock('@clack/prompts', () => ({
  intro: (...args: unknown[]) => mockIntro(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
  spinner: vi.fn(() => ({
    start: (...a: unknown[]) => mockSpinnerStart(...a),
    stop: (...a: unknown[]) => mockSpinnerStop(...a),
  })),
  log: {
    step: (...a: unknown[]) => mockLogStep(...a),
    error: (...a: unknown[]) => mockLogError(...a),
    warning: (...a: unknown[]) => mockLogWarning(...a),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockResolveAuth.mockResolvedValue({ token: 't', orgId: 'o' });
  mockResolveProjectId.mockResolvedValue('proj-1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('serverPauseAction', () => {
  it('calls pause and shows success outro', async () => {
    mockPauseServerProject.mockResolvedValue(undefined);
    const { serverPauseAction } = await import('./lifecycle.js');
    await serverPauseAction({});

    expect(mockPauseServerProject).toHaveBeenCalledWith('t', 'o', 'proj-1');
    expect(mockOutro).toHaveBeenCalledWith('Server paused.');
  });

  it('passes org flag into resolveAuth', async () => {
    mockPauseServerProject.mockResolvedValue(undefined);
    const { serverPauseAction } = await import('./lifecycle.js');
    await serverPauseAction({ org: 'flag-org' });
    expect(mockResolveAuth).toHaveBeenCalledWith('flag-org');
  });

  it('logs error and exits on failure', async () => {
    mockPauseServerProject.mockRejectedValue(new Error('pause failed'));
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });

    const { serverPauseAction } = await import('./lifecycle.js');
    await expect(serverPauseAction({})).rejects.toThrow('exit:1');
    expect(mockLogError).toHaveBeenCalledWith('pause failed');

    mockExit.mockRestore();
  });
});

describe('serverRestartAction', () => {
  it('polls deploy and shows outro when running', async () => {
    mockRestartServerProject.mockResolvedValue('dep-1');
    mockPollServerDeploy.mockResolvedValue({
      status: 'running',
      instanceUrl: 'https://app.example',
      error: null,
    });

    const { serverRestartAction } = await import('./lifecycle.js');
    await serverRestartAction({});

    expect(mockRestartServerProject).toHaveBeenCalledWith('t', 'o', 'proj-1');
    expect(mockPollServerDeploy).toHaveBeenCalledWith('dep-1', 't', 'o');
    expect(mockOutro).toHaveBeenCalledWith('Restart complete! https://app.example');
  });

  it('exits 1 when deploy failed', async () => {
    mockRestartServerProject.mockResolvedValue('dep-1');
    mockPollServerDeploy.mockResolvedValue({
      status: 'failed',
      instanceUrl: null,
      error: 'build broke',
    });
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });

    const { serverRestartAction } = await import('./lifecycle.js');
    await expect(serverRestartAction({})).rejects.toThrow('exit:1');
    expect(mockLogError).toHaveBeenCalledWith('Restart failed: build broke');

    mockExit.mockRestore();
  });

  it('exits 1 on non-running terminal status', async () => {
    mockRestartServerProject.mockResolvedValue('dep-1');
    mockPollServerDeploy.mockResolvedValue({
      status: 'cancelled',
      instanceUrl: null,
      error: null,
    });
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });

    const { serverRestartAction } = await import('./lifecycle.js');
    await expect(serverRestartAction({})).rejects.toThrow('exit:1');
    expect(mockLogWarning).toHaveBeenCalledWith('Restart ended with status: cancelled');

    mockExit.mockRestore();
  });

  it('exits 1 when restart throws', async () => {
    mockRestartServerProject.mockRejectedValue(new Error('409 conflict'));
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`exit:${code}`);
    });

    const { serverRestartAction } = await import('./lifecycle.js');
    await expect(serverRestartAction({})).rejects.toThrow('exit:1');
    expect(mockLogError).toHaveBeenCalledWith('409 conflict');

    mockExit.mockRestore();
  });
});
