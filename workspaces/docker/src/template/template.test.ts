/**
 * DockerTemplate unit tests.
 *
 * Covers immutable builder chaining, content-addressed reuse, build success and
 * failure surfacing, sandbox creation from the built image, and disposal —
 * all against a mocked `dockerode`, so no Docker daemon is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerTemplate } from './template';

const { mockImage, mockDocker, mockOpenBuildSession, mockSession, resetMockDefaults } = vi.hoisted(() => {
  const mockImage = {
    inspect: vi.fn(),
    remove: vi.fn(),
  };
  const mockSession = { id: 'session-1', close: vi.fn() };
  const mockOpenBuildSession = vi.fn(async () => mockSession);
  const mockDial = vi.fn((_opts: unknown, cb: (err: Error | null, data?: unknown) => void) => {
    // Minimal readable stream for the build output.
    cb(null, { once: vi.fn(), on: vi.fn(), removeListener: vi.fn() });
  });

  const mockFollowProgress = vi.fn(
    (_stream: unknown, onFinish: (err: Error | null, output: Array<Record<string, unknown>>) => void) => {
      onFinish(null, []);
    },
  );

  const mockDocker = {
    getImage: vi.fn().mockReturnValue(mockImage),
    buildImage: vi.fn().mockResolvedValue({}),
    modem: { followProgress: mockFollowProgress, dial: mockDial },
  };

  const resetMockDefaults = () => {
    mockImage.inspect.mockReset().mockResolvedValue({ Id: 'sha256:existing' });
    mockImage.remove.mockReset().mockResolvedValue(undefined);
    mockDocker.getImage.mockReset().mockReturnValue(mockImage);
    mockDocker.buildImage.mockReset().mockResolvedValue({});
    mockFollowProgress.mockReset().mockImplementation((_stream, onFinish) => onFinish(null, []));
    mockDial.mockClear();
    mockOpenBuildSession.mockClear();
    mockSession.close.mockClear();
  };

  return { mockImage, mockDocker, mockOpenBuildSession, mockSession, resetMockDefaults };
});

vi.mock('./build-session', () => ({ openBuildSession: mockOpenBuildSession }));

vi.mock('dockerode', () => {
  function MockDocker() {
    return mockDocker;
  }
  return { default: MockDocker };
});

beforeEach(() => {
  resetMockDefaults();
});

describe('DockerTemplate builder', () => {
  it('is immutable — operations return new instances', () => {
    const base = new DockerTemplate({ baseImage: 'node:22-slim' });
    const next = base.runCmd('echo hi');
    expect(next).not.toBe(base);
    expect(base.dockerfile).toBe('FROM node:22-slim AS mastra-main-0\n');
    expect(next.dockerfile).toContain('RUN echo hi');
  });

  it('defaults the base image to node:22-slim', () => {
    expect(new DockerTemplate().dockerfile).toBe('FROM node:22-slim AS mastra-main-0\n');
  });

  it('exposes pipInstall with the same shape as the E2B/platform builders', () => {
    const template = new DockerTemplate().pipInstall(['numpy'], { g: false });
    expect(template.definition.operations).toEqual([{ method: 'pipInstall', args: [['numpy'], { g: false }] }]);
    expect(template.dockerfile).toContain('RUN pip install --user numpy');
    expect(() => new DockerTemplate().pipInstall('')).toThrow();
  });

  it('supports .from() to override the base image', () => {
    expect(new DockerTemplate().from('ubuntu:24.04').dockerfile).toBe('FROM ubuntu:24.04 AS mastra-main-0\n');
  });

  it('runs secret steps in a throwaway stage and keeps values out of the Dockerfile', () => {
    const template = new DockerTemplate().runWithSecrets('git clone x /workspace/app', {
      secrets: ['GIT_TOKEN'],
      output: '/workspace/app',
    });
    expect(template.dockerfile).toBe(
      [
        'FROM node:22-slim AS mastra-main-0',
        'FROM mastra-main-0 AS mastra-secret-0',
        'RUN --mount=type=secret,id=GIT_TOKEN,mode=0444 export GIT_TOKEN="$(cat /run/secrets/GIT_TOKEN)" && git clone x /workspace/app',
        'FROM mastra-main-0 AS mastra-main-1',
        'COPY --from=mastra-secret-0 /workspace/app /workspace/app',
        '',
      ].join('\n'),
    );
    // Only names participate in identity, so different credentials reuse the image.
    expect(template.templateId).not.toBe(new DockerTemplate().templateId);
  });

  it('gives the same identity regardless of env insertion order', () => {
    const a = new DockerTemplate().setEnvs({ A: '1', B: '2' });
    const b = new DockerTemplate().setEnvs({ B: '2', A: '1' });
    expect(a.templateId).toBe(b.templateId);
  });

  it('bakes non-ephemeral envs into ENV and identity', () => {
    const withEnv = new DockerTemplate().setEnvs({ NODE_ENV: 'production' });
    expect(withEnv.dockerfile).toContain('ENV NODE_ENV="production"');
    expect(withEnv.templateId).not.toBe(new DockerTemplate().templateId);
  });

  it('validates inputs', () => {
    expect(() => new DockerTemplate().runCmd('')).toThrow(TypeError);
    expect(() => new DockerTemplate().setWorkdir(123 as never)).toThrow(TypeError);
    expect(() => new DockerTemplate().setEnvs(['x'] as never)).toThrow(TypeError);
    expect(() => new DockerTemplate().runWithSecrets('x', { secrets: ['bad name'], output: '/o' })).toThrow(TypeError);
    expect(() => new DockerTemplate().runWithSecrets('x', { secrets: [], output: 'relative' })).toThrow(TypeError);
  });
});

describe('DockerTemplate.build', () => {
  it('reuses an existing image without rebuilding', async () => {
    const template = new DockerTemplate().runCmd('echo hi');
    const result = await template.build();
    expect(result.status).toBe('ready');
    expect(result.templateId).toBe(template.templateId);
    expect(mockDocker.buildImage).not.toHaveBeenCalled();
  });

  it('builds when the image is missing', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    const template = new DockerTemplate().runCmd('echo hi');
    const result = await template.build();
    expect(result.status).toBe('ready');
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
    const [, opts] = mockDocker.buildImage.mock.calls[0];
    expect(opts.t).toBe(template.templateId);
  });

  it('shares one in-flight build across concurrent callers', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    const template = new DockerTemplate().runCmd('echo hi');
    const results = await Promise.all([template.build(), template.build(), template.build()]);
    expect(results.every(r => r.status === 'ready')).toBe(true);
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
  });

  it('cancels one shared waiter without interrupting the other caller', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    let release!: () => void;
    mockDocker.modem.followProgress.mockImplementationOnce((_stream, onFinish) => {
      release = () => onFinish(null, []);
    });
    const controller = new AbortController();
    const template = new DockerTemplate().runCmd('echo hi');
    const cancelled = template.build({ abortSignal: controller.signal });
    const remaining = template.build();
    await new Promise(r => setImmediate(r));

    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ code: 'ABORTED' });
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
    release();
    await expect(remaining).resolves.toMatchObject({ status: 'ready' });
  });

  it('cancels the underlying stream when the last shared waiter aborts and remains retryable', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    const stream = { destroy: vi.fn() };
    mockDocker.buildImage.mockResolvedValueOnce(stream);
    mockDocker.modem.followProgress.mockImplementationOnce(() => undefined);
    const controller = new AbortController();
    const template = new DockerTemplate().runCmd('echo hi');
    const build = template.build({ abortSignal: controller.signal });
    await new Promise(r => setImmediate(r));

    controller.abort();
    await expect(build).rejects.toMatchObject({ code: 'ABORTED' });
    expect(stream.destroy).toHaveBeenCalledTimes(1);
    await expect(template.build()).resolves.toMatchObject({ status: 'ready' });
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(2);
  });

  it('rejects pre-aborted builds without inspecting or building', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(new DockerTemplate().build({ abortSignal: controller.signal })).rejects.toMatchObject({
      code: 'ABORTED',
    });
    expect(mockDocker.getImage).not.toHaveBeenCalled();
    expect(mockDocker.buildImage).not.toHaveBeenCalled();
  });

  it('queues a build with different options behind the in-flight one instead of sharing it', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    let release!: () => void;
    mockDocker.modem.followProgress.mockImplementationOnce((_stream, onFinish) => {
      release = () => onFinish(null, []);
    });
    const template = new DockerTemplate().runCmd('echo hi');
    const plain = template.build();
    const forced = template.build({ force: true });
    await new Promise(r => setImmediate(r));
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
    release();
    await expect(plain).resolves.toMatchObject({ status: 'ready' });
    await expect(forced).resolves.toMatchObject({ status: 'ready' });
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(2);
    expect((mockDocker.buildImage.mock.calls[0]![1] as { nocache: boolean }).nocache).toBe(false);
    expect((mockDocker.buildImage.mock.calls[1]![1] as { nocache: boolean }).nocache).toBe(true);
    // The queue drained: a later plain build is not stuck behind a stale promise.
    mockImage.inspect.mockResolvedValueOnce({});
    await expect(template.build()).resolves.toMatchObject({ status: 'ready' });
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(2);
  });

  it('lets plain callers join the active plain build while an option-specific build is queued', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    const releases: Array<() => void> = [];
    mockDocker.modem.followProgress.mockImplementation((_stream, onFinish) => {
      releases.push(() => onFinish(null, []));
    });
    const template = new DockerTemplate().runCmd('echo hi');

    const firstPlain = template.build();
    const forced = template.build({ force: true });
    const secondPlain = template.build();
    await new Promise(r => setImmediate(r));

    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
    releases[0]!();
    await expect(Promise.all([firstPlain, secondPlain])).resolves.toEqual([
      { status: 'ready', templateId: template.templateId },
      { status: 'ready', templateId: template.templateId },
    ]);

    await new Promise(r => setImmediate(r));
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(2);
    releases[1]!();
    await expect(forced).resolves.toMatchObject({ status: 'ready' });
  });

  it('builds on the docker client passed in options', async () => {
    const other = {
      getImage: vi.fn(() => ({ inspect: vi.fn().mockRejectedValue(new Error('no such image')) })),
      buildImage: vi.fn(async () => ({})),
      modem: { followProgress: mockDocker.modem.followProgress },
    };
    await new DockerTemplate().runCmd('echo hi').build({ docker: other as never });
    expect(other.buildImage).toHaveBeenCalledTimes(1);
    expect(mockDocker.buildImage).not.toHaveBeenCalled();
  });

  it('rebuilds without the layer cache when force is set', async () => {
    const template = new DockerTemplate().runCmd('echo hi');
    await template.build({ force: true });
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
    expect(mockDocker.buildImage.mock.calls[0]![1]).toEqual({ t: template.templateId, nocache: true });
  });

  const sessionSecrets = (call = 0) => mockOpenBuildSession.mock.calls[call]![1];

  it('resolves secrets from process.env at build time and serves them over a BuildKit session', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    vi.stubEnv('GIT_TOKEN', 'resolved-secret');
    const template = new DockerTemplate().runWithSecrets('echo hi', { secrets: ['GIT_TOKEN'], output: '/out' });
    await template.build();
    // Never the legacy builder with build args.
    expect(mockDocker.buildImage).not.toHaveBeenCalled();
    expect(sessionSecrets()).toEqual({ GIT_TOKEN: 'resolved-secret' });
    const [dialOpts] = mockDocker.modem.dial.mock.calls[0]!;
    expect(dialOpts.options).toEqual({ t: template.templateId, version: '2', session: mockSession.id, nocache: false });
    expect(JSON.stringify(dialOpts.options)).not.toContain('resolved-secret');
    vi.unstubAllEnvs();
  });

  it('closes the session however the build stream settles, including a bare close', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    const template = new DockerTemplate({ secrets: { T: 'v' } }).runWithSecrets('x', { secrets: ['T'], output: '/o' });
    // Neither end nor error: followProgress reports completion on 'close'.
    mockDocker.modem.followProgress.mockImplementationOnce((_stream, onFinish) => onFinish(null, []));
    await template.build();
    expect(mockSession.close).toHaveBeenCalledTimes(1);
    mockDocker.modem.followProgress.mockImplementationOnce((_stream, onFinish) => onFinish(new Error('boom'), []));
    await expect(template.build({ force: true })).resolves.toMatchObject({ status: 'failed' });
    expect(mockSession.close).toHaveBeenCalledTimes(2);
  });

  it('builds without a session when the template uses no secrets', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    await new DockerTemplate().runCmd('echo hi').build();
    expect(mockOpenBuildSession).not.toHaveBeenCalled();
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
  });

  it('takes secret values from build({ secrets }) without touching process.env', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    delete process.env.GIT_TOKEN;
    const template = new DockerTemplate().runWithSecrets('echo hi', { secrets: ['GIT_TOKEN'], output: '/out' });
    await template.build({ secrets: { GIT_TOKEN: 'by-value' } });
    expect(sessionSecrets()).toEqual({ GIT_TOKEN: 'by-value' });
    expect(process.env.GIT_TOKEN).toBeUndefined();
  });

  it('resolves secrets from the template-level source on lazy builds, preferring build-time overrides', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    delete process.env.GIT_TOKEN;
    const source = vi.fn(async () => ({ GIT_TOKEN: 'from-template' }));
    const template = new DockerTemplate({ secrets: source }).runWithSecrets('echo hi', {
      secrets: ['GIT_TOKEN'],
      output: '/out',
    });
    await template.createSandbox();
    expect(source).toHaveBeenCalledTimes(1);
    expect(sessionSecrets(0)).toEqual({ GIT_TOKEN: 'from-template' });

    await template.build({ force: true, secrets: { GIT_TOKEN: 'override' } });
    expect(sessionSecrets(1)).toEqual({ GIT_TOKEN: 'override' });
  });

  it('throws before building when a secret is missing from the environment', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    vi.stubEnv('GIT_TOKEN', undefined as never);
    delete process.env.GIT_TOKEN;
    const template = new DockerTemplate().runWithSecrets('echo hi', { secrets: ['GIT_TOKEN'], output: '/out' });
    await expect(template.build()).rejects.toThrow(/GIT_TOKEN/);
    expect(mockOpenBuildSession).not.toHaveBeenCalled();
    expect(mockDocker.modem.dial).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('reuses a cached image without requiring the secrets to still be set', async () => {
    vi.stubEnv('GIT_TOKEN', undefined as never);
    delete process.env.GIT_TOKEN;
    const template = new DockerTemplate().runWithSecrets('echo hi', { secrets: ['GIT_TOKEN'], output: '/out' });
    await expect(template.build()).resolves.toEqual({ status: 'ready', templateId: template.templateId });
    expect(mockDocker.buildImage).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('does not report built after a failed build', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    mockDocker.modem.followProgress.mockImplementationOnce((_stream, onFinish) =>
      onFinish(null, [{ errorDetail: { message: 'command failed' }, error: 'command failed' }]),
    );
    const template = new DockerTemplate().runCmd('false');
    expect((await template.build()).status).toBe('failed');
    // A later createSandbox must build again rather than trust the failed attempt.
    await template.createSandbox();
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(2);
  });

  it('surfaces build-step failures from the progress stream', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    mockDocker.modem.followProgress.mockImplementationOnce((_stream, onFinish) =>
      onFinish(null, [{ errorDetail: { message: 'command failed' }, error: 'command failed' }]),
    );
    const template = new DockerTemplate().runCmd('false');
    const result = await template.build();
    expect(result.status).toBe('failed');
    expect(result.error).toContain('command failed');
  });

  it('propagates non-404 inspect errors', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('daemon unreachable'));
    const template = new DockerTemplate().runCmd('echo hi');
    await expect(template.build()).rejects.toThrow('daemon unreachable');
  });

  it('cancels a pending buildImage acquisition and remains retryable', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    let resolveBuild!: (stream: { destroy: ReturnType<typeof vi.fn> }) => void;
    const lateStream = { destroy: vi.fn() };
    mockDocker.buildImage.mockImplementationOnce(
      () => new Promise(resolve => (resolveBuild = resolve)) as ReturnType<typeof mockDocker.buildImage>,
    );
    const controller = new AbortController();
    const template = new DockerTemplate().runCmd('echo hi');
    const build = template.build({ abortSignal: controller.signal });
    await vi.waitFor(() => expect(mockDocker.buildImage).toHaveBeenCalledTimes(1));

    controller.abort(new Error('cancel acquisition'));
    await expect(build).rejects.toMatchObject({ code: 'ABORTED', cause: controller.signal.reason });
    resolveBuild(lateStream);
    await vi.waitFor(() => expect(lateStream.destroy).toHaveBeenCalledTimes(1));

    await expect(template.build()).resolves.toMatchObject({ status: 'ready' });
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending secret build acquisition and closes late resources', async () => {
    mockImage.inspect.mockRejectedValue(new Error('no such image'));
    let dialCallback!: (error: Error | null, stream?: unknown) => void;
    const request = { destroy: vi.fn() };
    const lateStream = { destroy: vi.fn() };
    mockDocker.modem.dial.mockImplementationOnce((_options, callback) => {
      dialCallback = callback;
      return request;
    });
    const controller = new AbortController();
    const template = new DockerTemplate({ secrets: { TOKEN: 'value' } }).runWithSecrets('echo hi', {
      secrets: ['TOKEN'],
      output: '/out',
    });
    const build = template.build({ abortSignal: controller.signal });
    await vi.waitFor(() => expect(mockDocker.modem.dial).toHaveBeenCalledTimes(1));

    controller.abort(new Error('cancel secret acquisition'));
    await expect(build).rejects.toMatchObject({ code: 'ABORTED', cause: controller.signal.reason });
    expect(request.destroy).toHaveBeenCalledTimes(1);
    expect(mockSession.close).toHaveBeenCalled();
    dialCallback(null, lateStream);
    expect(lateStream.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('DockerTemplate.createSandbox', () => {
  it('creates a sandbox bound to the built image', async () => {
    const template = new DockerTemplate().runCmd('echo hi');
    const sandbox = await template.createSandbox();
    expect(sandbox.constructor.name).toBe('DockerSandbox');
  });

  it("derives the sandbox working directory from the template's last setWorkdir", async () => {
    const template = new DockerTemplate().setWorkdir('/workspace').setWorkdir('app').setWorkdir('/srv/final');
    expect(template.workdir).toBe('/srv/final');
    const sandbox = await template.createSandbox();
    expect(sandbox.workingDirectory).toBe('/srv/final');
  });

  it('resolves relative setWorkdir against the previous one', () => {
    expect(new DockerTemplate().setWorkdir('/workspace').setWorkdir('app').workdir).toBe('/workspace/app');
    expect(new DockerTemplate().workdir).toBeUndefined();
  });

  it('lets an explicit workingDirectory override the template workdir', async () => {
    const template = new DockerTemplate().setWorkdir('/srv/app');
    const sandbox = await template.createSandbox({ workingDirectory: '/elsewhere' });
    expect(sandbox.workingDirectory).toBe('/elsewhere');
  });

  it('lazily builds before creating a sandbox', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    const template = new DockerTemplate().runCmd('echo hi');
    await template.createSandbox();
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
  });

  it('throws when the lazy build fails', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    mockDocker.modem.followProgress.mockImplementationOnce((_stream, onFinish) => onFinish(null, [{ error: 'boom' }]));
    const template = new DockerTemplate().runCmd('false');
    await expect(template.createSandbox()).rejects.toThrow('boom');
  });
});

describe('DockerTemplate.dispose', () => {
  it('removes the built image', async () => {
    const template = new DockerTemplate().runCmd('echo hi');
    await template.dispose();
    expect(mockImage.remove).toHaveBeenCalledTimes(1);
  });

  it('tolerates an already-removed image', async () => {
    mockImage.remove.mockRejectedValueOnce(new Error('no such image'));
    const template = new DockerTemplate().runCmd('echo hi');
    await expect(template.dispose()).resolves.toBeUndefined();
  });

  it('propagates non-404 remove errors', async () => {
    mockImage.remove.mockRejectedValueOnce(new Error('daemon unreachable'));
    const template = new DockerTemplate().runCmd('echo hi');
    await expect(template.dispose()).rejects.toThrow('daemon unreachable');
  });
});
