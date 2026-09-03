import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/trace-import', () => ({
  resolveCollectorEndpoint: vi.fn(() => ({
    endpoint: 'https://platform.example/projects/11111111-1111-4111-8111-111111111111/ai/spans/publish',
    origin: 'https://platform.example',
  })),
  runTraceImport: vi.fn(),
}));

vi.mock('../studio/project-config.js', () => ({
  loadProjectConfig: vi.fn().mockResolvedValue(null),
}));

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn(),
  getCurrentOrgId: vi.fn(),
}));

vi.mock('../env/platform-api.js', () => ({
  fetchProjects: vi.fn(),
}));

const { runTraceImport } = await import('@mastra/trace-import');
const { getToken, getCurrentOrgId } = await import('../auth/credentials.js');
const { fetchProjects } = await import('../env/platform-api.js');
const { loadProjectConfig } = await import('../studio/project-config.js');
const prompts = await import('@clack/prompts');
const { traceImportAction } = await import('./import.js');
const { registerTracesCommand } = await import('./index.js');

const report = {
  importId: 'import-1',
  stateDirectory: '/tmp/import-1',
  snapshotAt: '2026-09-03T00:00:00.000Z',
  cutoffAt: '2026-08-04T00:00:00.000Z',
  sourceBaseUrl: 'https://cloud.langfuse.com',
  sourceProjectId: 'langfuse-project',
  targetProjectId: '11111111-1111-4111-8111-111111111111',
  collectorOrigin: 'https://platform.example',
  counts: {
    readSpans: 1,
    eligibleTraces: 1,
    eligibleSpans: 1,
    skippedTraces: 0,
    skippedSpans: 0,
    enqueuedSpans: 0,
    verifiedTraces: 0,
    truncationRiskSpans: 0,
    sourceRetries: 0,
    targetRetries: 0,
    skipReasons: {},
  },
  estimatedPayloadBytes: 100,
  status: 'dry-run' as const,
  verification: {
    status: 'not-performed' as const,
    reason: 'Upload has not completed.',
    sampledTraces: 0,
    verifiedTraces: 0,
    attempts: 0,
  },
  warnings: [],
  consistencyWarning: 'The source is live.',
};

describe('traces import command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-lf-test');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-lf-test');
    vi.stubEnv('LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'sk_mastra_test');
    vi.stubEnv('MASTRA_CLOUD_ACCESS_TOKEN', '');
    vi.mocked(runTraceImport).mockResolvedValue(structuredClone(report));
    vi.mocked(loadProjectConfig).mockResolvedValue(null);
    vi.mocked(getToken).mockResolvedValue('login-token');
    vi.mocked(getCurrentOrgId).mockResolvedValue('organization-1');
    vi.mocked(fetchProjects).mockResolvedValue([]);
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    process.exitCode = undefined;
  });

  it('registers the CLI-only Langfuse import surface', () => {
    const program = new Command();
    registerTracesCommand(program);

    const traces = program.commands.find(command => command.name() === 'traces');
    const importCommand = traces?.commands.find(command => command.name() === 'import');

    expect(importCommand?.helpInformation()).toContain('--provider <provider>');
    expect(importCommand?.helpInformation()).toContain('--dry-run');
    expect(importCommand?.helpInformation()).toContain('--resume <import-id>');
    expect(importCommand?.helpInformation()).not.toContain('studio');
  });

  it('runs a dry-run without requiring a Mastra upload credential', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await traceImportAction({
      provider: 'langfuse',
      project: '11111111-1111-4111-8111-111111111111',
      dryRun: true,
      json: true,
    });

    expect(runTraceImport).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          baseUrl: 'https://cloud.langfuse.com',
          publicKey: 'pk-lf-test',
          secretKey: 'sk-lf-test',
        },
        target: expect.objectContaining({
          projectId: '11111111-1111-4111-8111-111111111111',
          accessToken: undefined,
        }),
        dryRun: true,
      }),
    );
    expect(output).toHaveBeenCalledWith(JSON.stringify(report));
  });

  it('requires --yes when upload confirmation is unavailable', async () => {
    vi.mocked(runTraceImport).mockImplementation(async options => {
      await expect(options.confirm?.(report)).rejects.toThrow(
        'Interactive confirmation is unavailable. Re-run with --yes or --dry-run.',
      );
      return { ...report, status: 'cancelled' };
    });

    await traceImportAction({
      provider: 'langfuse',
      project: '11111111-1111-4111-8111-111111111111',
      json: true,
    });

    expect(runTraceImport).toHaveBeenCalledOnce();
  });

  it('rejects providers outside the V0 contract', async () => {
    await expect(
      traceImportAction({
        provider: 'langsmith',
        project: '11111111-1111-4111-8111-111111111111',
        dryRun: true,
      }),
    ).rejects.toThrow('V0 only supports --provider langfuse.');
    expect(runTraceImport).not.toHaveBeenCalled();
  });

  it('never falls back to the CLI login token for target uploads', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_CLOUD_ACCESS_TOKEN', '');

    await expect(
      traceImportAction({
        provider: 'langfuse',
        project: '11111111-1111-4111-8111-111111111111',
        yes: true,
      }),
    ).rejects.toThrow('MASTRA_PLATFORM_ACCESS_TOKEN is required');
    expect(getToken).not.toHaveBeenCalled();
    expect(runTraceImport).not.toHaveBeenCalled();
  });

  it('accepts MASTRA_CLOUD_ACCESS_TOKEN as a deprecated fallback and warns once', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_CLOUD_ACCESS_TOKEN', 'sk_legacy_mastra_test');
    const warning = vi.spyOn(prompts.log, 'warn').mockImplementation(() => undefined);

    await traceImportAction({
      provider: 'langfuse',
      project: '11111111-1111-4111-8111-111111111111',
      yes: true,
    });

    expect(runTraceImport).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ accessToken: 'sk_legacy_mastra_test' }),
      }),
    );
    expect(warning).toHaveBeenCalledWith(
      'MASTRA_CLOUD_ACCESS_TOKEN is deprecated; rename it to MASTRA_PLATFORM_ACCESS_TOKEN.',
    );
  });

  it('keeps deprecated-token warnings inside machine-readable JSON', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_CLOUD_ACCESS_TOKEN', 'sk_legacy_mastra_test');
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warning = vi.spyOn(prompts.log, 'warn').mockImplementation(() => undefined);

    await traceImportAction({
      provider: 'langfuse',
      project: '11111111-1111-4111-8111-111111111111',
      yes: true,
      json: true,
    });

    expect(warning).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledOnce();
    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
      warnings: ['MASTRA_CLOUD_ACCESS_TOKEN is deprecated; rename it to MASTRA_PLATFORM_ACCESS_TOKEN.'],
    });
  });

  it('rejects a login-style token before staging source data', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'user-login-token');

    await expect(
      traceImportAction({
        provider: 'langfuse',
        project: '11111111-1111-4111-8111-111111111111',
        yes: true,
      }),
    ).rejects.toThrow('organization ingestion key beginning with "sk_"');
    expect(runTraceImport).not.toHaveBeenCalled();
  });

  it('resolves project precedence as explicit option, environment, then linked config', async () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const explicitId = '11111111-1111-4111-8111-111111111111';
    const environmentId = '22222222-2222-4222-8222-222222222222';
    const configId = '33333333-3333-4333-8333-333333333333';
    vi.stubEnv('MASTRA_PROJECT_ID', environmentId);
    vi.mocked(loadProjectConfig).mockResolvedValue({
      projectId: configId,
      projectName: 'Linked project',
      projectSlug: 'linked-project',
      organizationId: 'organization-1',
    });

    await traceImportAction({ provider: 'langfuse', project: explicitId, dryRun: true, json: true });
    await traceImportAction({ provider: 'langfuse', dryRun: true, json: true });
    vi.stubEnv('MASTRA_PROJECT_ID', '');
    await traceImportAction({ provider: 'langfuse', dryRun: true, json: true });

    expect(vi.mocked(runTraceImport).mock.calls.map(([options]) => options.target.projectId)).toEqual([
      explicitId,
      environmentId,
      configId,
    ]);
    expect(getToken).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledTimes(3);
  });

  it('uses an authenticated project slug and rejects ambiguous project names', async () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.mocked(fetchProjects).mockResolvedValue([
      { id: 'project-by-slug', slug: 'unique-slug', name: 'Duplicate', organizationId: 'organization-1' },
      { id: 'project-a', slug: 'project-a', name: 'Duplicate', organizationId: 'organization-1' },
      { id: 'project-b', slug: 'project-b', name: 'Duplicate', organizationId: 'organization-1' },
    ]);

    await traceImportAction({
      provider: 'langfuse',
      project: 'unique-slug',
      dryRun: true,
      json: true,
    });
    expect(runTraceImport).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ projectId: 'project-by-slug' }) }),
    );
    expect(fetchProjects).toHaveBeenCalledWith('sk_mastra_test', 'organization-1');
    expect(getToken).not.toHaveBeenCalled();
    expect(output).toHaveBeenCalledTimes(1);

    await expect(
      traceImportAction({ provider: 'langfuse', project: 'Duplicate', dryRun: true, json: true }),
    ).rejects.toThrow('More than one project is named "Duplicate"');
  });

  it('explains stale project slugs using the organization-key project list', async () => {
    vi.mocked(fetchProjects).mockResolvedValue([
      { id: 'current-id', slug: 'current-project', name: 'Current project', organizationId: 'organization-1' },
    ]);

    await expect(
      traceImportAction({ provider: 'langfuse', project: 'deleted-project', dryRun: true, json: true }),
    ).rejects.toThrow('Project "deleted-project" was not found in the active organization. It may be stale or deleted');
    expect(fetchProjects).toHaveBeenCalledWith('sk_mastra_test', 'organization-1');
  });

  it('uses resumable and interrupt exit statuses', async () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.mocked(runTraceImport).mockResolvedValueOnce({ ...report, status: 'paused' });
    await traceImportAction({
      provider: 'langfuse',
      project: '11111111-1111-4111-8111-111111111111',
      yes: true,
      json: true,
    });
    expect(process.exitCode).toBe(2);

    process.exitCode = undefined;
    vi.mocked(runTraceImport).mockImplementationOnce(async () => {
      process.emit('SIGINT');
      return { ...report, status: 'paused' };
    });
    await traceImportAction({
      provider: 'langfuse',
      project: '11111111-1111-4111-8111-111111111111',
      yes: true,
      json: true,
    });
    expect(process.exitCode).toBe(130);
    expect(output).toHaveBeenCalledTimes(2);
  });
});
