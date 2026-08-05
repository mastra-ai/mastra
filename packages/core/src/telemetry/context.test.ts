import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getServerTelemetryContext } from './context';
import { hashTelemetryValue } from './posthog';

describe('getServerTelemetryContext', () => {
  let originalProjectRoot: string | undefined;
  let originalDistinctId: string | undefined;
  let originalCommand: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalProjectRoot = process.env.MASTRA_PROJECT_ROOT;
    originalDistinctId = process.env.MASTRA_CLI_DISTINCT_ID;
    originalCommand = process.env.MASTRA_TELEMETRY_COMMAND;
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalProjectRoot !== undefined) process.env.MASTRA_PROJECT_ROOT = originalProjectRoot;
    else delete process.env.MASTRA_PROJECT_ROOT;
    if (originalDistinctId !== undefined) process.env.MASTRA_CLI_DISTINCT_ID = originalDistinctId;
    else delete process.env.MASTRA_CLI_DISTINCT_ID;
    if (originalCommand !== undefined) process.env.MASTRA_TELEMETRY_COMMAND = originalCommand;
    else delete process.env.MASTRA_TELEMETRY_COMMAND;
    if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
    else delete process.env.NODE_ENV;
  });

  it('derives context from server telemetry environment variables', () => {
    process.env.MASTRA_PROJECT_ROOT = '/tmp/mastra-project';
    process.env.MASTRA_CLI_DISTINCT_ID = 'cli-distinct-id';
    process.env.MASTRA_TELEMETRY_COMMAND = 'dev';
    process.env.NODE_ENV = 'test';

    expect(getServerTelemetryContext()).toEqual({
      projectId: hashTelemetryValue('/tmp/mastra-project').slice(0, 16),
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
      distinctId: undefined,
      command: 'server',
      nodeEnv: 'development',
    });
  });
});
