import { describe, it, expect, vi } from 'vitest';

import { resolveLegacyWorkersManifestOverride } from './workers-manifest-guard.js';

const OUTPUT_DIR = '/fake/.mastra/output';
const MANIFEST_PATH = `${OUTPUT_DIR}/workers.json`;

function inMemoryFs(initial: Record<string, string>) {
  const files: Record<string, string> = { ...initial };
  return {
    files,
    readFile: vi.fn(async (path: string) => {
      if (!(path in files)) throw new Error('ENOENT');
      return files[path]!;
    }),
  };
}

describe('resolveLegacyWorkersManifestOverride', () => {
  it('no manifest on disk → status "no-manifest", no override', async () => {
    const fs = inMemoryFs({});

    const result = await resolveLegacyWorkersManifestOverride(OUTPUT_DIR, fs);

    expect(result).toEqual({ status: 'no-manifest' });
  });

  it('manifest already null → status "already-null", no override', async () => {
    const fs = inMemoryFs({ [MANIFEST_PATH]: 'null' });

    const result = await resolveLegacyWorkersManifestOverride(OUTPUT_DIR, fs);

    expect(result).toEqual({ status: 'already-null' });
  });

  it('non-null manifest → ALWAYS stripped, regardless of any flag or account state', async () => {
    const originalManifest = JSON.stringify({ enabled: true, mode: 'full', globalConcurrency: 20 });
    const fs = inMemoryFs({ [MANIFEST_PATH]: originalManifest });

    const result = await resolveLegacyWorkersManifestOverride(OUTPUT_DIR, fs);

    expect(result).toEqual({ status: 'stripped', manifestOverride: 'null' });
    // The reusable build output on disk is never mutated — a later
    // `mastra deploy` of the same build keeps its workers.
    expect(fs.files[MANIFEST_PATH]).toBe(originalManifest);
  });

  it('versioned v1 manifest → stripped', async () => {
    const fs = inMemoryFs({
      [MANIFEST_PATH]: JSON.stringify({
        version: 1,
        orchestration: { enabled: true },
        scheduler: { enabled: true },
        backgroundTasks: { enabled: true },
        custom: [],
      }),
    });

    const result = await resolveLegacyWorkersManifestOverride(OUTPUT_DIR, fs);

    expect(result).toEqual({ status: 'stripped', manifestOverride: 'null' });
  });

  it('malformed manifest JSON → stripped (legacy artifacts must be inert no matter what)', async () => {
    const fs = inMemoryFs({ [MANIFEST_PATH]: 'not-json-at-all' });

    const result = await resolveLegacyWorkersManifestOverride(OUTPUT_DIR, fs);

    expect(result).toEqual({ status: 'stripped', manifestOverride: 'null' });
  });
});
