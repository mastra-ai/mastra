// Keeps every core test away from the real provider registry files.
//
// Registry/gateway tests used to sync into the real packages/core/dist registry (leaving it with
// 0 providers) and into the user's ~/.cache/mastra, which every Mastra project on the machine reads
// in dev mode. Two layers stop that from coming back:
//
// 1. HOME (USERPROFILE on Windows) points at a per-worker throwaway dir, so os.homedir() and with it the
//    registry cache resolve away from the real ~/.cache/mastra. This prevents rather than detects:
//    the real cache is shared with other Mastra processes (mastra dev, Mastra Code) that refresh it
//    on their own schedule, so watching it would fail unrelated tests whenever one of them does.
// 2. The registry files inside this package are watched with lstat (mtime, size, inode), and the
//    test (or file) during which one changes fails. A write that is restored afterwards still fails.
//    Checks run after the file's own afterEach/afterAll hooks. A write from a background sync that
//    outlives its test is reported by whichever test in this worker observes it next.
//
// Tests that exercise the registry writer must point it at a temp package root; see the fixture at
// the top of src/llm/model/provider-registry.test.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach } from 'vitest';

type GuardState = {
  lstatSync: typeof fs.lstatSync;
  readdirSync: typeof fs.readdirSync;
  baseline?: Map<string, string>;
};

// Once per worker, before any test can mock fs or change the environment.
const g = globalThis as { __mastraRegistryFileGuard?: GuardState };
const state = (g.__mastraRegistryFileGuard ??= ((): GuardState => {
  // Not under os.tmpdir(): the seatbelt sandbox allows writes to temp dirs, and its tests expect
  // writes to the home directory to be blocked. The per-run parent dir comes from
  // vitest.registry-guard-global.ts, which also removes it.
  const homesDir = process.env.MASTRA_CORE_TEST_HOMES_DIR;
  if (!homesDir)
    throw new Error('MASTRA_CORE_TEST_HOMES_DIR is unset; run core tests via packages/core/vitest.config.ts');
  const home = fs.mkdtempSync(path.join(homesDir, 'home-'));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return { lstatSync: fs.lstatSync, readdirSync: fs.readdirSync };
})());

const core = __dirname;
const capabilityDirs = [
  path.join(core, 'dist', 'capabilities'),
  path.join(core, 'src', 'llm', 'model', 'capabilities'),
];
const watched = [
  path.join(core, 'dist'),
  path.join(core, 'dist', 'provider-registry.json'),
  path.join(core, 'dist', 'llm', 'model'),
  path.join(core, 'dist', 'llm', 'model', 'provider-types.generated.d.ts'),
  path.join(core, 'src', 'llm', 'model', 'provider-registry.json'),
  path.join(core, 'src', 'llm', 'model', 'provider-types.generated.d.ts'),
  ...capabilityDirs,
];

function statOf(p: string): string {
  try {
    const s = state.lstatSync(p);
    return `${s.isDirectory() ? 'dir' : 'file'} mtime=${s.mtimeMs} size=${s.size} ino=${s.ino}`;
  } catch {
    return 'missing';
  }
}

function snapshot(): Map<string, string> {
  // Capability files are listed individually: overwriting one in place does not change its directory's lstat.
  const capabilityFiles = capabilityDirs.flatMap(dir => {
    try {
      return state.readdirSync(dir).map(name => path.join(dir, name));
    } catch {
      return [];
    }
  });
  return new Map([...watched, ...capabilityFiles].map(p => [p, statOf(p)]));
}

state.baseline ??= snapshot();

function check(when: string) {
  const current = snapshot();
  const changed = [...new Set([...state.baseline!.keys(), ...current.keys()])].filter(
    p => (current.get(p) ?? 'missing') !== (state.baseline!.get(p) ?? 'missing'),
  );
  if (changed.length === 0) return;
  const details = changed.map(
    p => `  ${p}\n    before: ${state.baseline!.get(p) ?? 'missing'}\n    after:  ${current.get(p) ?? 'missing'}`,
  );
  // Report each change once, not again in every later test of this worker.
  state.baseline = current;
  throw new Error(
    `@mastra/core provider registry files changed ${when}:\n${details.join('\n')}\n` +
      'Point the registry at a temp package root (see the fixture in ' +
      'src/llm/model/provider-registry.test.ts), then rebuild core to restore dist.',
  );
}

afterEach(ctx => check(`during "${ctx.task.name}"`));
afterAll(() => check('in this file outside a test (hooks, or a background write that outlived its test)'));
