import { join } from 'node:path';

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

    const outputDirectory = join('/project', '.mastra', 'experiment-worker');
    expect(mocks.prepare).toHaveBeenCalledWith(outputDirectory);
    expect(mocks.bundle).toHaveBeenCalledWith('/project/src/mastra/index.ts', outputDirectory, {
      toolsPaths: [],
      projectRoot: '/project',
    });
    expect(mocks.writeArtifactManifest).toHaveBeenCalledWith(outputDirectory, expect.any(String));
  });

  it('resolves a relative project root before bundling', async () => {
    const { buildExperimentWorker } = await import('./build');

    await buildExperimentWorker({ root: '.' });

    expect(mocks.bundle).toHaveBeenCalledWith(
      '/project/src/mastra/index.ts',
      join(process.cwd(), '.mastra', 'experiment-worker'),
      {
        toolsPaths: [],
        projectRoot: process.cwd(),
      },
    );
  });

  it('resolves a relative custom output directory from the project root', async () => {
    const { buildExperimentWorker } = await import('./build');

    await buildExperimentWorker({ root: '/project', outputDir: 'artifacts/worker' });

    expect(mocks.prepare).toHaveBeenCalledWith(join('/project', 'artifacts', 'worker'));
  });

  it.each([
    ['the project root', '.'],
    ['an ancestor of the Mastra source directory', 'src'],
    ['the Mastra source directory', join('src', 'mastra')],
  ])('rejects %s as the output directory before preparing it', async (_name, outputDir) => {
    const { buildExperimentWorker } = await import('./build');

    await buildExperimentWorker({ root: '/project', outputDir });

    expect(process.exitCode).toBe(1);
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining('Output directory must not be the project root'),
      expect.objectContaining({ stack: expect.any(String) }),
    );
    expect(mocks.prepare).not.toHaveBeenCalled();
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
