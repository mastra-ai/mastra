import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const roots: string[] = [];

/** A version-manager shim: its own directory, first on PATH, holding a link named after the tool. */
function shim(target: string, name = 'node'): string {
  const root = mkdtempSync(join(tmpdir(), 'mastracode-binaries-'));
  roots.push(root);
  const bin = join(root, 'bin');
  mkdirSync(bin);
  symlinkSync(target, join(bin, name));
  return bin;
}

function pathWith(bin: string): string {
  // Our own installation and the system directories, so the tools beyond `node` still resolve.
  return [bin, dirname(process.execPath), '/usr/bin', '/bin'].join(delimiter);
}

async function detectOn(path: string) {
  vi.stubEnv('PATH', path);
  vi.resetModules();
  const { detectCommonBinariesAsync } = await import('../binaries.js');
  return detectCommonBinariesAsync();
}

const nodePath = (binaries: Awaited<ReturnType<typeof detectOn>>) =>
  binaries.find(binary => binary.name === 'node')?.path;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('common binary paths', () => {
  it('names the installation, not the shell shim, so two launches agree', async () => {
    const installation = realpathSync(process.execPath);
    const first = await detectOn(pathWith(shim(installation)));
    const second = await detectOn(pathWith(shim(installation)));
    expect(nodePath(first)).toBe(installation);
    expect(nodePath(second)).toBe(installation);
  });

  it('follows a chain of links to the installation', async () => {
    const installation = realpathSync(process.execPath);
    const bin = shim(installation);
    const middle = join(bin, '..', 'node-current');
    symlinkSync(installation, middle);
    rmSync(join(bin, 'node'));
    symlinkSync(middle, join(bin, 'node'));
    expect(nodePath(await detectOn(pathWith(bin)))).toBe(installation);
  });

  it('resolves the same way through the synchronous entry point', () => {
    vi.stubEnv('PATH', pathWith(shim(realpathSync(process.execPath))));
    vi.resetModules();
    return import('../binaries.js').then(({ detectCommonBinaries }) => {
      expect(nodePath(detectCommonBinaries())).toBe(realpathSync(process.execPath));
    });
  });
});
