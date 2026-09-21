import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { parseRetentionCommand } from '../../src/db/retention-command.js';
import { readRetentionSchedulerConfig } from '../../src/config/retention.js';

const execFileAsync = promisify(execFile);

describe('retention command and configuration', () => {
  it('is dry-run first, bounded, and preserves the exact tenant identity', () => {
    expect(parseRetentionCommand(['--tenant', 'tenant-東京', '--limit', '17'])).toEqual({
      tenantId: 'tenant-東京',
      limit: 17,
      dryRun: true,
    });
    expect(parseRetentionCommand(['--tenant', 'tenant-a', '--limit', '1', '--apply'])).toEqual({
      tenantId: 'tenant-a',
      limit: 1,
      dryRun: false,
    });
  });

  it('rejects global, normalized, or unbounded command inputs', () => {
    for (const argv of [
      ['--limit', '1'],
      ['--tenant', ' tenant-a ', '--limit', '1'],
      ['--tenant', '\ttenant-a', '--limit', '1'],
      ['--tenant', '\u00a0tenant-a', '--limit', '1'],
      ['--tenant', 'a'.repeat(129), '--limit', '1'],
      ['--tenant', '😀'.repeat(129), '--limit', '1'],
      ['--tenant', 'tenant-a', '--limit', '1025'],
      ['--tenant', 'tenant-a'],
    ])
      expect(() => parseRetentionCommand(argv)).toThrow('RETENTION_COMMAND_INVALID');
  });

  it('uses Unicode code points without normalizing tenant identity', () => {
    const emoji128 = '😀'.repeat(128);
    expect(parseRetentionCommand(['--tenant', emoji128, '--limit', '1'])).toEqual({
      tenantId: emoji128,
      limit: 1,
      dryRun: true,
    });
    expect(parseRetentionCommand(['--tenant', 'tenant-A', '--limit', '1'])).toEqual({
      tenantId: 'tenant-A',
      limit: 1,
      dryRun: true,
    });
    expect(parseRetentionCommand(['--tenant', 'tenant-a', '--limit', '1'])).toEqual({
      tenantId: 'tenant-a',
      limit: 1,
      dryRun: true,
    });
  });

  it('rejects contradictory, duplicate, missing, unknown, and positional flags', () => {
    for (const argv of [
      ['--tenant', 'tenant-a', '--tenant', 'tenant-b', '--limit', '1'],
      ['--tenant', 'tenant-a', '--limit', '1', '--limit', '2'],
      ['--tenant', 'tenant-a', '--limit', '1', '--dry-run', '--apply'],
      ['--tenant', 'tenant-a', '--limit', '1', '--apply', '--dry-run'],
      ['--tenant', '--limit', '1'],
      ['--tenant', 'tenant-a', '--limit'],
      ['--tenant', 'tenant-a', '--limit', '1', '--unknown'],
      ['--tenant', 'tenant-a', '--limit', '1', 'positional'],
    ])
      expect(() => parseRetentionCommand(argv)).toThrow('RETENTION_COMMAND_INVALID');
  });

  it('keeps invalid process invocations deterministic and redacted before DB access', async () => {
    const failure = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', 'scripts/retention-sweep.ts', '--tenant'],
      { cwd: process.cwd() },
    ).catch((error: { code?: number; stderr?: string; stdout?: string }) => error);
    expect(failure).toMatchObject({
      code: 1,
      stdout: '',
      stderr: 'RETENTION_COMMAND_FAILED\n',
    });
    expect(failure.stderr).not.toContain(process.cwd());
  });

  it('requires explicit canonical scope and limit when scheduling is enabled', () => {
    expect(readRetentionSchedulerConfig({})).toEqual({
      enabled: false,
      intervalMs: 86_400_000,
    });
    expect(
      readRetentionSchedulerConfig({
        RETENTION_SCHEDULER_ENABLED: 'true',
        RETENTION_TENANT_ID: 'tenant-a',
        RETENTION_SWEEP_LIMIT: '32',
        RETENTION_SWEEP_MAX_BATCHES: '4',
      }),
    ).toEqual({
      enabled: true,
      tenantId: 'tenant-a',
      limit: 32,
      maxBatchesPerRun: 4,
      intervalMs: 86_400_000,
    });
    expect(() =>
      readRetentionSchedulerConfig({
        RETENTION_SCHEDULER_ENABLED: 'true',
        RETENTION_TENANT_ID: ' tenant-a ',
        RETENTION_SWEEP_LIMIT: '32',
      }),
    ).toThrow('RETENTION_SCHEDULER_CONFIG_INVALID');
    expect(() =>
      readRetentionSchedulerConfig({
        RETENTION_SCHEDULER_ENABLED: 'true',
        RETENTION_TENANT_ID: 'a'.repeat(129),
        RETENTION_SWEEP_LIMIT: '32',
        RETENTION_SWEEP_MAX_BATCHES: '4',
      }),
    ).toThrow('RETENTION_SCHEDULER_CONFIG_INVALID');
  });
});
