import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  bundle: vi.fn(),
  writeArtifactManifest: vi.fn(),
  setLogger: vi.fn(),
  getFirstExistingFile: vi.fn().mockReturnValue('/project/src/mastra/index.ts'),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../services/service.file', () => ({
  FileService: class {
    getFirstExistingFile = mocks.getFirstExistingFile;
  },
}));
vi.mock('../../utils/logger', () => ({ createLogger: () => ({ info: mocks.info, error: mocks.error }) }));
vi.mock('./ExperimentBundler', () => ({
  ExperimentBundler: class {
    __setLogger = mocks.setLogger;
    prepare = mocks.prepare;
    bundle = mocks.bundle;
    writeArtifactManifest = mocks.writeArtifactManifest;
  },
}));

describe('buildExperimentWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('builds into an isolated default artifact directory', async () => {
    const { buildExperimentWorker } = await import('./build');

    await buildExperimentWorker({ root: '/project' });

    expect(mocks.prepare).toHaveBeenCalledWith('/project/.mastra/experiment-worker');
    expect(mocks.bundle).toHaveBeenCalledWith('/project/src/mastra/index.ts', '/project/.mastra/experiment-worker', {
      toolsPaths: [],
      projectRoot: '/project',
    });
    expect(mocks.writeArtifactManifest).toHaveBeenCalledWith('/project/.mastra/experiment-worker', expect.any(String));
  });

  it('resolves a relative custom output directory from the project root', async () => {
    const { buildExperimentWorker } = await import('./build');

    await buildExperimentWorker({ root: '/project', outputDir: 'artifacts/worker' });

    expect(mocks.prepare).toHaveBeenCalledWith('/project/artifacts/worker');
  });

  it('reports build failures without emitting a partial success message', async () => {
    mocks.bundle.mockRejectedValueOnce(new Error('bundle exploded'));
    const { buildExperimentWorker } = await import('./build');

    await buildExperimentWorker({ root: '/project' });

    expect(process.exitCode).toBe(1);
    expect(mocks.error).toHaveBeenCalledWith(
      'Experiment worker build failed: bundle exploded',
      expect.objectContaining({ stack: expect.any(String) }),
    );
    expect(mocks.writeArtifactManifest).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });
});
