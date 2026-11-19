import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const roots: string[] = [];

/** A version-manager style shim: its own directory, first on PATH, holding a link named after the tool. */
function shim(target: string, name = 'node'): string {
  const root = mkdtempSync(join(tmpdir(), 'mastracode-binaries-'));
  roots.push(root);
  const bin = join(root, 'bin');
  mkdirSync(bin);
  symlinkSync(target, join(bin, name));
  return bin;
}

async function detectOn(path: string) {
  vi.stubEnv('PATH', path);
  vi.resetModules();
  const { detectCommonBinariesAsync } = await import('../binaries.ts');
  return detectCommonBinariesAsync();
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('common binary paths', () => {
  it('names the installation, not the shell shim, so two launches agree', async () => {
    const target = realpathSync(execFileSync('/usr/bin/which', ['node'], { encoding: 'utf8' }).trim());
    const first = await detectOn(`${shim(target)}:/usr/bin:/bin`);
    const second = await detectOn(`${shim(target)}:/usr/bin:/bin`);
    const path = (binaries: Awaited<ReturnType<typeof detectOn>>) =>
      binaries.find(binary => binary.name === 'node')?.path;
    expect(path(first)).toBe(target);
    expect(path(second)).toBe(target);
  });

  it('follows a chain of links to the installation', async () => {
    const target = realpathSync(execFileSync('/usr/bin/which', ['node'], { encoding: 'utf8' }).trim());
    const bin = shim(target);
    const middle = join(bin, '..', 'node-current');
    symlinkSync(target, middle);
    rmSync(join(bin, 'node'));
    symlinkSync(middle, join(bin, 'node'));
    const binaries = await detectOn(`${bin}:/usr/bin:/bin`);
    expect(binaries.find(binary => binary.name === 'node')?.path).toBe(target);
  });
});
