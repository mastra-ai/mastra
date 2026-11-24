import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const roots: string[] = [];

/** A directory of tool names, first on PATH, where each name is a link to `target`. */
function linkDir(links: Record<string, string>, prefix = 'mastracode-shims-'): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  const bin = join(root, 'bin');
  mkdirSync(bin);
  for (const [name, target] of Object.entries(links)) symlinkSync(target, join(bin, name));
  return bin;
}

/**
 * The `fnm` shape: a per-shell directory whose `bin` is a link to the installation's, so only the name of
 * the per-shell part changes on every launch.
 */
function multishell(installationBin: string): string {
  const root = mkdtempSync(join(tmpdir(), 'mastracode-multishell-'));
  roots.push(root);
  symlinkSync(installationBin, join(root, 'bin'));
  return join(root, 'bin');
}

/** A file standing in for a real executable, so links to it are not dangling. */
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

/** A tool name in a directory, as the filesystem really spells that directory (`/var` is a link). */
const at = (dir: string, name: string): string => join(realpathSync(dir), name);

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
  it('names the installation, not the per-shell directory, so two launches agree', async () => {
    const installationBin = dirname(executable('bin', 'node'));
    const first = await detectOn(pathWith(multishell(installationBin)));
    const second = await detectOn(pathWith(multishell(installationBin)));
    expect(pathOf(first, 'node')).toBe(at(installationBin, 'node'));
    expect(pathOf(second, 'node')).toBe(at(installationBin, 'node'));
  });

  it('follows a chain of links to the installation', async () => {
    const installationBin = dirname(executable('bin', 'node'));
    const middle = mkdtempSync(join(tmpdir(), 'mastracode-middle-'));
    roots.push(middle);
    symlinkSync(installationBin, join(middle, 'bin'));
    const shell = mkdtempSync(join(tmpdir(), 'mastracode-shell-'));
    roots.push(shell);
    symlinkSync(join(middle, 'bin'), join(shell, 'bin'));
    expect(pathOf(await detectOn(pathWith(join(shell, 'bin'))), 'node')).toBe(at(installationBin, 'node'));
  });

  it('resolves the same way through the synchronous entry point', () => {
    const installationBin = dirname(executable('bin', 'node'));
    vi.stubEnv('PATH', pathWith(multishell(installationBin)));
    vi.resetModules();
    return import('../binaries.js').then(({ detectCommonBinaries }) => {
      expect(pathOf(detectCommonBinaries(), 'node')).toBe(at(installationBin, 'node'));
    });
  });

  it('keeps a shim that runs the tool instead of the program behind it', async () => {
    // `mise` links every shim at itself, BusyBox and OrbStack do it for some tools: running that program
    // is not running the tool, so the name on PATH is the one to show.
    const dispatcher = executable('mise', 'bin', 'mise');
    const bin = linkDir({ node: dispatcher });
    expect(pathOf(await detectOn(pathWith(bin)), 'node')).toBe(at(bin, 'node'));
  });

  it('keeps what which reported when one binary answers for several tools', async () => {
    const dispatcher = executable('busybox');
    const bin = linkDir({ wget: dispatcher, docker: dispatcher });
    const binaries = await detectOn(pathWith(bin));
    expect(pathOf(binaries, 'wget')).toBe(at(bin, 'wget'));
    expect(pathOf(binaries, 'docker')).toBe(at(bin, 'docker'));
  });

  it('keeps the stable link directory rather than a versioned install path', async () => {
    // Homebrew points bin/node into Cellar/node/<version>/bin/node; the version changes on every upgrade.
    const cellar = executable('Cellar', 'node', '25.0.0', 'bin', 'node');
    const bin = linkDir({ node: cellar }, 'mastracode-homebrew-');
    expect(pathOf(await detectOn(pathWith(bin)), 'node')).toBe(at(bin, 'node'));
  });

  it('names each tool where it lives when two live in one installation', async () => {
    // node and npm are two files of one installation; neither name may be rewritten to the other.
    const node = executable('bin', 'node');
    const npm = executable('lib', 'npm');
    const binaries = await detectOn(
      [dirname(node), dirname(npm), dirname(process.execPath), '/usr/bin', '/bin'].join(delimiter),
    );
    expect(pathOf(binaries, 'node')).toBe(at(dirname(node), 'node'));
    expect(pathOf(binaries, 'npm')).toBe(at(dirname(npm), 'npm'));
  });
});
