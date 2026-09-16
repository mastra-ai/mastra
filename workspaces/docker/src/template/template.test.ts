/**
 * DockerTemplate unit tests.
 *
 * Covers immutable builder chaining, content-addressed reuse, build success and
 * failure surfacing, sandbox creation from the built image, and disposal —
 * all against a mocked `dockerode`, so no Docker daemon is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerTemplate } from './template';

const { mockImage, mockDocker, resetMockDefaults } = vi.hoisted(() => {
  const mockImage = {
    inspect: vi.fn(),
    remove: vi.fn(),
  };

  const mockFollowProgress = vi.fn(
    (_stream: unknown, onFinish: (err: Error | null, output: Array<Record<string, unknown>>) => void) => {
      onFinish(null, []);
    },
  );

  const mockDocker = {
    getImage: vi.fn().mockReturnValue(mockImage),
    buildImage: vi.fn().mockResolvedValue({}),
    modem: { followProgress: mockFollowProgress },
  };

  const resetMockDefaults = () => {
    mockImage.inspect.mockReset().mockResolvedValue({ Id: 'sha256:existing' });
    mockImage.remove.mockReset().mockResolvedValue(undefined);
    mockDocker.getImage.mockReset().mockReturnValue(mockImage);
    mockDocker.buildImage.mockReset().mockResolvedValue({});
    mockFollowProgress.mockReset().mockImplementation((_stream, onFinish) => onFinish(null, []));
  };

  return { mockImage, mockDocker, resetMockDefaults };
});

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
    expect(base.dockerfile).toBe('FROM node:22-slim\n');
    expect(next.dockerfile).toContain('RUN echo hi');
  });

  it('defaults the base image to node:22-slim', () => {
    expect(new DockerTemplate().dockerfile).toBe('FROM node:22-slim\n');
  });

  it('supports .from() to override the base image', () => {
    expect(new DockerTemplate().from('ubuntu:24.04').dockerfile).toBe('FROM ubuntu:24.04\n');
  });

  it('keeps ephemeral envs out of the Dockerfile and identity', () => {
    const withSecret = new DockerTemplate().setEnvs({ GIT_TOKEN: 'secret' }, { ephemeral: true });
    const plain = new DockerTemplate();
    expect(withSecret.dockerfile).not.toContain('secret');
    expect(withSecret.dockerfile).toContain('ARG GIT_TOKEN');
    // Identity ignores ephemeral secrets.
    expect(withSecret.templateId).toBe(plain.templateId);
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

  it('rebuilds when force is set', async () => {
    const template = new DockerTemplate().runCmd('echo hi');
    await template.build({ force: true });
    expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
  });

  it('passes ephemeral envs as build args', async () => {
    mockImage.inspect.mockRejectedValueOnce(new Error('no such image'));
    const template = new DockerTemplate().setEnvs({ GIT_TOKEN: 'secret' }, { ephemeral: true }).runCmd('echo hi');
    await template.build();
    const [, opts] = mockDocker.buildImage.mock.calls[0];
    expect(opts.buildargs).toEqual({ GIT_TOKEN: 'secret' });
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
});

describe('DockerTemplate.createSandbox', () => {
  it('creates a sandbox bound to the built image', async () => {
    const template = new DockerTemplate().runCmd('echo hi');
    const sandbox = await template.createSandbox();
    expect(sandbox.constructor.name).toBe('DockerSandbox');
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
