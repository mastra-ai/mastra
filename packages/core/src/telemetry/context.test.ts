import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }));

vi.mock('node:child_process', () => ({ execFileSync }));

import { getServerTelemetryContext, resetProjectId2CacheForTests } from './context';
import { hashTelemetryValue } from './posthog';

describe('getServerTelemetryContext', () => {
  let originalProjectRoot: string | undefined;
  let originalProjectId: string | undefined;
  let originalDistinctId: string | undefined;
  let originalCommand: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalProjectRoot = process.env.MASTRA_PROJECT_ROOT;
    originalProjectId = process.env.MASTRA_PROJECT_ID;
    originalDistinctId = process.env.MASTRA_CLI_DISTINCT_ID;
    originalCommand = process.env.MASTRA_TELEMETRY_COMMAND;
    originalNodeEnv = process.env.NODE_ENV;

    delete process.env.MASTRA_PROJECT_ID;
    execFileSync.mockReset();
    execFileSync.mockImplementation(() => {
      throw new Error('git unavailable');
    });
    resetProjectId2CacheForTests();
  });

  afterEach(() => {
    if (originalProjectRoot !== undefined) process.env.MASTRA_PROJECT_ROOT = originalProjectRoot;
    else delete process.env.MASTRA_PROJECT_ROOT;
    if (originalProjectId !== undefined) process.env.MASTRA_PROJECT_ID = originalProjectId;
    else delete process.env.MASTRA_PROJECT_ID;
    if (originalDistinctId !== undefined) process.env.MASTRA_CLI_DISTINCT_ID = originalDistinctId;
    else delete process.env.MASTRA_CLI_DISTINCT_ID;
    if (originalCommand !== undefined) process.env.MASTRA_TELEMETRY_COMMAND = originalCommand;
    else delete process.env.MASTRA_TELEMETRY_COMMAND;
    if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
    else delete process.env.NODE_ENV;
    resetProjectId2CacheForTests();
  });

  it('derives context from server telemetry environment variables', () => {
    process.env.MASTRA_PROJECT_ROOT = '/tmp/mastra-project';
    process.env.MASTRA_CLI_DISTINCT_ID = 'cli-distinct-id';
    process.env.MASTRA_TELEMETRY_COMMAND = 'dev';
    process.env.NODE_ENV = 'test';

    expect(getServerTelemetryContext()).toEqual({
      projectId: hashTelemetryValue('/tmp/mastra-project').slice(0, 16),
      projectId2: undefined,
      distinctId: 'cli-distinct-id',
      command: 'dev',
      nodeEnv: 'test',
    });
  });

  it('uses cwd and default runtime values when telemetry environment variables are unset', () => {
    delete process.env.MASTRA_PROJECT_ROOT;
    delete process.env.MASTRA_CLI_DISTINCT_ID;
    delete process.env.MASTRA_TELEMETRY_COMMAND;
    delete process.env.NODE_ENV;

    expect(getServerTelemetryContext()).toEqual({
      projectId: hashTelemetryValue(process.cwd()).slice(0, 16),
      projectId2: undefined,
      distinctId: undefined,
      command: 'server',
      nodeEnv: 'development',
    });
  });

  describe('projectId2', () => {
    it('uses the trimmed platform project id with an mp_ prefix and never invokes git', () => {
      process.env.MASTRA_PROJECT_ROOT = '/tmp/mastra-project';
      process.env.MASTRA_PROJECT_ID = '  platform-project-id  ';

      const context = getServerTelemetryContext();

      expect(context.projectId2).toBe('mp_platform-project-id');
      expect(context.projectId).toBe(hashTelemetryValue('/tmp/mastra-project').slice(0, 16));
      expect(execFileSync).not.toHaveBeenCalled();
    });

    it('falls back to a hash of the trimmed git origin remote when the platform id is absent', () => {
      process.env.MASTRA_PROJECT_ROOT = '/tmp/mastra-project';
      execFileSync.mockReturnValue('  https://github.com/org/repo.git\n');

      const context = getServerTelemetryContext();

      expect(context.projectId2).toBe(hashTelemetryValue('https://github.com/org/repo.git').slice(0, 16));
      expect(context.projectId).toBe(hashTelemetryValue('/tmp/mastra-project').slice(0, 16));
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['remote', 'get-url', 'origin'],
        expect.objectContaining({ cwd: '/tmp/mastra-project' }),
      );
    });

    it('falls back to git when the platform id is blank', () => {
      process.env.MASTRA_PROJECT_ID = '   ';
      execFileSync.mockReturnValue('git@github.com:org/repo.git\n');

      expect(getServerTelemetryContext().projectId2).toBe(
        hashTelemetryValue('git@github.com:org/repo.git').slice(0, 16),
      );
    });

    it('is undefined when git fails', () => {
      process.env.MASTRA_PROJECT_ROOT = '/tmp/mastra-project';
      execFileSync.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const context = getServerTelemetryContext();

      expect(context.projectId2).toBeUndefined();
      expect(context.projectId).toBe(hashTelemetryValue('/tmp/mastra-project').slice(0, 16));
    });

    it('is undefined when git returns blank output', () => {
      execFileSync.mockReturnValue('   \n');

      expect(getServerTelemetryContext().projectId2).toBeUndefined();
    });

    it('caches the git resolution across calls', () => {
      execFileSync.mockReturnValue('https://github.com/org/repo.git\n');

      const first = getServerTelemetryContext();
      const second = getServerTelemetryContext();

      expect(first.projectId2).toBe(second.projectId2);
      expect(execFileSync).toHaveBeenCalledTimes(1);
    });
  });
});
