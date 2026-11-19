import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const roots: string[] = [];

/** A version-manager shim: its own directory, first on PATH, holding links named after the tools. */
function shim(links: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'mastracode-binaries-'));
  roots.push(root);
  const bin = join(root, 'bin');
  mkdirSync(bin);
  for (const [name, target] of Object.entries(links)) symlinkSync(target, join(bin, name));
  return bin;
}

/** An empty file standing in for a real executable, so links to it are not dangling. */
function executable(...segments: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'mastracode-install-'));
  roots.push(root);
  const file = join(root, ...segments);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, '');
  chmodSync(file, 0o755); // `which` skips a file it cannot execute
  return file;
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

const pathOf = (binaries: Awaited<ReturnType<typeof detectOn>>, name: string) =>
  binaries.find(binary => binary.name === name)?.path;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.resetModules();
});

// Creating links needs a privilege Windows CI does not have, and `where` reports its own layout; the
// behaviour under test is the POSIX shim.
describe.skipIf(process.platform === 'win32')('common binary paths', () => {
  it('names the installation, not the shell shim, so two launches agree', async () => {
    const installation = realpathSync(process.execPath);
    const first = await detectOn(pathWith(shim({ node: installation })));
    const second = await detectOn(pathWith(shim({ node: installation })));
    expect(pathOf(first, 'node')).toBe(installation);
    expect(pathOf(second, 'node')).toBe(installation);
  });

  it('follows a chain of links to the installation', async () => {
    const installation = realpathSync(process.execPath);
    const bin = shim({ node: installation });
    const middle = join(bin, '..', 'node-current');
    symlinkSync(installation, middle);
    rmSync(join(bin, 'node'));
    symlinkSync(middle, join(bin, 'node'));
    expect(pathOf(await detectOn(pathWith(bin)), 'node')).toBe(installation);
  });

  it('resolves the same way through the synchronous entry point', () => {
    vi.stubEnv('PATH', pathWith(shim({ node: realpathSync(process.execPath) })));
    vi.resetModules();
    return import('../binaries.js').then(({ detectCommonBinaries }) => {
      expect(pathOf(detectCommonBinaries(), 'node')).toBe(realpathSync(process.execPath));
    });
  });

  it('keeps what which reported when one binary answers for several tools', async () => {
    // A dispatcher manager such as mise links every tool name at one binary; resolving would name that
    // binary for each of them and the prompt would stop saying where each tool is.
    const dispatcher = executable('dispatcher');
    const bin = shim({ node: dispatcher, python3: dispatcher });
    const binaries = await detectOn(pathWith(bin));
    expect(pathOf(binaries, 'node')).toBe(join(bin, 'node'));
    expect(pathOf(binaries, 'python3')).toBe(join(bin, 'python3'));
  });

  it('still resolves two tools that live in one installation', async () => {
    // node and npm resolve to different files of one installation; that is not a dispatcher.
    const node = executable('bin', 'node');
    const npm = executable('lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
    const bin = shim({ node, npm });
    const binaries = await detectOn(pathWith(bin));
    expect(pathOf(binaries, 'node')).toBe(realpathSync(node));
    expect(pathOf(binaries, 'npm')).toBe(realpathSync(npm));
  });
});
