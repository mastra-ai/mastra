import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Render } from '@renderinc/sdk';
import { RenderSandbox } from '../src/index.js';
import { confirmTermination } from './cleanup.js';

const client = new Render();
const api = client.experimental.sandboxes;
const record: { startedAt: string; checks: string[]; sandboxIds: string[]; cleanup: unknown[] } = {
  startedAt: new Date().toISOString(),
  checks: [],
  sandboxIds: [],
  cleanup: [],
};
const dir = resolve(process.env.EVIDENCE_DIR ?? 'validation/live-artifacts');
await mkdir(dir, { recursive: true });
const save = () => writeFile(resolve(dir, 'operations.json'), JSON.stringify(record, null, 2) + '\n');
const sandbox = new RenderSandbox({
  client,
  create: { timeoutSeconds: 300, networkPolicy: { default: 'deny-all' } },
});
try {
  await sandbox.start();
  record.sandboxIds.push(sandbox.sandboxId!);
  await save();
  const info = await api.get(sandbox.sandboxId!);
  assert.equal(info.status, 'running');
  record.checks.push(`creation/readiness: running; configured lifetime ${info.timeoutSeconds}s`);
  await sandbox.writeFiles([{ path: "/workspace/quote's file.bin", content: Buffer.from([0, 255, 42]), mode: 0o600 }]);
  assert.deepEqual(await sandbox.readFile("/workspace/quote's file.bin"), Buffer.from([0, 255, 42]));
  record.checks.push('native binary upload/download, parent creation and quoted path');
  const mode = await sandbox.executeCommand("stat -c %a '/workspace/quote'\"'\"'s file.bin'");
  assert.equal(mode.stdout.trim(), '600');
  const value = "literal ' $(echo injected) `echo injected` ;";
  const argv = await sandbox.executeCommand('printf', ['%s', value]);
  assert.equal(argv.stdout, value);
  const env = await sandbox.executeCommand('printf %s "$EXPLICIT_VALUE"', [], {
    env: { EXPLICIT_VALUE: value },
  });
  assert.equal(env.stdout, value);
  record.checks.push('literal argv and explicit per-command environment');
  await sandbox.executeCommand('export TRANSIENT=one; cd /workspace; printf persistent > state.txt');
  const state = await sandbox.executeCommand('test -z "${TRANSIENT:-}" && test "$PWD" = / && cat /workspace/state.txt');
  assert.equal(state.stdout, 'persistent');
  assert.equal(state.exitCode, 0);
  record.checks.push('files persist; shell exports and cwd do not persist');
  const streams = await sandbox.executeCommand('printf out; printf err >&2; exit 7');
  assert.equal(streams.stdout, 'out');
  assert.equal(streams.stderr, 'err');
  assert.equal(streams.exitCode, 7);
  record.checks.push('stdout/stderr/nonzero exit 7 retained');
  const tail = await sandbox.executeCommand('printf 1234567890', [], { maxRetainedBytes: 4 });
  assert.equal(tail.stdout, '7890');
  assert.equal(tail.stdoutDroppedBytes, 6);
  record.checks.push('bounded output with truncation metadata');
  const attached = new RenderSandbox({ client, sandboxId: sandbox.sandboxId });
  await attached.start();
  assert.equal((await attached.executeCommand('cat /workspace/state.txt')).stdout, 'persistent');
  await attached.destroy();
  assert.equal((await api.get(sandbox.sandboxId!)).status, 'running');
  record.checks.push('attached destroy leaves caller-owned sandbox running');
  const timed = await sandbox.executeCommand('sleep 60', [], { timeout: 500 });
  assert.equal(timed.killed, true);
  assert.equal(timed.timedOut, true);
  assert.equal((await sandbox.refresh()).status, 'running');
  record.checks.push('command timeout stops process group and preserves sandbox');
} finally {
  try {
    await sandbox.destroy();
    if (sandbox.sandboxId) record.cleanup.push(await confirmTermination(client, sandbox.sandboxId));
  } finally {
    await save();
  }
}
console.log(JSON.stringify(record, null, 2));
