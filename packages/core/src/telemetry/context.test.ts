import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type GitCallback = (error: Error | null, stdout: string, stderr: string) => void;
const { execFile } = vi.hoisted(() => ({
  execFile: vi.fn<(file: string, args: string[], options: object, callback: GitCallback) => void>(),
}));

vi.mock('node:child_process', () => ({ execFile }));

import { getGitRepositoryIdentity, getServerTelemetryContext, resetProjectId2CacheForTests } from './context';
import { hashTelemetryValue } from './posthog';

const platformProjectId = '550e8400-e29b-41d4-a716-446655440000';
const gitProjectId = hashTelemetryValue('github.com/org/repo').slice(0, 16);

function mockRemote(remote: string) {
  execFile.mockImplementation((_file, _args, _options, callback) => callback(null, remote, ''));
}

describe('getServerTelemetryContext', () => {
  beforeEach(() => {
    vi.stubEnv('MASTRA_PROJECT_ID', undefined);
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', undefined);
    execFile.mockReset();
    execFile.mockImplementation((_file, _args, _options, callback) => callback(new Error('git unavailable'), '', ''));
    resetProjectId2CacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    resetProjectId2CacheForTests();
  });

  it('derives context from server telemetry environment variables', async () => {
    vi.stubEnv('MASTRA_PROJECT_ROOT', '/tmp/mastra-project');
    vi.stubEnv('MASTRA_CLI_DISTINCT_ID', 'cli-distinct-id');
    vi.stubEnv('MASTRA_TELEMETRY_COMMAND', 'dev');
    vi.stubEnv('NODE_ENV', 'test');

    expect(await getServerTelemetryContext()).toEqual({
      projectId: hashTelemetryValue('/tmp/mastra-project').slice(0, 16),
      projectId2: undefined,
      distinctId: 'cli-distinct-id',
      command: 'dev',
      nodeEnv: 'test',
    });
  });

  it('uses cwd and default runtime values when telemetry environment variables are unset', async () => {
    vi.stubEnv('MASTRA_PROJECT_ROOT', undefined);
    vi.stubEnv('MASTRA_CLI_DISTINCT_ID', undefined);
    vi.stubEnv('MASTRA_TELEMETRY_COMMAND', undefined);
    vi.stubEnv('NODE_ENV', undefined);

    expect(await getServerTelemetryContext()).toEqual({
      projectId: hashTelemetryValue(process.cwd()).slice(0, 16),
      projectId2: undefined,
      distinctId: undefined,
      command: 'server',
      nodeEnv: 'development',
    });
    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['remote', 'get-url', 'origin'],
      expect.objectContaining({ cwd: process.cwd() }),
      expect.any(Function),
    );
  });

  it('preserves the trimmed Platform UUID with an mp_ prefix without invoking Git', async () => {
    vi.stubEnv('MASTRA_PROJECT_ROOT', '/tmp/mastra-project');
    vi.stubEnv('MASTRA_PROJECT_ID', `  ${platformProjectId}  `);

    const context = await getServerTelemetryContext();

    expect(context.projectId2).toBe(`mp_${platformProjectId}`);
    expect(context.projectId).toBe(hashTelemetryValue('/tmp/mastra-project').slice(0, 16));
    expect(execFile).not.toHaveBeenCalled();
  });

  it.each(['', '   ', 'customer-project', 'project name', '550e8400-e29b-41d4-a716-not-a-uuid'])(
    'falls back to Git instead of emitting the non-UUID value %j',
    async value => {
      vi.stubEnv('MASTRA_PROJECT_ID', value);
      mockRemote('git@github.com:org/repo.git\n');

      expect((await getServerTelemetryContext()).projectId2).toBe(gitProjectId);
      expect(execFile).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    '  https://github.com/org/repo.git\n',
    'https://user:secret@GITHUB.COM:443/org/repo.git/',
    'https://github.com/org/repo/?token=secret#fragment',
    'http://github.com:8080/org/repo',
    'git@github.com:org/repo.git',
    'github.com:org/repo.git/',
    'ssh://git@GITHUB.COM:2222/org/repo.git',
    'git://github.com/org/repo.git/',
    'git+ssh://git@github.com/org/repo',
  ])('hashes the same repository identity for %s', async remote => {
    vi.stubEnv('MASTRA_PROJECT_ROOT', '/tmp/mastra-project');
    mockRemote(remote);

    expect((await getServerTelemetryContext()).projectId2).toBe(gitProjectId);
    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['remote', 'get-url', 'origin'],
      expect.objectContaining({ cwd: '/tmp/mastra-project', timeout: 2000, maxBuffer: 4096 }),
      expect.any(Function),
    );
  });

  it.each(['https://github.com/org/other', 'https://gitlab.com/org/repo', 'https://github.com/Org/Repo'])(
    'preserves distinct hosts and repository paths for %s',
    async remote => {
      mockRemote(remote);
      expect((await getServerTelemetryContext()).projectId2).not.toBe(gitProjectId);
    },
  );

  it.each([
    '   \n',
    'invalid remote',
    '/local/repo.git',
    '../repo.git',
    'C:\\repo.git',
    'file:///repo.git',
    'https://github.com/',
  ])('omits the secondary ID for a missing or unsupported remote %j', async remote => {
    mockRemote(remote);
    expect((await getServerTelemetryContext()).projectId2).toBeUndefined();
  });

  it('omits invalid Platform values when Git is unavailable', async () => {
    vi.stubEnv('MASTRA_PROJECT_ID', 'private-customer-project');
    expect((await getServerTelemetryContext()).projectId2).toBeUndefined();
  });

  it.each(['git unavailable', 'not a git repository', 'missing origin', 'timed out', 'maxBuffer exceeded'])(
    'caches unavailable Git identity after %s',
    async message => {
      execFile.mockImplementation((_file, _args, _options, callback) => callback(new Error(message), '', ''));

      const [first, second] = await Promise.all([getServerTelemetryContext(), getServerTelemetryContext()]);
      expect(first.projectId2).toBeUndefined();
      expect(second.projectId2).toBeUndefined();
      expect((await getServerTelemetryContext()).projectId2).toBeUndefined();
      expect(execFile).toHaveBeenCalledTimes(1);
    },
  );

  it('swallows synchronous process creation errors', async () => {
    execFile.mockImplementation(() => {
      throw new Error('spawn failed');
    });
    expect((await getServerTelemetryContext()).projectId2).toBeUndefined();
  });

  it('shares in-flight Git discovery without blocking other work', async () => {
    vi.useFakeTimers();
    execFile.mockImplementation((_file, _args, _options, callback) => {
      setTimeout(() => callback(null, 'https://github.com/org/repo.git', ''), 100);
    });
    const tick = vi.fn();
    const resolved = vi.fn();
    setTimeout(tick, 0);

    const first = getServerTelemetryContext().then(context => {
      resolved();
      return context;
    });
    const second = getServerTelemetryContext();
    await vi.advanceTimersByTimeAsync(0);

    expect(tick).toHaveBeenCalledOnce();
    expect(resolved).not.toHaveBeenCalled();
    expect(execFile).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(100);
    expect((await first).projectId2).toBe(gitProjectId);
    expect((await second).projectId2).toBe(gitProjectId);
    expect((await getServerTelemetryContext()).projectId2).toBe(gitProjectId);
    expect(execFile).toHaveBeenCalledOnce();
  });

  it('prefers a Platform UUID even after caching a Git identity', async () => {
    mockRemote('https://github.com/org/repo.git');
    expect((await getServerTelemetryContext()).projectId2).toBe(gitProjectId);

    vi.stubEnv('MASTRA_PROJECT_ID', platformProjectId);
    expect((await getServerTelemetryContext()).projectId2).toBe(`mp_${platformProjectId}`);
    expect(execFile).toHaveBeenCalledOnce();
  });
});

describe('getGitRepositoryIdentity', () => {
  beforeEach(() => {
    execFile.mockReset();
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not run Git when telemetry is disabled', async () => {
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', '1');
    mockRemote('git@github.com:org/repo.git');
    await expect(getGitRepositoryIdentity('/tmp/build-root')).resolves.toBeUndefined();
    expect(execFile).not.toHaveBeenCalled();
  });

  it('returns the normalized origin of the given directory, uncached', async () => {
    mockRemote('git@GitHub.com:org/repo.git\n');
    await expect(getGitRepositoryIdentity('/tmp/build-root')).resolves.toBe('github.com/org/repo');
    mockRemote('https://token@github.com/org/other');
    await expect(getGitRepositoryIdentity('/tmp/build-root')).resolves.toBe('github.com/org/other');

    expect(execFile).toHaveBeenCalledTimes(2);
    expect(execFile.mock.calls[0]![2]).toEqual(expect.objectContaining({ cwd: '/tmp/build-root' }));
  });

  it('resolves to undefined for local remotes and unavailable Git', async () => {
    mockRemote('/srv/git/repo.git');
    await expect(getGitRepositoryIdentity('/tmp/build-root')).resolves.toBeUndefined();
    execFile.mockImplementation((_file, _args, _options, callback) => callback(new Error('no origin'), '', ''));
    await expect(getGitRepositoryIdentity('/tmp/build-root')).resolves.toBeUndefined();
  });
});
