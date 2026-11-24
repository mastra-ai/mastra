import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acquireLock } from './lock.js';

const moduleUrl = new URL('./lock.ts', import.meta.url).href;
const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const DEAD_PID = 2 ** 22 + 12345;

let dir: string;
let lockDir: string;
let logFile: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-lock-'));
  lockDir = path.join(dir, '.lock-embeddings');
  logFile = path.join(dir, 'log');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A separate Node process that takes the lock, records when it held it, holds it for `holdMs`, and releases. */
function lockHolder(holdMs: number, timing?: { heartbeatMs: number; staleMs: number }): Promise<number | null> {
  const script = path.join(dir, `holder-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(
    script,
    `import fs from 'node:fs';
    import { acquireLock } from ${JSON.stringify(moduleUrl)};
    const lock = await acquireLock(${JSON.stringify(lockDir)}, undefined, ${JSON.stringify(timing)});
    const start = Date.now();
    await new Promise(r => setTimeout(r, ${holdMs}));
    fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ start, end: Date.now(), held: lock.isHeld() }) + '\\n');
    lock.release();\n`,
  );
  const child = spawn(process.execPath, ['--import', 'tsx', script], { cwd: packageDir, stdio: 'inherit' });
  return new Promise(resolve => child.once('exit', resolve));
}

function holds(): { start: number; end: number; held: boolean }[] {
  return fs
    .readFileSync(logFile, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line))
    .sort((a, b) => a.start - b.start);
}

function expectNoOverlap(intervals: { start: number; end: number }[]): void {
  for (let i = 1; i < intervals.length; i++) expect(intervals[i]!.start).toBeGreaterThanOrEqual(intervals[i - 1]!.end);
}

describe('feature install lock', () => {
  it('lets only one process at a time take over a lock left by a crashed install', async () => {
    fs.mkdirSync(lockDir);
    fs.writeFileSync(
      path.join(lockDir, 'owner.json'),
      JSON.stringify({ pid: DEAD_PID, host: os.hostname(), token: 'crashed' }),
    );

    const codes = await Promise.all(Array.from({ length: 6 }, () => lockHolder(150)));

    expect(codes).toEqual([0, 0, 0, 0, 0, 0]);
    const intervals = holds();
    expect(intervals).toHaveLength(6);
    expect(intervals.every(h => h.held)).toBe(true);
    expectNoOverlap(intervals);
    expect(fs.existsSync(lockDir)).toBe(false);
  }, 60_000);

  it('never takes over from an owner that is still working, however long it takes', async () => {
    const timing = { heartbeatMs: 50, staleMs: 400 };
    const slow = lockHolder(2_000, timing);
    while (!fs.existsSync(path.join(lockDir, 'owner.json'))) await new Promise(r => setTimeout(r, 20));
    const next = lockHolder(0, timing);

    expect(await Promise.all([slow, next])).toEqual([0, 0]);
    const [first, second] = holds();
    // Held for several times the stale limit.
    expect(first!.end - first!.start).toBeGreaterThan(timing.staleMs * 4);
    expect(first!.held).toBe(true);
    expect(second!.start).toBeGreaterThanOrEqual(first!.end);
  }, 60_000);

  it('takes over from an owner that stopped responding, which then finds out and does not release the new lock', async () => {
    const timing = { heartbeatMs: 60_000, staleMs: 200 };
    const hung = await acquireLock(lockDir, undefined, timing);
    await new Promise(r => setTimeout(r, 300));

    const taker = await acquireLock(lockDir, undefined, timing);

    expect(hung.isHeld()).toBe(false);
    expect(taker.isHeld()).toBe(true);
    hung.release();
    expect(taker.isHeld()).toBe(true);
    taker.release();
    expect(fs.existsSync(lockDir)).toBe(false);
  });

  it('gives up waiting when the caller aborts', async () => {
    const held = await acquireLock(lockDir);
    const controller = new AbortController();
    const waiting = acquireLock(lockDir, controller.signal);
    controller.abort(new Error('stop'));

    await expect(waiting).rejects.toThrow('stop');
    expect(held.isHeld()).toBe(true);
    held.release();
  });
});
