import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  runTraceImport,
  resolveTraceImportWindow,
  traceImportAction,
  type TraceImportActionDependencies,
} from './action.js';
import type { TraceImportProvider } from './provider.js';
import type { PreparedTraceBatch, TraceImportSpan, TraceImportTrace } from './types.js';
import { uploadTraceImport } from './upload.js';
import { verifyTraceImport } from './verification.js';

vi.mock('../../auth/credentials.js', () => ({
  getCurrentOrgId: vi.fn(),
  getToken: vi.fn(),
}));
vi.mock('../../env/resolve-project.js', () => ({ resolveProject: vi.fn() }));

const { getCurrentOrgId, getToken } = await import('../../auth/credentials.js');
const { resolveProject } = await import('../../env/resolve-project.js');

const NOW = new Date('2026-09-11T12:00:00.000Z');
const temporaryDirectories: string[] = [];

function trace(id: number): TraceImportTrace {
  return {
    sourceTraceId: `source-${id}`,
    spans: [
      {
        traceId: id.toString(16).padStart(32, '0'),
        spanId: id.toString(16).padStart(16, '0'),
        parentSpanId: null,
        name: `trace-${id}`,
        spanType: 'generic',
        startedAt: '2026-09-10T12:00:00.000Z',
        endedAt: '2026-09-10T12:00:01.000Z',
        isEvent: false,
        metadata: { source: 'test' },
      },
    ],
  };
}

function provider(values = [trace(1)]): TraceImportProvider {
  return {
    identify: async () => ({
      provider: 'langfuse',
      baseUrl: 'https://cloud.langfuse.com',
      projectId: 'source-project',
      idAlgorithmVersion: '1',
    }),
    read: async function* () {
      for (const value of values) yield { kind: 'trace' as const, trace: value };
    },
  };
}

function ui(confirmed = true): NonNullable<TraceImportActionDependencies['ui']> {
  return {
    intro: vi.fn(),
    step: vi.fn(),
    note: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    cancel: vi.fn(),
    outro: vi.fn(),
    confirm: vi.fn(async () => confirmed),
  };
}

function destination() {
  return { accessToken: 'token', projectId: 'target-project', projectName: 'Target project' };
}

function target(options: { failUpload?: boolean } = {}) {
  const stored = new Map<string, TraceImportSpan[]>();
  return {
    projectId: 'target-project',
    upload: vi.fn(async (batch: PreparedTraceBatch) => {
      if (options.failUpload) throw new Error('collector unavailable');
      for (const item of batch.traces) stored.set(item.spans[0]!.traceId, item.spans);
    }),
    readTrace: vi.fn(async (traceId: string) => {
      const spans = stored.get(traceId);
      return spans ? { kind: 'found' as const, spans } : { kind: 'pending' as const };
    }),
  };
}

async function dependencies(overrides: TraceImportActionDependencies = {}): Promise<TraceImportActionDependencies> {
  const stateRoot = await mkdtemp(join(tmpdir(), 'trace-import-action-'));
  temporaryDirectories.push(stateRoot);
  return {
    stateRoot,
    now: () => NOW,
    ui: ui(),
    environment: {},
    resolveDestination: async () => destination(),
    createProvider: () => provider(),
    createTarget: () => target(),
    ...overrides,
  };
}

async function onlyImportId(stateRoot: string): Promise<string> {
  const imports = await readdir(join(stateRoot, 'traces', 'target-project'));
  expect(imports).toHaveLength(1);
  return imports[0]!;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('resolveTraceImportWindow', () => {
  it('uses the last 30 days by default and accepts a smaller explicit window', () => {
    expect(resolveTraceImportWindow({}, NOW)).toEqual({
      cutoffAt: '2026-08-12T12:00:00.000Z',
      snapshotAt: '2026-09-11T12:00:00.000Z',
    });
    expect(resolveTraceImportWindow({ from: '2026-09-01', to: '2026-09-10' }, NOW)).toEqual({
      cutoffAt: '2026-09-01T00:00:00.000Z',
      snapshotAt: '2026-09-10T00:00:00.000Z',
    });
  });

  it('clamps an implicit start to the Platform retention window when --to is in the past', () => {
    expect(resolveTraceImportWindow({ to: '2026-09-10T12:00:00Z' }, NOW)).toEqual({
      cutoffAt: '2026-08-12T12:00:00.000Z',
      snapshotAt: '2026-09-10T12:00:00.000Z',
    });
  });

  it('rejects invalid, future, reversed, older, and wider windows', () => {
    expect(() => resolveTraceImportWindow({ from: 'not-a-date' }, NOW)).toThrow('--from');
    expect(() => resolveTraceImportWindow({ to: '2026-09-12' }, NOW)).toThrow('future');
    expect(() => resolveTraceImportWindow({ from: '2026-09-10', to: '2026-09-01' }, NOW)).toThrow('earlier');
    expect(() => resolveTraceImportWindow({ from: '2026-08-01', to: '2026-08-20' }, NOW)).toThrow('last 30 days');
    expect(() => resolveTraceImportWindow({ to: '2026-08-12T12:00:00Z' }, NOW)).toThrow('last 30 days');
    expect(() => resolveTraceImportWindow({ from: '2026-08-12T11:59:59Z', to: '2026-09-11T12:00:00Z' }, NOW)).toThrow(
      'cannot exceed',
    );
  });
});

describe('runTraceImport', () => {
  it('requires an organization when authenticating with MASTRA_API_TOKEN', async () => {
    const previousToken = process.env.MASTRA_API_TOKEN;
    process.env.MASTRA_API_TOKEN = 'headless-token';
    vi.mocked(getToken).mockResolvedValue('headless-token');
    vi.mocked(getCurrentOrgId).mockResolvedValue('saved-login-org');

    try {
      await expect(runTraceImport({ provider: 'langfuse', dryRun: true }, { ui: ui() })).rejects.toThrow(
        'MASTRA_ORG_ID is required when MASTRA_API_TOKEN is set.',
      );
      expect(getCurrentOrgId).not.toHaveBeenCalled();
    } finally {
      if (previousToken === undefined) delete process.env.MASTRA_API_TOKEN;
      else process.env.MASTRA_API_TOKEN = previousToken;
    }
  });

  it('prepares a dry run without creating an upload target', async () => {
    const createTarget = vi.fn(() => target());
    const deps = await dependencies({ createTarget });
    const result = await runTraceImport({ provider: 'langfuse', dryRun: true }, deps);

    expect(result.status).toBe('dry-run');
    expect(result.report).toMatchObject({
      phase: 'prepared',
      counts: { preparedTraces: 1, preparedSpans: 1 },
      acknowledgedTraces: 0,
    });
    expect(createTarget).not.toHaveBeenCalled();
  });

  it('leaves prepared data resumable when confirmation is declined', async () => {
    const cli = ui(false);
    const createTarget = vi.fn(() => target());
    const result = await runTraceImport({ provider: 'langfuse' }, await dependencies({ ui: cli, createTarget }));

    expect(result.status).toBe('cancelled');
    expect(result.report.phase).toBe('prepared');
    expect(createTarget).not.toHaveBeenCalled();
    expect(cli.cancel).toHaveBeenCalledWith(expect.stringContaining('--resume'));
  });

  it('uploads, verifies, reports, and completes an accepted import', async () => {
    const platform = target();
    const result = await runTraceImport(
      { provider: 'langfuse', yes: true },
      await dependencies({ createTarget: () => platform }),
    );

    expect(result.status).toBe('complete');
    expect(result.report).toMatchObject({
      phase: 'complete',
      acknowledgedTraces: 1,
      acknowledgedSpans: 1,
      verification: { status: 'verified', sampledTraces: 1, verifiedTraces: 1 },
    });
    expect(platform.upload).toHaveBeenCalledOnce();
    expect(platform.readTrace).toHaveBeenCalledOnce();
  });

  it('retries local cleanup when resuming an already-complete import', async () => {
    const platform = target();
    const deps = await dependencies({ createTarget: () => platform });
    const completed = await runTraceImport({ provider: 'langfuse', yes: true }, deps);
    const preparedFile = join(completed.report.stateDirectory, 'traces.jsonl');
    await writeFile(preparedFile, 'leftover prepared data');

    const createProvider = vi.fn(() => {
      throw new Error('source should not be read');
    });
    const createTarget = vi.fn(() => {
      throw new Error('target should not be created');
    });
    const resumed = await runTraceImport(
      { provider: 'langfuse', resume: completed.report.importId, yes: true },
      { ...deps, createProvider, createTarget },
    );

    expect(resumed).toEqual(completed);
    await expect(access(preparedFile)).rejects.toThrow();
    expect(createProvider).not.toHaveBeenCalled();
    expect(createTarget).not.toHaveBeenCalled();
  });

  it('pauses after timed-out verification and keeps prepared data for resume', async () => {
    const platform = target();
    platform.readTrace = vi.fn(async () => ({ kind: 'pending' as const }));
    const result = await runTraceImport(
      { provider: 'langfuse', yes: true },
      await dependencies({
        createTarget: () => platform,
        verifyImport: options =>
          verifyTraceImport({
            ...options,
            limits: { maxAttempts: 2 },
            dependencies: { sleep: async () => undefined },
          }),
      }),
    );

    expect(result.status).toBe('paused');
    expect(result.report).toMatchObject({
      phase: 'paused',
      verification: { status: 'timed-out', queryAttempts: 2 },
    });
    await expect(access(join(result.report.stateDirectory, 'traces.jsonl'))).resolves.toBeUndefined();
  });

  it('reports paused verification as a command error', async () => {
    const home = await mkdtemp(join(tmpdir(), 'trace-import-action-home-'));
    temporaryDirectories.push(home);
    const stateRoot = join(home, '.mastra', 'imports');
    const prepared = await runTraceImport(
      { provider: 'langfuse', dryRun: true },
      {
        stateRoot,
        ui: ui(),
        environment: {},
        resolveDestination: async () => destination(),
        createProvider: () => provider(),
      },
    );
    await uploadTraceImport({
      directory: prepared.report.stateDirectory,
      target: { projectId: 'target-project', upload: async () => undefined },
    });

    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    vi.stubEnv('MASTRA_API_TOKEN', '');
    vi.mocked(getToken).mockResolvedValue('token');
    vi.mocked(getCurrentOrgId).mockResolvedValue('org');
    vi.mocked(resolveProject).mockResolvedValue({
      id: 'target-project',
      name: 'Target project',
      slug: 'target-project',
      organizationId: 'org',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    );

    await expect(
      traceImportAction('langfuse', { resume: prepared.report.importId, project: 'target-project', yes: true }),
    ).rejects.toThrow('Trace import paused because verification unavailable.');
    await expect(access(join(prepared.report.stateDirectory, 'traces.jsonl'))).resolves.toBeUndefined();
  });

  it('resumes pending upload without reading the source again', async () => {
    const deps = await dependencies({ createTarget: () => target({ failUpload: true }) });
    await expect(runTraceImport({ provider: 'langfuse', yes: true }, deps)).rejects.toThrow(
      /collector unavailable[\s\S]*--resume/,
    );

    const importId = await onlyImportId(deps.stateRoot!);
    const createProvider = vi.fn(() => {
      throw new Error('source should not be read');
    });
    const platform = target();
    const resumed = await runTraceImport(
      { provider: 'langfuse', resume: importId, yes: true },
      { ...deps, createProvider, createTarget: () => platform },
    );

    expect(resumed.status).toBe('complete');
    expect(createProvider).not.toHaveBeenCalled();
    expect(platform.upload).toHaveBeenCalledOnce();
  });

  it('rejects date and dry-run options that would change resume behavior', async () => {
    await expect(runTraceImport({ provider: 'langfuse', resume: 'id', from: '2026-09-01' })).rejects.toThrow(
      'cannot be changed',
    );
    await expect(runTraceImport({ provider: 'langfuse', resume: 'id', dryRun: true })).rejects.toThrow(
      'cannot be combined',
    );
  });
});
