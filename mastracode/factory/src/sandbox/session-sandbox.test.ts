import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { setupMarkerContent } from '@internal/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { LocalSandbox } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __clearSessionSandboxesForTests,
  createEnvironmentSetupHook,
  createSessionSetupHook,
  evictSessionSandbox,
  getSessionSandbox,
  peekSessionSandbox,
  resolveSessionWorkdir,
} from './session-sandbox.js';
import type { SessionEnvironmentGate, SessionSetupGate } from './session-sandbox.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
});

describe('session sandbox memo', () => {
  const construct = (id: string) => ({ id, provider: 'test' }) as unknown as WorkspaceSandbox;

  it('constructs once per session id and returns the memoized entry', () => {
    const factory = vi.fn(() => construct('sb-1'));
    const first = getSessionSandbox('sess-1', 'acme/api', factory);
    const second = getSessionSandbox('sess-1', 'acme/api', factory);
    expect(second).toBe(first);
    // Remote workdirs are a runtime fact of the VM — unresolved until start.
    expect(first.workdir).toBeUndefined();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('keeps sessions independent', () => {
    const a = getSessionSandbox('sess-a', 'acme/api', () => construct('sb-a'));
    const b = getSessionSandbox('sess-b', 'acme/api', () => construct('sb-b'));
    expect(a.sandbox).not.toBe(b.sandbox);
  });

  it('peek never constructs', () => {
    expect(peekSessionSandbox('sess-1')).toBeUndefined();
    const made = getSessionSandbox('sess-1', 'acme/api', () => construct('sb-1'));
    expect(peekSessionSandbox('sess-1')?.sandbox).toBe(made.sandbox);
    expect(peekSessionSandbox('sess-1')?.workdir).toBeUndefined();
  });

  it('resolves a remote workdir from the live VM home and memoizes it on the entry', async () => {
    const executeCommand = vi.fn(async () => ({ exitCode: 0, stdout: '/home/user\n', stderr: '' }));
    const sandbox = { id: 'sb-1', provider: 'e2b', executeCommand } as unknown as WorkspaceSandbox;
    const entry = getSessionSandbox('sess-1', 'acme/api', () => sandbox);
    expect(entry.workdir).toBeUndefined();

    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/home/user/api');
    expect(peekSessionSandbox('sess-1')?.workdir).toBe('/home/user/api');

    // Memoized: the second resolution never probes again.
    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/home/user/api');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith('pwd');
  });

  it('uses a remote sandbox declared workingDirectory without probing', async () => {
    const executeCommand = vi.fn(async () => ({ exitCode: 0, stdout: '/home/user\n', stderr: '' }));
    const sandbox = {
      id: 'sb-1',
      provider: 'e2b',
      workingDirectory: '/workspace',
      executeCommand,
    } as unknown as WorkspaceSandbox;
    getSessionSandbox('sess-1', 'acme/api', () => sandbox);

    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/workspace/api');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('falls back to the probe when a remote workingDirectory is not absolute', async () => {
    const executeCommand = vi.fn(async () => ({ exitCode: 0, stdout: '/home/user\n', stderr: '' }));
    const sandbox = {
      id: 'sb-1',
      provider: 'e2b',
      workingDirectory: '~/repos',
      executeCommand,
    } as unknown as WorkspaceSandbox;
    getSessionSandbox('sess-1', 'acme/api', () => sandbox);

    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/home/user/api');
    expect(executeCommand).toHaveBeenCalledWith('pwd');
  });

  it('rejects a failed home probe without memoizing', async () => {
    const executeCommand = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'no shell' })
      .mockResolvedValue({ exitCode: 0, stdout: '/home/user\n', stderr: '' });
    const sandbox = { id: 'sb-1', provider: 'e2b', executeCommand } as unknown as WorkspaceSandbox;
    getSessionSandbox('sess-1', 'acme/api', () => sandbox);

    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).rejects.toThrow(/default cwd probe failed/);
    expect(peekSessionSandbox('sess-1')?.workdir).toBeUndefined();
    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/home/user/api');
  });

  it('resolves a local workdir synchronously at construction', async () => {
    const local = { id: 'sb-l', provider: 'local', workingDirectory: '/srv/sess-1' } as unknown as WorkspaceSandbox;
    const entry = getSessionSandbox('sess-l', 'acme/api', () => local);
    expect(entry.workdir).toBe(path.resolve('/srv/sess-1', 'api'));
    // Resolution answers from the memo without any probe.
    await expect(resolveSessionWorkdir('sess-l', local, 'acme/api')).resolves.toBe(entry.workdir);
  });

  it('evict drops the instance so the next access reconstructs', () => {
    const first = getSessionSandbox('sess-1', 'acme/api', () => construct('sb-1'));
    evictSessionSandbox('sess-1');
    const second = getSessionSandbox('sess-1', 'acme/api', () => construct('sb-2'));
    expect(second.sandbox).not.toBe(first.sandbox);
  });

  it('does not memoize when construction throws', () => {
    expect(() =>
      getSessionSandbox('sess-1', 'acme/api', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(peekSessionSandbox('sess-1')).toBeUndefined();
  });
});

describe('session setup hook', () => {
  let dir: string;
  const SETUP = 'pnpm install';
  const digest = () => setupMarkerContent(SETUP);

  /** A run that materializes a fake checkout and, when the gate says so, "runs setup". */
  const runWith = (setupTouch: string) => async (sb: WorkspaceSandbox, _workdir: string, gate: SessionSetupGate) => {
    await sb.executeCommand!('mkdir -p repo/.git && touch materialized.txt');
    if (gate.setupDone) return;
    await sb.executeCommand!(`touch ${setupTouch}`);
    await gate.markSetupDone();
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-bootstrap-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('runs setup inside start() on a fresh sandbox and writes the digest marker', async () => {
    const boot = path.join(dir, 'fresh');
    const sandbox = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('setup-ran.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await sandbox._start();
    await expect(fs.stat(path.join(boot, 'setup-ran.txt'))).resolves.toBeDefined();
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/setup'), 'utf8')).resolves.toBe(digest());
  });

  it('a fresh sandbox that already carries the marker (warm template image) skips setup but still materializes', async () => {
    const boot = path.join(dir, 'warm');
    // What a repo template leaves behind: marker beside a checkout.
    await fs.mkdir(path.join(boot, 'repo/.git'), { recursive: true });
    await fs.mkdir(path.join(boot, '.mastra-factory'), { recursive: true });
    await fs.mkdir(path.join(boot, '.mastra-sandbox'));
    await fs.writeFile(path.join(boot, '.mastra-sandbox/setup'), digest());

    const sandbox = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('setup-ran.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await sandbox._start();
    await expect(fs.stat(path.join(boot, 'materialized.txt'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(boot, 'setup-ran.txt'))).rejects.toThrow();
  });

  it('the hook skips setup on reconnect when the marker matches and the checkout exists', async () => {
    const boot = path.join(dir, 'reconnect');
    const first = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('first.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await first._start();

    const second = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('second.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await second._start();
    await expect(fs.stat(path.join(boot, 'second.txt'))).rejects.toThrow();
  });

  it('an edited setup command (or a legacy touch-only marker) re-runs setup and rewrites the marker', async () => {
    const boot = path.join(dir, 'edited');
    await fs.mkdir(path.join(boot, 'repo/.git'), { recursive: true });
    await fs.mkdir(path.join(boot, '.mastra-factory'), { recursive: true });
    await fs.mkdir(path.join(boot, '.mastra-sandbox'));
    await fs.writeFile(path.join(boot, '.mastra-sandbox/setup'), '');

    const legacy = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('legacy-rerun.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await legacy._start();
    await expect(fs.stat(path.join(boot, 'legacy-rerun.txt'))).resolves.toBeDefined();
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/setup'), 'utf8')).resolves.toBe(digest());

    const edited = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('edited-rerun.txt'), 'sess-hook', 'acme/repo', 'pnpm ci'),
    });
    await edited._start();
    await expect(fs.stat(path.join(boot, 'edited-rerun.txt'))).resolves.toBeDefined();
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/setup'), 'utf8')).resolves.toBe(
      setupMarkerContent('pnpm ci'),
    );
  });

  it('a marker without its checkout does not skip setup (removed checkout heals)', async () => {
    const boot = path.join(dir, 'wiped');
    const first = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('first.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await first._start();

    // The checkout is removed but the marker (beside it) survives: a stale
    // skip cache must not defeat disk truth.
    await fs.rm(path.join(boot, 'repo'), { recursive: true, force: true });
    const second = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('rebuilt.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await second._start();
    await expect(fs.stat(path.join(boot, 'rebuilt.txt'))).resolves.toBeDefined();
  });

  it('with no setup command the gate reports done and nothing is written', async () => {
    const boot = path.join(dir, 'none');
    const gates: SessionSetupGate[] = [];
    const sandbox = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async (_sb, _workdir, gate) => void gates.push(gate),
        'sess-hook',
        'acme/repo',
        undefined,
      ),
    });
    await sandbox._start();
    expect(gates[0]?.setupDone).toBe(true);
    await gates[0]!.markSetupDone();
    await expect(fs.stat(path.join(boot, '.mastra-sandbox/setup'))).rejects.toThrow();
  });

  it('a failed setup fails start() loudly, writes no marker, and the next start self-heals', async () => {
    const boot = path.join(dir, 'fail');
    const failing = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async () => {
          throw new Error('Session setup failed (exit 7)');
        },
        'sess-hook',
        'acme/repo',
        SETUP,
      ),
    });

    await expect(failing._start()).rejects.toThrow(/Session setup failed \(exit 7\)/);
    await expect(fs.stat(path.join(boot, '.mastra-sandbox/setup'))).rejects.toThrow();

    const healed = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(runWith('healed.txt'), 'sess-hook', 'acme/repo', SETUP),
    });
    await healed._start();
    await expect(fs.stat(path.join(boot, 'healed.txt'))).resolves.toBeDefined();
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/setup'), 'utf8')).resolves.toBe(digest());
  });
});

describe('environment setup hook', () => {
  let dir: string;
  const API = 'pnpm install';
  const DOCS = 'npm ci';
  const WORKSPACE = 'touch .workspace-ready';
  const repos = [
    { slug: 'acme/api', setupCommand: API },
    { slug: 'acme/docs', setupCommand: DOCS },
  ];

  /** A run that records, per repository, whether setup ran, and runs setup inside that repo's dir. */
  const runWith = (log: string[]) => async (sb: WorkspaceSandbox, env: SessionEnvironmentGate) => {
    for (const repo of env.repos) {
      await sb.executeCommand!(`mkdir -p "${repo.dir}/.git"`);
      if (repo.gate.setupDone) continue;
      log.push(repo.slug);
      await sb.executeCommand!(`cd "${repo.dir}" && touch setup-ran.txt`);
      await repo.gate.markSetupDone();
    }
    if (!env.workspace.setupDone) {
      log.push('workspace');
      await sb.executeCommand!(`cd "${env.root}" && touch workspace-ran.txt`);
      await env.workspace.markSetupDone();
    }
  };

  const hook = (log: string[], workspaceSetupCommand: string | undefined = WORKSPACE) =>
    createEnvironmentSetupHook(runWith(log), 'sess-env', 'acme/api', { repos, workspaceSetupCommand });

  /** What a multi-repo template leaves behind for one repository. */
  const plantRepo = async (root: string, repoDir: string, command: string) => {
    await fs.mkdir(path.join(root, repoDir, '.git'), { recursive: true });
    await fs.mkdir(path.join(root, '.mastra-sandbox/repos'), { recursive: true });
    await fs.writeFile(path.join(root, '.mastra-sandbox/repos', repoDir), setupMarkerContent(command));
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-environment-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('runs every setup on a fresh sandbox, inside each repo dir, and writes the per-repo and workspace markers', async () => {
    const boot = path.join(dir, 'fresh');
    const log: string[] = [];
    const sandbox = new LocalSandbox({ workingDirectory: boot, onStart: hook(log) });
    await sandbox._start();
    expect(log).toEqual(['acme/api', 'acme/docs', 'workspace']);
    await expect(fs.stat(path.join(boot, 'api/setup-ran.txt'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(boot, 'docs/setup-ran.txt'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(boot, 'workspace-ran.txt'))).resolves.toBeDefined();
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/repos/api'), 'utf8')).resolves.toBe(
      setupMarkerContent(API),
    );
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/repos/docs'), 'utf8')).resolves.toBe(
      setupMarkerContent(DOCS),
    );
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/workspace-setup'), 'utf8')).resolves.toBe(
      setupMarkerContent(WORKSPACE),
    );
    // The primary repo dir is what resolveSessionWorkdir answers, and the
    // root the hook derived is its parent: the same directory the markers sit in.
    await expect(resolveSessionWorkdir('sess-env', sandbox, 'acme/api')).resolves.toBe(path.join(boot, 'api'));
  });

  it('skips a repo whose template marker matches and runs the one whose marker mismatches', async () => {
    const boot = path.join(dir, 'warm');
    await plantRepo(boot, 'api', API);
    await plantRepo(boot, 'docs', 'an older docs command');
    await fs.writeFile(path.join(boot, '.mastra-sandbox/workspace-setup'), setupMarkerContent(WORKSPACE));
    const log: string[] = [];
    await new LocalSandbox({ workingDirectory: boot, onStart: hook(log) })._start();
    expect(log).toEqual(['acme/docs']);
    await expect(fs.stat(path.join(boot, 'api/setup-ran.txt'))).rejects.toThrow();
    await expect(fs.stat(path.join(boot, 'docs/setup-ran.txt'))).resolves.toBeDefined();
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/repos/docs'), 'utf8')).resolves.toBe(
      setupMarkerContent(DOCS),
    );
  });

  it('runs a repo listed in setup-failed even when its marker matches, and clears it on success', async () => {
    const boot = path.join(dir, 'failed');
    await plantRepo(boot, 'api', API);
    await plantRepo(boot, 'docs', DOCS);
    await fs.writeFile(path.join(boot, '.mastra-sandbox/workspace-setup'), setupMarkerContent(WORKSPACE));
    await fs.writeFile(path.join(boot, '.mastra-sandbox/setup-failed'), 'docs\n');
    const log: string[] = [];
    await new LocalSandbox({ workingDirectory: boot, onStart: hook(log) })._start();
    expect(log).toEqual(['acme/docs']);
    await expect(fs.readFile(path.join(boot, '.mastra-sandbox/setup-failed'), 'utf8')).resolves.toBe('');

    const again: string[] = [];
    await new LocalSandbox({ workingDirectory: boot, onStart: hook(again) })._start();
    expect(again).toEqual([]);
  });

  it('a missing checkout reads as not done even when the marker matches', async () => {
    const boot = path.join(dir, 'wiped');
    await plantRepo(boot, 'api', API);
    await plantRepo(boot, 'docs', DOCS);
    await fs.rm(path.join(boot, 'docs'), { recursive: true });
    await fs.writeFile(path.join(boot, '.mastra-sandbox/workspace-setup'), setupMarkerContent(WORKSPACE));
    const log: string[] = [];
    await new LocalSandbox({ workingDirectory: boot, onStart: hook(log) })._start();
    expect(log).toEqual(['acme/docs']);
  });

  it('a repo without a setup command and an absent workspace command have nothing to gate', async () => {
    const boot = path.join(dir, 'bare');
    const log: string[] = [];
    const onStart = createEnvironmentSetupHook(runWith(log), 'sess-env', 'acme/api', {
      repos: [{ slug: 'acme/api' }, { slug: 'acme/docs', setupCommand: DOCS }],
    });
    await new LocalSandbox({ workingDirectory: boot, onStart })._start();
    expect(log).toEqual(['acme/docs']);
    await expect(fs.stat(path.join(boot, '.mastra-sandbox/repos/api'))).rejects.toThrow();
    await expect(fs.stat(path.join(boot, '.mastra-sandbox/workspace-setup'))).rejects.toThrow();
  });
});
