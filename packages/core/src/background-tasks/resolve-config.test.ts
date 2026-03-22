import { describe, it, expect } from 'vitest';
import { resolveBackgroundConfig } from './resolve-config';

describe('resolveBackgroundConfig', () => {
  it('returns foreground by default when no config is set', () => {
    const args: Record<string, unknown> = { query: 'test' };
    const result = resolveBackgroundConfig({ args, toolName: 'my-tool' });

    expect(result.runInBackground).toBe(false);
    expect(result.timeoutMs).toBe(300_000);
    expect(result.maxRetries).toBe(0);
  });

  it('uses tool-level config when set', () => {
    const args: Record<string, unknown> = { query: 'test' };
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      toolConfig: { enabled: true, timeoutMs: 600_000, retries: { maxRetries: 2 } },
    });

    expect(result.runInBackground).toBe(true);
    expect(result.timeoutMs).toBe(600_000);
    expect(result.maxRetries).toBe(2);
  });

  it('agent config overrides tool config for enabled', () => {
    const args: Record<string, unknown> = {};
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      toolConfig: { enabled: true },
      agentConfig: { tools: { 'my-tool': false } },
    });

    expect(result.runInBackground).toBe(false);
  });

  it('agent config "all" enables all tools', () => {
    const args: Record<string, unknown> = {};
    const result = resolveBackgroundConfig({
      args,
      toolName: 'any-tool',
      agentConfig: { tools: 'all' },
    });

    expect(result.runInBackground).toBe(true);
  });

  it('agent config with object overrides timeout', () => {
    const args: Record<string, unknown> = {};
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      toolConfig: { enabled: true, timeoutMs: 100_000 },
      agentConfig: { tools: { 'my-tool': { enabled: true, timeoutMs: 900_000 } } },
    });

    expect(result.runInBackground).toBe(true);
    expect(result.timeoutMs).toBe(900_000);
  });

  it('LLM override takes highest priority', () => {
    const args: Record<string, unknown> = {
      query: 'test',
      _background: { enabled: false },
    };
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      toolConfig: { enabled: true },
      agentConfig: { tools: 'all' },
    });

    expect(result.runInBackground).toBe(false);
  });

  it('LLM override can force background with custom timeout', () => {
    const args: Record<string, unknown> = {
      query: 'test',
      _background: { enabled: true, timeoutMs: 999_000, maxRetries: 5 },
    };
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      // No tool or agent config — LLM forces it
    });

    expect(result.runInBackground).toBe(true);
    expect(result.timeoutMs).toBe(999_000);
    expect(result.maxRetries).toBe(5);
  });

  it('strips _background from args', () => {
    const args: Record<string, unknown> = {
      query: 'test',
      _background: { enabled: true },
    };

    resolveBackgroundConfig({ args, toolName: 'my-tool' });

    expect(args._background).toBeUndefined();
    expect(args.query).toBe('test');
  });

  it('manager config provides defaults for timeout and retries', () => {
    const args: Record<string, unknown> = {};
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      toolConfig: { enabled: true },
      managerConfig: {
        defaultTimeoutMs: 120_000,
        defaultRetries: { maxRetries: 3 },
      },
    });

    expect(result.timeoutMs).toBe(120_000);
    expect(result.maxRetries).toBe(3);
  });

  it('tool config overrides manager defaults', () => {
    const args: Record<string, unknown> = {};
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      toolConfig: { enabled: true, timeoutMs: 60_000, retries: { maxRetries: 1 } },
      managerConfig: {
        defaultTimeoutMs: 120_000,
        defaultRetries: { maxRetries: 3 },
      },
    });

    expect(result.timeoutMs).toBe(60_000);
    expect(result.maxRetries).toBe(1);
  });

  it('handles missing agent tool entry gracefully', () => {
    const args: Record<string, unknown> = {};
    const result = resolveBackgroundConfig({
      args,
      toolName: 'my-tool',
      toolConfig: { enabled: true },
      agentConfig: { tools: { 'other-tool': true } },
    });

    // Falls through to tool config
    expect(result.runInBackground).toBe(true);
  });
});
