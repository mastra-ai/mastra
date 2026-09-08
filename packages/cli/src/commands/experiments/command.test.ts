import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerExperimentsCommand } from './command.js';

const fetchMock = vi.fn();
let stdout = '';
let stderr = '';

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('MASTRA_API_TOKEN', 'platform-token');
  vi.stubEnv('MASTRA_PROJECT_ID', 'project-123');
  vi.stubEnv('MASTRA_ORG_ID', 'org-123');
  vi.stubEnv('MASTRA_PLATFORM_API_URL', 'https://platform.example.test');
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
  it('registers the supported top-level command surface without local preview', () => {
    const program = new Command();
    registerExperimentsCommand(program);

    const experiments = program.commands.find(command => command.name() === 'experiments');
    expect(experiments?.commands.map(command => command.name())).toEqual([
      'list',
      'get',
      'run',
      'poll',
      'results',
      'datasets',
      'scorers',
    ]);
    expect(
      experiments?.commands.find(command => command.name() === 'datasets')?.commands.map(command => command.name()),
    ).toEqual(['list', 'versions']);
    expect(
      experiments?.commands.find(command => command.name() === 'scorers')?.commands.map(command => command.name()),
    ).toEqual(['list', 'versions']);
    expect(experiments?.commands.some(command => command.name() === 'preview')).toBe(false);
  });

  it('uses the authenticated project-scoped control plane for hosted dataset discovery', async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'platform-access-token');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        datasets: [{ datasetId: 'dataset-1', name: 'Evaluation set', description: 'Published evaluation data' }],
        pagination: { page: 1, perPage: 25, total: 1, hasMore: false },
      }),
    );

    await runCli('experiments', 'datasets', 'list', '{"page":1,"perPage":25}');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://platform.example.test/v1/projects/project-123/experiments/assets/datasets?page=1&perPage=25',
    );
    expect(init).toMatchObject({
      method: 'GET',
      headers: {
        Authorization: 'Bearer platform-access-token',
        'x-organization-id': 'org-123',
      },
    });
    expect(JSON.parse(stdout)).toEqual({
      data: [{ datasetId: 'dataset-1', name: 'Evaluation set', description: 'Published evaluation data' }],
      page: { total: 1, page: 1, perPage: 25, hasMore: false },
    });
    expect(stderr).toBe('');
  });

  it('uses the metadata-only hosted dataset version schema from the Platform API', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        versions: [
          {
            datasetId: 'dataset-1',
            datasetVersionId: 'dataset-version-1',
            version: 1,
            itemCount: 12,
            digest: 'a'.repeat(64),
            canonicalizationVersion: '1',
          },
        ],
        pagination: { page: 1, perPage: 25, total: 1, hasMore: false },
      }),
    );

    await runCli('experiments', 'datasets', 'versions', 'dataset-1');

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://platform.example.test/v1/projects/project-123/experiments/assets/datasets/dataset-1/versions',
    );
    expect(JSON.parse(stdout)).toEqual({
      data: [
        {
          datasetId: 'dataset-1',
          datasetVersionId: 'dataset-version-1',
          version: 1,
          itemCount: 12,
          digest: 'a'.repeat(64),
          canonicalizationVersion: '1',
        },
      ],
      page: { page: 1, perPage: 25, total: 1, hasMore: false },
    });
  });

  it('uses the metadata-only hosted scorer version schema from the Platform API', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        versions: [
          {
            definitionId: 'scorer-1',
            versionId: 'scorer-version-1',
            versionNumber: 1,
            name: 'Quality scorer',
            description: 'Scores answer quality',
          },
        ],
        pagination: { page: 1, perPage: 25, total: 1, hasMore: false },
      }),
    );

    await runCli('experiments', 'scorers', 'versions', 'scorer-1');

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://platform.example.test/v1/projects/project-123/experiments/assets/scorers/scorer-1/versions',
    );
    expect(JSON.parse(stdout)).toEqual({
      data: [
        {
          definitionId: 'scorer-1',
          versionId: 'scorer-version-1',
          versionNumber: 1,
          name: 'Quality scorer',
          description: 'Scores answer quality',
        },
      ],
      page: { page: 1, perPage: 25, total: 1, hasMore: false },
    });
  });

  it('validates and normalizes experiment list responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ experiments: [validExperimentListItem('running')], page: 0, perPage: 20, hasMore: false }),
    );

    await runCli('experiments', 'list');

    expect(JSON.parse(stdout)).toEqual({
      data: [validExperimentListItem('running')],
      page: { page: 0, perPage: 20, hasMore: false, total: 1 },
    });
  });

  it('validates and normalizes experiment result responses', async () => {
    const item = {
      itemId: 'item-1',
      itemIndex: 0,
      status: 'succeeded',
      output: { answer: 'ok' },
      retryCount: 0,
      sequence: 0,
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        experimentId: 'experiment-123',
        attempt: 1,
        status: 'completed',
        totalItems: 1,
        datasetItemCount: 1,
        items: [item],
        page: 0,
        perPage: 20,
        hasMore: false,
        studioUrl: 'https://mastra.ai/orgs/org-123/projects/project-123/experiments/runs/experiment-123',
      }),
    );

    await runCli('experiments', 'results', 'experiment-123');

    expect(JSON.parse(stdout)).toEqual({
      data: [item],
      page: { page: 0, perPage: 20, hasMore: false, total: 1 },
    });
  });

  it('validates hosted scorer list responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        scorers: [{ definitionId: 'scorer-1', name: 'Quality scorer' }],
        pagination: { page: 1, perPage: 25, total: 1, hasMore: false },
      }),
    );

    await runCli('experiments', 'scorers', 'list');

    expect(JSON.parse(stdout)).toEqual({
      data: [{ definitionId: 'scorer-1', name: 'Quality scorer' }],
      page: { page: 1, perPage: 25, total: 1, hasMore: false },
    });
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

    await runCli('experiments', 'run', JSON.stringify(input));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://platform.example.test/v1/projects/project-123/experiments/runs');
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

    await runCli('experiments', 'run', JSON.stringify(input));

    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    await runCli('experiments', 'run', JSON.stringify(validRunInput()));

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

    await runCli('experiments', 'run', JSON.stringify(input));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(stderr).error).toMatchObject({
      code: 'INVALID_JSON',
      message: expect.stringContaining('hostedScorers cannot be combined'),
    });
    expect(process.exitCode).toBe(1);
  });

  it.each(['HOSTED_SCORER_NOT_FOUND', 'EXPERIMENT_ASSET_NOT_FOUND'])('preserves typed %s errors', async errorCode => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: errorCode,
          message: 'The requested hosted experiment asset was not found',
        },
        { status: 404 },
      ),
    );
    const input = {
      ...validRunInput(),
      scorers: [],
      hostedScorers: [{ definitionId: 'scorer-1', versionId: 'scorer-version-1' }],
    };

    await runCli('experiments', 'run', JSON.stringify(input));

    expect(JSON.parse(stderr).error).toMatchObject({
      code: errorCode,
      details: { status: 404, error: errorCode },
    });
    expect(process.exitCode).toBe(1);
  });

  it.each([
    ['dataset list', ['experiments', 'datasets', 'list'], '/assets/datasets'],
    [
      'dataset version list',
      ['experiments', 'datasets', 'versions', 'dataset-1'],
      '/assets/datasets/dataset-1/versions',
    ],
    ['scorer list', ['experiments', 'scorers', 'list'], '/assets/scorers'],
    ['scorer version list', ['experiments', 'scorers', 'versions', 'scorer-1'], '/assets/scorers/scorer-1/versions'],
    ['experiment list', ['experiments', 'list'], ''],
    ['experiment detail', ['experiments', 'get', 'experiment-123'], '/experiment-123'],
    ['experiment results', ['experiments', 'results', 'experiment-123'], '/experiment-123/results'],
    ['experiment admission', ['experiments', 'run', JSON.stringify(validRunInput())], '/runs'],
  ])('rejects malformed successful %s responses', async (_name, args, path) => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ unexpected: 'sensitive-body-value' }, { status: path === '/runs' ? 202 : 200 }),
    );

    await runCli(...args);

    expect(stdout).toBe('');
    expect(JSON.parse(stderr).error).toEqual({
      code: 'PLATFORM_INVALID_RESPONSE',
      message: expect.stringContaining(`Platform returned an invalid response`),
      details: {
        method: path === '/runs' ? 'POST' : 'GET',
        path,
        status: path === '/runs' ? 202 : 200,
        validation: 'response contains unrecognized field unexpected',
      },
    });
    expect(stderr).not.toContain('sensitive-body-value');
    expect(process.exitCode).toBe(1);
  });

  it.each(['completed', 'completed-with-errors', 'failed', 'cancelled', 'timed-out'])(
    'polls run detail until the %s terminal status is returned',
    async status => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(validExperimentDetail('running')))
        .mockResolvedValueOnce(jsonResponse(validExperimentDetail(status)));

      await runCli('experiments', 'poll', 'experiment-123', '--interval', '1', '--poll-timeout', '1000');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(stdout).data).toMatchObject({ experimentId: 'experiment-123', status });
    },
  );
});

async function runCli(...args: string[]): Promise<void> {
  const program = new Command();
  registerExperimentsCommand(program);
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

function validExperimentListItem(status: string) {
  return {
    experimentId: 'experiment-123',
    jobId: 'job-123',
    attempt: 1,
    status,
    provenance: {
      environmentId: 'environment-123',
      environmentDeployId: 'deploy-123',
      buildId: 'build-123',
      gitSha: 'a'.repeat(40),
      targetType: 'agent',
      targetId: 'evaluation-agent',
      datasetId: 'dataset-123',
      datasetVersion: 7,
      datasetItemCount: 12,
      datasetDigest: 'a'.repeat(64),
    },
    createdAt: '2026-08-26T10:00:00.000Z',
    updatedAt: '2026-08-26T10:01:00.000Z',
    studioUrl: 'https://mastra.ai/orgs/org-123/projects/project-123/experiments/runs/experiment-123',
  };
}

function validExperimentDetail(status: string) {
  return {
    ...validExperimentListItem(status),
    capability: { state: 'available' },
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}
