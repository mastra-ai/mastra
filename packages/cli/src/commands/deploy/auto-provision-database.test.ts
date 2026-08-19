import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DbPlatformApi from '../db/platform-api.js';
import type { PreflightIssue } from '../deploy-preflight.js';
import type * as EnvPlatformApi from '../env/platform-api.js';
import type { AutoProvisionContext } from './auto-provision-database.js';
import { maybeApplyPreflightAutofixes } from './auto-provision-database.js';

const {
  confirmMock,
  cancelMock,
  logErrorMock,
  logInfoMock,
  logSuccessMock,
  spinnerMock,
  attachDatabaseMock,
  pollDatabaseUntilReadyMock,
  enableBackgroundWorkersMock,
} = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  cancelMock: vi.fn(),
  logErrorMock: vi.fn(),
  logInfoMock: vi.fn(),
  logSuccessMock: vi.fn(),
  spinnerMock: { start: vi.fn(), stop: vi.fn(), message: vi.fn() },
  attachDatabaseMock: vi.fn(),
  pollDatabaseUntilReadyMock: vi.fn(),
  enableBackgroundWorkersMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  confirm: (args: unknown) => confirmMock(args),
  cancel: (args: unknown) => cancelMock(args),
  isCancel: (v: unknown) => v === Symbol.for('clack.cancel'),
  spinner: () => spinnerMock,
  log: { error: logErrorMock, info: logInfoMock, success: logSuccessMock },
}));

vi.mock('../db/platform-api.js', async () => {
  const actual = await vi.importActual<typeof DbPlatformApi>('../db/platform-api.js');
  return {
    ...actual,
    attachDatabase: (...args: unknown[]) => attachDatabaseMock(...args),
    pollDatabaseUntilReady: (...args: unknown[]) => pollDatabaseUntilReadyMock(...args),
  };
});

vi.mock('../env/platform-api.js', async () => {
  const actual = await vi.importActual<typeof EnvPlatformApi>('../env/platform-api.js');
  return {
    ...actual,
    enableBackgroundWorkers: (...args: unknown[]) => enableBackgroundWorkersMock(...args),
  };
});

function makeCtx(overrides: Partial<AutoProvisionContext> = {}): AutoProvisionContext {
  return {
    token: 't',
    orgId: 'org-1',
    projectId: 'proj-1',
    projectName: 'My App',
    projectSlug: 'my-app',
    environment: { id: 'env-prod', slug: 'my-app-production', name: 'production', type: 'production', envVars: null },
    envVars: {},
    autoAccept: false,
    ...overrides,
  };
}

function tursoIssue(overrides: Partial<PreflightIssue> = {}): PreflightIssue {
  return {
    code: 'LOCAL_STORAGE_PATH',
    severity: 'error',
    message: 'file:./mastra.db will be used at runtime because TURSO_DATABASE_URL is not set',
    fix: 'create a managed database that provides it: mastra env db create --kind turso',
    autofix: { kind: 'create-managed-database', provider: 'turso', envVarName: 'TURSO_DATABASE_URL' },
    ...overrides,
  };
}

function neonIssue(overrides: Partial<PreflightIssue> = {}): PreflightIssue {
  return {
    code: 'LOCAL_STORAGE_PATH',
    severity: 'error',
    message: 'file:./data.db will be used at runtime because DATABASE_URL is not set',
    fix: 'mastra env db create --kind neon',
    autofix: { kind: 'create-managed-database', provider: 'neon', envVarName: 'DATABASE_URL' },
    ...overrides,
  };
}

function redisIssue(overrides: Partial<PreflightIssue> = {}): PreflightIssue {
  return {
    code: 'LOCAL_STORAGE_PATH',
    severity: 'error',
    message: 'RedisStreamsPubSub cannot connect at runtime because REDIS_URL is not set',
    fix: 'mastra env db create --kind redis',
    autofix: { kind: 'create-managed-database', provider: 'redis', envVarName: 'REDIS_URL' },
    ...overrides,
  };
}

function workerIssue(overrides: Partial<PreflightIssue> = {}): PreflightIssue {
  return {
    code: 'BACKGROUND_WORKERS_DISABLED',
    severity: 'warning',
    message: 'Background tasks are enabled but dedicated workers are disabled',
    fix: 'Enable Background Workers',
    autofix: { kind: 'enable-background-workers' },
    ...overrides,
  };
}

function unrelatedIssue(): PreflightIssue {
  return {
    code: 'MISSING_ENV_VAR',
    severity: 'error',
    message: 'ANTHROPIC_API_KEY is missing',
    fix: 'set it',
  };
}

describe('maybeApplyPreflightAutofixes', () => {
  const originalStdinTTY = process.stdin.isTTY;
  const originalStdoutTTY = process.stdout.isTTY;
  const originalCI = process.env.CI;

  beforeEach(() => {
    confirmMock.mockReset();
    cancelMock.mockReset();
    logErrorMock.mockReset();
    logSuccessMock.mockReset();
    spinnerMock.start.mockReset();
    spinnerMock.stop.mockReset();
    spinnerMock.message.mockReset();
    attachDatabaseMock.mockReset();
    pollDatabaseUntilReadyMock.mockReset();
    enableBackgroundWorkersMock.mockReset();
    // Default: interactive TTY.
    (process.stdin as unknown as { isTTY: boolean }).isTTY = true;
    (process.stdout as unknown as { isTTY: boolean }).isTTY = true;
    delete process.env.CI;
  });

  afterEach(() => {
    (process.stdin as unknown as { isTTY: boolean | undefined }).isTTY = originalStdinTTY;
    (process.stdout as unknown as { isTTY: boolean | undefined }).isTTY = originalStdoutTTY;
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
  });

  it('returns the input untouched when there are no autofixable issues', async () => {
    const issues = [unrelatedIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(result.issues).toBe(issues);
    expect(result.provisioned).toEqual([]);
    expect(result.newlyManagedEnvVarNames).toEqual([]);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(attachDatabaseMock).not.toHaveBeenCalled();
  });

  it('does not prompt in a non-interactive terminal even if issues are autofixable', async () => {
    (process.stdin as unknown as { isTTY: boolean }).isTTY = false;

    const issues = [tursoIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(result.issues).toBe(issues);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(attachDatabaseMock).not.toHaveBeenCalled();
  });

  it('does not prompt when autoAccept is set (no silent infra creation)', async () => {
    const issues = [tursoIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx({ autoAccept: true }));

    expect(result.issues).toBe(issues);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(attachDatabaseMock).not.toHaveBeenCalled();
  });

  it('provisions when the user confirms, drops the resolved issue, and reports the injected vars', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-1', name: 'my-app-turso', kind: 'turso' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-1', name: 'my-app-turso', kind: 'turso' });

    const issues = [tursoIssue(), unrelatedIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(attachDatabaseMock).toHaveBeenCalledWith('t', 'org-1', 'proj-1', {
      kind: 'turso',
      name: 'my-app-turso',
      environmentId: 'env-prod',
    });
    expect(pollDatabaseUntilReadyMock).toHaveBeenCalled();
    expect(result.issues.map(i => i.code)).toEqual(['MISSING_ENV_VAR']);
    expect(result.provisioned).toHaveLength(1);
    expect(result.newlyManagedEnvVarNames).toEqual(['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']);
  });

  it('provisions a managed Redis when the user confirms and reports REDIS_URL as newly managed', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-redis', kind: 'redis' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-redis', kind: 'redis' });

    const issues = [redisIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(attachDatabaseMock).toHaveBeenCalledWith('t', 'org-1', 'proj-1', {
      kind: 'redis',
      name: 'my-app-redis',
      environmentId: 'env-prod',
    });
    expect(result.issues).toEqual([]);
    expect(result.provisioned).toHaveLength(1);
    expect(result.newlyManagedEnvVarNames).toEqual(['REDIS_URL']);
  });

  it('leaves the issue in place when the user declines', async () => {
    confirmMock.mockResolvedValue(false);

    const issues = [tursoIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(attachDatabaseMock).not.toHaveBeenCalled();
    expect(result.issues).toBe(issues);
    expect(result.provisioned).toEqual([]);
  });

  it('deduplicates prompts to one per provider (turso needs both URL and TOKEN)', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-1', name: 'my-app-db', kind: 'turso' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-1', name: 'my-app-db', kind: 'turso' });

    const issues = [
      tursoIssue({ autofix: { kind: 'create-managed-database', provider: 'turso', envVarName: 'TURSO_DATABASE_URL' } }),
      tursoIssue({ autofix: { kind: 'create-managed-database', provider: 'turso', envVarName: 'TURSO_AUTH_TOKEN' } }),
    ];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(attachDatabaseMock).toHaveBeenCalledTimes(1);
    expect(result.issues).toEqual([]);
  });

  it('prompts once per distinct provider when multiple providers are missing', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock
      .mockResolvedValueOnce({ id: 'db-1', name: 'my-app-db', kind: 'turso' })
      .mockResolvedValueOnce({ id: 'db-2', name: 'my-app-db', kind: 'neon' });
    pollDatabaseUntilReadyMock
      .mockResolvedValueOnce({ id: 'db-1', name: 'my-app-db', kind: 'turso' })
      .mockResolvedValueOnce({ id: 'db-2', name: 'my-app-db', kind: 'neon' });

    const result = await maybeApplyPreflightAutofixes([tursoIssue(), neonIssue()], makeCtx());

    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(attachDatabaseMock).toHaveBeenCalledTimes(2);
    expect(result.provisioned.map(d => d.kind)).toEqual(['turso', 'neon']);
    expect(result.newlyManagedEnvVarNames).toEqual(['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'DATABASE_URL']);
    expect(result.issues).toEqual([]);
  });

  it('surfaces provisioning failures as log.error and leaves the issue in place', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockRejectedValue(new Error('quota exceeded'));

    const issues = [tursoIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(logErrorMock).toHaveBeenCalled();
    expect(String(logErrorMock.mock.calls[0]![0])).toContain('quota exceeded');
    // Issue is still there, so the caller's error printer will show
    // `mastra env db create --kind turso` remediation.
    expect(result.issues).toBe(issues);
    expect(result.provisioned).toEqual([]);
    expect(result.newlyManagedEnvVarNames).toEqual([]);
  });

  it('attaches to the target environment (scoped, not project-shared)', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-1', name: 'my-app-db', kind: 'turso' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-1', name: 'my-app-db', kind: 'turso' });

    await maybeApplyPreflightAutofixes(
      [tursoIssue()],
      makeCtx({ environment: { id: 'env-stg', slug: 'stg', name: 'staging', type: 'staging', envVars: null } }),
    );

    expect(attachDatabaseMock).toHaveBeenCalledWith(
      't',
      'org-1',
      'proj-1',
      expect.objectContaining({ environmentId: 'env-stg' }),
    );
  });

  it('derives an env-suffixed default name for non-production environments', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-1', name: 'my-app-eu-turso', kind: 'turso' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-1', name: 'my-app-eu-turso', kind: 'turso' });

    await maybeApplyPreflightAutofixes(
      [tursoIssue()],
      makeCtx({ environment: { id: 'env-eu', slug: 'my-app--eu', name: 'eu', type: 'preview', envVars: null } }),
    );

    expect(attachDatabaseMock).toHaveBeenCalledWith(
      't',
      'org-1',
      'proj-1',
      expect.objectContaining({ name: 'my-app-eu-turso' }),
    );
  });

  it('keeps the canonical unsuffixed name for the production environment', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-1', name: 'my-app-turso', kind: 'turso' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-1', name: 'my-app-turso', kind: 'turso' });

    await maybeApplyPreflightAutofixes(
      [tursoIssue()],
      makeCtx({
        environment: { id: 'env-prod', slug: 'my-app', name: 'production', type: 'production', envVars: null },
      }),
    );

    expect(attachDatabaseMock).toHaveBeenCalledWith(
      't',
      'org-1',
      'proj-1',
      expect.objectContaining({ name: 'my-app-turso' }),
    );
  });

  it('provisions missing managed Redis and enables background workers when the user confirms', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-db', kind: 'redis' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-db', kind: 'redis' });
    enableBackgroundWorkersMock.mockResolvedValue({});

    const result = await maybeApplyPreflightAutofixes(
      [workerIssue(), unrelatedIssue()],
      makeCtx({ environment: { id: 'env-prod', slug: 'prod', name: 'production', type: 'production', envVars: null } }),
    );

    expect(attachDatabaseMock).toHaveBeenCalledWith('t', 'org-1', 'proj-1', {
      kind: 'redis',
      name: 'my-app-db',
      environmentId: 'env-prod',
    });
    expect(pollDatabaseUntilReadyMock.mock.invocationCallOrder[0]).toBeLessThan(
      enableBackgroundWorkersMock.mock.invocationCallOrder[0]!,
    );
    expect(enableBackgroundWorkersMock).toHaveBeenCalledWith('t', 'org-1', 'proj-1', 'env-prod', 'managed');
    expect(result.provisioned).toHaveLength(1);
    expect(result.newlyManagedEnvVarNames).toEqual(['REDIS_URL']);
    expect(result.backgroundWorkersEnabled).toBe(true);
    expect(result.issues).toEqual([unrelatedIssue()]);
  });

  it('uses BYO Redis when REDIS_URL is stored on the environment and not managed', async () => {
    confirmMock.mockResolvedValue(true);
    enableBackgroundWorkersMock.mockResolvedValue({});

    await maybeApplyPreflightAutofixes(
      [workerIssue()],
      makeCtx({
        environment: {
          id: 'env-prod',
          slug: 'prod',
          name: 'production',
          type: 'production',
          envVars: { REDIS_URL: 'redis://example.test' },
        },
        envVars: { REDIS_URL: 'redis://example.test' },
      }),
    );

    expect(enableBackgroundWorkersMock).toHaveBeenCalledWith('t', 'org-1', 'proj-1', 'env-prod', 'byo');
    expect(attachDatabaseMock).not.toHaveBeenCalled();
  });

  it('skips worker setup when REDIS_URL exists only locally (not stored on the platform yet)', async () => {
    // The platform resolves BYO Redis from *stored* env vars; local .env vars
    // are only uploaded with the deploy. Enabling now would 400, so the fix is
    // skipped with guidance instead of prompting.
    const issues = [workerIssue()];
    const result = await maybeApplyPreflightAutofixes(
      issues,
      makeCtx({ envVars: { REDIS_URL: 'redis://local-only.test' } }),
    );

    expect(confirmMock).not.toHaveBeenCalled();
    expect(enableBackgroundWorkersMock).not.toHaveBeenCalled();
    expect(attachDatabaseMock).not.toHaveBeenCalled();
    expect(result.issues).toBe(issues);
    expect(result.backgroundWorkersEnabled).toBe(false);
    expect(logInfoMock).toHaveBeenCalledWith(expect.stringContaining('re-run `mastra deploy`'));
  });

  it('cancels the deploy when the worker prompt is aborted', async () => {
    confirmMock.mockResolvedValue(Symbol.for('clack.cancel'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    await expect(maybeApplyPreflightAutofixes([workerIssue()], makeCtx())).rejects.toThrow('process.exit');

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(enableBackgroundWorkersMock).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('provisions managed Redis before enabling workers', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-db', kind: 'redis' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-db', kind: 'redis' });
    enableBackgroundWorkersMock.mockResolvedValue({});

    const result = await maybeApplyPreflightAutofixes([workerIssue(), redisIssue()], makeCtx());

    expect(pollDatabaseUntilReadyMock.mock.invocationCallOrder[0]).toBeLessThan(
      enableBackgroundWorkersMock.mock.invocationCallOrder[0]!,
    );
    expect(enableBackgroundWorkersMock).toHaveBeenCalledWith('t', 'org-1', 'proj-1', 'env-prod', 'managed');
    expect(result.issues).toEqual([]);
    expect(result.newlyManagedEnvVarNames).toEqual(['REDIS_URL']);
    expect(result.backgroundWorkersEnabled).toBe(true);
  });

  it('leaves the worker issue when enabling workers fails', async () => {
    confirmMock.mockResolvedValue(true);
    enableBackgroundWorkersMock.mockRejectedValue(new Error('Scalable Server add-on required'));

    const issues = [workerIssue()];
    const result = await maybeApplyPreflightAutofixes(
      issues,
      makeCtx({
        environment: {
          id: 'env-prod',
          slug: 'prod',
          name: 'production',
          type: 'production',
          envVars: { REDIS_URL: 'redis://example.test' },
        },
        envVars: { REDIS_URL: 'redis://example.test' },
      }),
    );

    expect(result.issues).toBe(issues);
    expect(result.backgroundWorkersEnabled).toBe(false);
    expect(logErrorMock).toHaveBeenCalledWith(expect.stringContaining('Scalable Server add-on required'));
  });

  it('reports a provisioned Redis when worker enablement fails afterward', async () => {
    confirmMock.mockResolvedValue(true);
    attachDatabaseMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-db', kind: 'redis' });
    pollDatabaseUntilReadyMock.mockResolvedValue({ id: 'db-redis-1', name: 'my-app-db', kind: 'redis' });
    enableBackgroundWorkersMock.mockRejectedValue(new Error('Scalable Server add-on required'));

    const issues = [workerIssue()];
    const result = await maybeApplyPreflightAutofixes(issues, makeCtx());

    expect(result.issues).toEqual(issues);
    expect(result.provisioned).toHaveLength(1);
    expect(result.newlyManagedEnvVarNames).toEqual(['REDIS_URL']);
    expect(result.backgroundWorkersEnabled).toBe(false);
  });
});
