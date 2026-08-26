import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerApiCommand } from '../index.js';

const fetchMock = vi.fn();
let stdout = '';
let stderr = '';

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('MASTRA_API_TOKEN', 'platform-token');
  vi.stubEnv('MASTRA_PROJECT_ID', 'project-123');
  vi.stubEnv('MASTRA_ORG_ID', 'org-123');
  vi.stubEnv('MASTRA_GATEWAY_URL', 'https://gateway.example.test/v1');
  stdout = '';
  stderr = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    stderr += String(chunk);
    return true;
  });
  process.exitCode = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  process.exitCode = undefined;
});

describe('Platform experiment CLI', () => {
  it('uses the authenticated project-scoped control plane for hosted dataset discovery', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-access-token');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        datasets: [{ datasetId: 'dataset-1', name: 'Evaluation set' }],
        page: 1,
        perPage: 25,
        total: 1,
        hasMore: false,
      }),
    );

    await runCli('api', 'experiment', 'platform', 'dataset', 'list', '{"page":1,"perPage":25}');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://gateway.example.test/v1/projects/project-123/experiments/assets/datasets?page=1&perPage=25',
    );
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        Authorization: 'Bearer platform-access-token',
        'x-organization-id': 'org-123',
      },
    });
    expect(JSON.parse(stdout)).toEqual({
      data: [{ datasetId: 'dataset-1', name: 'Evaluation set' }],
      page: { total: 1, page: 1, perPage: 25, hasMore: false },
    });
    expect(stderr).toBe('');
  });

  it('submits the immutable hosted dataset version and caller idempotency key unchanged', async () => {
    const input = validRunInput();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          experimentId: input.experimentId,
          jobId: 'job-123',
          status: 'queued',
          datasetVersion: 7,
          datasetDigest: 'a'.repeat(64),
          hostedAssets: { datasetVersionId: input.datasetVersionId, scorers: [] },
          studioUrl: 'https://mastra.ai/orgs/org-123/projects/project-123/experiments/runs/experiment-123',
        },
        { status: 202 },
      ),
    );

    await runCli('api', 'experiment', 'platform', 'run', JSON.stringify(input));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://gateway.example.test/v1/projects/project-123/experiments/runs');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(init.body)).toEqual(input);
    expect(JSON.parse(init.body).idempotencyKey).toBe('caller-key-123');
    expect(JSON.parse(stdout).data).toMatchObject({
      experimentId: 'experiment-123',
      jobId: 'job-123',
      hostedAssets: { datasetVersionId: 'dataset-version-123' },
      studioUrl: expect.stringContaining('/experiments/runs/experiment-123'),
    });
  });

  it('preserves typed hosted scorer 501 errors and exits nonzero', async () => {
    const input = {
      ...validRunInput(),
      scorers: [],
      hostedScorers: [{ definitionId: 'scorer-1', versionId: 'scorer-version-1' }],
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: 'HOSTED_SCORER_EXECUTION_UNAVAILABLE',
          message: 'Hosted scorer execution is not available yet',
        },
        { status: 501 },
      ),
    );

    await runCli('api', 'experiment', 'platform', 'run', JSON.stringify(input));

    expect(stdout).toBe('');
    expect(JSON.parse(stderr)).toEqual({
      error: {
        code: 'HOSTED_SCORER_EXECUTION_UNAVAILABLE',
        message: 'Hosted scorer execution is not available yet',
        details: {
          status: 501,
          error: 'HOSTED_SCORER_EXECUTION_UNAVAILABLE',
          message: 'Hosted scorer execution is not available yet',
        },
      },
    });
    expect(process.exitCode).toBe(1);
  });

  it('preserves typed idempotency conflicts', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: 'IDEMPOTENCY_CONFLICT',
          message: 'The idempotency key was already used with a different request body',
        },
        { status: 409 },
      ),
    );

    await runCli('api', 'experiment', 'platform', 'run', JSON.stringify(validRunInput()));

    expect(JSON.parse(stderr).error).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      details: { status: 409, error: 'IDEMPOTENCY_CONFLICT' },
    });
    expect(process.exitCode).toBe(1);
  });

  it('rejects hosted and registry scorer combinations before submitting', async () => {
    const input = {
      ...validRunInput(),
      hostedScorers: [{ definitionId: 'scorer-1', versionId: 'scorer-version-1' }],
    };

    await runCli('api', 'experiment', 'platform', 'run', JSON.stringify(input));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(stderr).error).toMatchObject({
      code: 'INVALID_JSON',
      message: expect.stringContaining('hostedScorers cannot be combined'),
    });
    expect(process.exitCode).toBe(1);
  });

  it('refuses runtime server targeting flags', async () => {
    await runCli('api', '--url', 'http://localhost:4111', 'experiment', 'platform', 'dataset', 'list');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(stderr).error).toMatchObject({
      code: 'PLATFORM_RESOLUTION_FAILED',
      message: expect.stringContaining('authenticated Platform control plane'),
    });
  });

  it('polls run detail until a terminal status is returned', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ experimentId: 'experiment-123', status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ experimentId: 'experiment-123', status: 'completed' }));

    await runCli(
      'api',
      'experiment',
      'platform',
      'poll',
      'experiment-123',
      '--interval',
      '1',
      '--poll-timeout',
      '1000',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(stdout)).toEqual({ data: { experimentId: 'experiment-123', status: 'completed' } });
  });
});

async function runCli(...args: string[]): Promise<void> {
  const program = new Command();
  registerApiCommand(program);
  await program.parseAsync(['node', 'mastra', ...args]);
}

function validRunInput() {
  return {
    experimentId: 'experiment-123',
    environmentId: 'environment-123',
    datasetId: 'dataset-123',
    datasetVersionId: 'dataset-version-123',
    target: { type: 'agent' as const, id: 'evaluation-agent' },
    scorers: [{ id: 'quality-scorer', version: '1' }],
    limits: { concurrency: 2, timeoutMs: 30_000 },
    policies: { allowedToolIds: [], allowedNetworkHosts: [] },
    secretReferences: [],
    requestedAt: '2026-08-25T18:00:00.000Z',
    idempotencyKey: 'caller-key-123',
    workerBuildRowId: 'b2b8a695-e2a0-4974-b663-698731038d77',
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}
