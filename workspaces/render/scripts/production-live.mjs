import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { Render } from '@renderinc/sdk';
import { RenderSandbox } from '../dist/index.js';
import { confirmTermination } from './cleanup.ts';
const client = new Render();
const source = new RenderSandbox({
  client,
  create: { timeoutSeconds: 900, networkPolicy: { default: 'deny-all' } },
  pollIntervalMs: 2000,
});
const resources = [source],
  snapshots = new Map();
const run = randomUUID(),
  base = `/tmp/production-${run}`;
const local = `validation/production-artifacts/${run}`;
const record = {
  startedAt: new Date().toISOString(),
  sdk: '1.2.0',
  core: '1.75.0',
  cases: [],
  resources: [],
  snapshots: [],
  cleanup: [],
};
const save = () =>
  writeFile(
    process.env.CASE_FILTER ? 'validation/production-focused-live.json' : 'validation/production-live.json',
    JSON.stringify(record, null, 2) + '\n',
  );
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const hash = value => createHash('sha256').update(value).digest('hex');
async function capture(sandbox, command) {
  let stdout = '',
    stderr = '',
    exitCode;
  for await (const event of sandbox.exec(command, { timeoutMs: 30000 })) {
    if (event.type === 'exit') exitCode = event.exit_code;
    else if (event.stream === 'stdout') stdout += event.data;
    else stderr += event.data;
  }
  assert.equal(exitCode, 0, stderr);
  return stdout;
}
async function check(name, fn) {
  if (process.env.CASE_FILTER && !new RegExp(process.env.CASE_FILTER).test(name)) return;
  const item = { name, startedAt: new Date().toISOString() };
  record.cases.push(item);
  await save();
  try {
    item.evidence = await fn();
    item.result = 'PASS';
    console.log(name + ': PASS');
  } catch (error) {
    item.result = 'FAIL';
    item.error = String(error);
    item.causes = [];
    for (let e = error; e; e = e.cause) {
      item.causes.push({ name: e.name, message: e.message, code: e.code });
    }
    throw error;
  } finally {
    await save();
  }
  await delay(1500);
}
async function remember(snapshot) {
  snapshots.set(snapshot.id, snapshot);
  record.snapshots = [...snapshots.values()];
  await save();
  return snapshot;
}
async function restored(snapshot) {
  const sandbox = source.restore(snapshot, { create: { timeoutSeconds: 300 } });
  resources.push(sandbox);
  await sandbox.start();
  record.resources.push(sandbox.sandboxId);
  await save();
  return sandbox;
}
try {
  await mkdir(local, { recursive: true });
  await source.start();
  record.resources.push(source.sandboxId);
  await save();
  await source.writeFiles([{ path: base + '/seed', content: 'snapshot-state', mode: 0o640 }]);
  await check('metadata, listing and groups', async () => {
    const metadata = await source.refresh();
    assert.equal(metadata.status, 'running');
    const rows = await source.listSandboxes({ status: ['running'], limit: 100 });
    assert(rows.some(x => x.sandbox.id === source.sandboxId));
    const groups = await source.listGroups();
    assert(groups.length > 0);
    const page = await source.listSandboxes({ status: ['running'], limit: 1 });
    if (page.length) await source.listSandboxes({ status: ['running'], limit: 1, cursor: page[0].cursor });
    return { metadata, groups: groups.map(x => x.sandboxGroup.id), pagination: true };
  });
  await check('command argv, cwd, env, stdout, stderr and nonzero status', async () => {
    await source.writeFiles([{ path: base + '/seed', content: 'snapshot-state', mode: 0o640 }]);
    const result = await source.executeCommand(
      'python3',
      [
        '-c',
        'import os,sys; print(os.getcwd());print(os.environ["CUSTOM"]);print(sys.argv[1]);print("error",file=sys.stderr);sys.exit(7)',
        'literal $HOME; echo injected',
      ],
      { cwd: base, env: { CUSTOM: 'a b' }, timeout: 15000 },
    );
    assert.equal(result.exitCode, 7);
    assert.equal(result.killed, false);
    assert(result.stdout.includes('literal $HOME; echo injected'));
    assert.equal(result.stderr, 'error\n');
    return result;
  });
  const workspace = new Workspace({ sandbox: source }),
    tools = await createWorkspaceTools(workspace);
  for (const mode of ['normal', 'abort', 'timeout'])
    await check('Mastra ' + mode + ' with parent, child and unrelated concurrent work', async () => {
      const prefix = base + '/' + mode,
        controller = new AbortController();
      let observed = '',
        pids,
        exitEvent;
      const child = `import time,pathlib;time.sleep(3);pathlib.Path('${prefix}-child').write_text('survived')`;
      const parent = `import subprocess,os,sys,time,pathlib;c=subprocess.Popen([sys.executable,'-c',${JSON.stringify(child)}]);print('started:'+str(os.getpid())+' child:'+str(c.pid),flush=True);time.sleep(3);pathlib.Path('${prefix}-parent').write_text('survived');c.wait()`;
      const unrelated = source.executeCommand(`sleep 3; printf preserved > ${quote(prefix + '-unrelated')}`);
      unrelated.catch(() => {});
      const result = await tools.mastra_workspace_execute_command.execute(
        { command: `python3 -u -c ${quote(parent)}`, timeout: mode === 'timeout' ? 1 : 15 },
        {
          abortSignal: controller.signal,
          writer: {
            custom: async event => {
              if (event.type === 'data-sandbox-stdout') {
                observed += event.data.output;
                const match = observed.match(/started:(\d+) child:(\d+)/);
                if (match) {
                  pids = [+match[1], +match[2]];
                  if (mode === 'abort') controller.abort();
                }
              }
              if (event.type === 'data-sandbox-exit') exitEvent = event.data;
            },
          },
        },
      );
      assert.equal(pids?.length, 2);
      assert.equal((await unrelated).exitCode, 0);
      await delay(3500);
      const inspect = `import os,json,pathlib\ndef alive(pid):\n try: os.kill(pid,0); return True\n except ProcessLookupError: return False\nprint(json.dumps({'alive':[alive(p) for p in ${JSON.stringify(pids)}],'markers':[pathlib.Path('${prefix}-'+k).exists() for k in ['parent','child']],'unrelated':pathlib.Path('${prefix}-unrelated').read_text()}))`;
      const actual = JSON.parse(await capture(source, `python3 -c ${quote(inspect)}`));
      assert.deepEqual(actual.alive, [false, false]);
      assert.deepEqual(actual.markers, mode === 'normal' ? [true, true] : [false, false]);
      assert.equal(actual.unrelated, 'preserved');
      assert.equal(exitEvent.killed, mode !== 'normal');
      assert.equal(exitEvent.timedOut, mode === 'timeout');
      assert.equal((await source.refresh()).status, 'running');
      return { toolResult: result, exitEvent, pids, actual };
    });
  await check('attached command cancellation preserves resource and adapter', async () => {
    const attached = new RenderSandbox({ client, sandboxId: source.sandboxId });
    const controller = new AbortController();
    try {
      const result = await attached.executeCommand('echo attached-ready; sleep 30', [], {
        abortSignal: controller.signal,
        onStdout: () => controller.abort(),
      });
      assert.equal(result.killed, true);
      assert.equal((await attached.executeCommand('printf reused')).stdout, 'reused');
      return { result, reused: true };
    } finally {
      await attached.destroy();
      assert.equal((await source.refresh()).status, 'running');
    }
  });
  await check('native exec cancellation stops observation and preserves resource', async () => {
    const abort = new AbortController();
    let didAbort = false;
    try {
      for await (const event of source.exec(`echo native-ready; sleep 2; printf done > ${quote(base + '/native')}`, {
        signal: abort.signal,
      })) {
        if (event.type === 'output') {
          didAbort = true;
          abort.abort();
        }
      }
    } catch {
      assert(abort.signal.aborted);
    }
    assert(didAbort);
    await delay(2500);
    assert.equal(await capture(source, `cat ${quote(base + '/native')}`), 'done');
    return { remoteCompletedAfterObservationStopped: true };
  });
  await check('streamed upload and download above 16 MiB', async () => {
    const chunk = Buffer.alloc(1024 * 1024, 173),
      expected = createHash('sha256');
    for (let i = 0; i < 17; i++) expected.update(chunk);
    await source.upload(
      base + '/large.bin',
      Readable.from(
        (async function* () {
          for (let i = 0; i < 17; i++) yield chunk;
        })(),
      ),
      { timeoutMs: 90000 },
    );
    const downloaded = await source.download(base + '/large.bin', { timeoutMs: 90000 });
    assert.equal(downloaded.size, 17 * 1024 * 1024);
    assert.equal(hash(downloaded.data), expected.digest('hex'));
    const target = local + '/download.bin';
    await source.downloadToFile(base + '/large.bin', target, { timeoutMs: 90000 });
    assert.equal(hash(await readFile(target)), hash(downloaded.data));
    return {
      bytes: downloaded.size,
      sha256: hash(downloaded.data),
      contentType: downloaded.contentType,
      atomicLocalDownload: true,
    };
  });
  await check('local file, tar directory and gzip archive uploads', async () => {
    await mkdir(local + '/directory/nested', { recursive: true });
    const data = Buffer.from([0, 255, 10, 1, 2, 128]);
    await writeFile(local + '/directory/nested/file with space.bin', data);
    console.log('archive step: upload local file');
    await source.uploadFile(local + '/directory/nested/file with space.bin', base + '/local.bin');
    assert.deepEqual(await source.readFile(base + '/local.bin'), data);
    console.log('archive step: upload tar directory');
    await source.uploadDirectory(local + '/directory', base + '/tar');
    assert.deepEqual(await source.readFile(base + '/tar/nested/file with space.bin'), data);
    console.log('archive step: upload gzip');
    const gzip = execFileSync('tar', ['-C', local + '/directory', '-czf', '-', '.']);
    await source.upload(base + '/gzip', gzip, { contentType: 'application/gzip' });
    assert.deepEqual(await source.readFile(base + '/gzip/nested/file with space.bin'), data);
    return { localFile: true, directoryTar: true, gzip: true, binary: true };
  });
  await check('filesystem capture, lookup, pagination and restore', async () => {
    const saved = await remember(
      await source.captureSnapshot({ kind: 'filesystem', name: 'mastra-production-' + run }),
    );
    const got = await source.snapshots.get({ snapshotId: saved.id, sandboxGroupId: saved.sandboxGroupId });
    assert.equal(got.status, 'available');
    const first = await source.snapshots.list({
      sandboxGroupId: saved.sandboxGroupId,
      status: ['available'],
      limit: 1,
    });
    assert(first.length);
    await source.snapshots.list({
      sandboxGroupId: saved.sandboxGroupId,
      status: ['available'],
      limit: 1,
      cursor: first[0].cursor,
    });
    const copy = await restored(saved);
    assert.equal((await copy.readFile(base + '/seed')).toString(), 'snapshot-state');
    assert.equal((await copy.executeCommand(`stat -c %a ${quote(base + '/seed')}`)).stdout.trim(), '640');
    await copy.destroy();
    return { snapshot: saved, restoredId: copy.sandboxId, bytesAndPermissionsPreserved: true };
  });
  await check('runtime capture and restore running process memory', async () => {
    const program = `import time,pathlib\nn=100\nfor _ in range(240):\n n+=1\n pathlib.Path('${base}/counter').write_text(str(n))\n time.sleep(0.5)`;
    await capture(source, `nohup python3 -u -c ${quote(program)} >/tmp/runtime-counter.log 2>&1 < /dev/null & echo $!`);
    await delay(1000);
    const saved = await remember(await source.captureSnapshot({ kind: 'runtime', name: 'mastra-runtime-' + run }));
    const copy = await restored(saved);
    const before = Number((await copy.readFile(base + '/counter')).toString());
    await delay(1800);
    const after = Number((await copy.readFile(base + '/counter')).toString());
    assert(after > before);
    assert(before > 100);
    await copy.destroy();
    return { snapshot: saved, restoredId: copy.sandboxId, before, after, processMemoryResumed: true };
  });
  await check('Mastra checkpoint hook', async () => {
    await source.snapshot();
    await remember(source.lastSnapshot);
    assert.equal(source.lastSnapshot.name, source.id);
    return { snapshotId: source.lastSnapshot.id, name: source.lastSnapshot.name };
  });
  await check('named snapshot restore and clone seed fallback', async () => {
    assert(source.lastSnapshot);
    const named = new RenderSandbox({
      client,
      create: { snapshotName: source.lastSnapshot.name, timeoutSeconds: 180 },
    });
    resources.push(named);
    await named.start();
    record.resources.push(named.sandboxId);
    await save();
    assert.equal((await named.readFile(base + '/seed')).toString(), 'snapshot-state');
    const clone = source.clone({
      checkpointName: 'missing-' + run,
      seedCheckpointName: source.lastSnapshot.name,
    });
    resources.push(clone);
    await clone.start();
    record.resources.push(clone.sandboxId);
    await save();
    assert.equal((await clone.readFile(base + '/seed')).toString(), 'snapshot-state');
    await named.destroy();
    await clone.destroy();
    return { namedRestore: named.sandboxId, seedFallback: clone.sandboxId };
  });
  record.result = 'PASS';
} catch (error) {
  record.result = 'FAIL';
  record.error = String(error);
  process.exitCode = 1;
  console.error(record.error);
  for (let e = error.cause; e; e = e.cause) console.error(e.name + ': ' + e.message);
} finally {
  await Promise.allSettled(source.snapshots.pendingCreates);
  for (const saved of source.snapshots.createdSnapshots.values()) snapshots.set(saved.id, saved);
  for (const saved of snapshots.values())
    try {
      await source.snapshots.delete({ snapshotId: saved.id, sandboxGroupId: saved.sandboxGroupId });
      const rows = await source.snapshots.list({ sandboxGroupId: saved.sandboxGroupId, limit: 100 });
      assert(!rows.some(row => row.snapshot?.id === saved.id || row.sandboxSnapshot?.id === saved.id));
      record.cleanup.push({ snapshotId: saved.id, deleted: true });
    } catch (error) {
      record.cleanup.push({ snapshotId: saved.id, error: String(error) });
      process.exitCode = 1;
    }
  for (const sandbox of resources.reverse())
    try {
      await sandbox.destroy();
      if (sandbox.sandboxId) record.cleanup.push(await confirmTermination(client, sandbox.sandboxId));
    } catch (error) {
      record.cleanup.push({ sandboxId: sandbox.sandboxId, error: String(error) });
      process.exitCode = 1;
    }
  record.finishedAt = new Date().toISOString();
  if (process.exitCode) record.result = 'FAIL';
  await save();
  console.log(
    'Result: ' +
      record.result +
      '; evidence: ' +
      (process.env.CASE_FILTER ? 'validation/production-focused-live.json' : 'validation/production-live.json'),
  );
}
