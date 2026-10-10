import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Render } from '@renderinc/sdk';
import { RenderSandbox, renderSandboxProvider } from '../dist/index.js';
import { confirmTermination } from './cleanup.ts';

const client = new Render();
const ownerId = process.env.RENDER_WORKSPACE_ID;
const resources = [],
  snapshots = new Map();
const run = randomUUID();
const output = process.env.AUDIT_OUTPUT ?? 'validation/operation-audit.json';
const record = {
  startedAt: new Date().toISOString(),
  sdk: '1.2.0',
  core: '1.75.0',
  cases: [],
  resources: [],
  snapshots: [],
  cleanup: [],
};
const save = async () => {
  record.resources = [...new Set(resources.map(s => s.sandboxId).filter(Boolean))];
  record.snapshots = [...snapshots.values()];
  await writeFile(output, JSON.stringify(record, null, 2) + '\n');
};
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const remember = sandbox => {
  resources.push(sandbox);
  return sandbox;
};
async function start(sandbox) {
  await sandbox.start();
  await save();
  return sandbox;
}
async function owned(options = {}) {
  return start(remember(new RenderSandbox({ client, ...options, create: { timeoutSeconds: 600, ...options.create } })));
}
async function dispose(sandbox) {
  await sandbox.destroy();
  if (sandbox.owned && sandbox.sandboxId) record.cleanup.push(await confirmTermination(client, sandbox.sandboxId));
  await save();
}
async function check(name, fn) {
  if (process.env.CASE_FILTER && !new RegExp(process.env.CASE_FILTER).test(name)) return;
  const item = { name, startedAt: new Date().toISOString() };
  record.cases.push(item);
  await save();
  try {
    item.evidence = await fn();
    item.result = 'PASS';
  } catch (error) {
    item.result = 'FAIL';
    item.error = String(error);
    process.exitCode = 1;
  }
  await save();
  console.log(`${name}: ${item.result}${item.error ? ' ' + item.error : ''}`);
}
const urls = ['https://example.com', 'https://example.org', 'http://example.com'];
async function egress(sandbox) {
  const program = `import subprocess,json\nresults=[]\nfor url in ${JSON.stringify(urls)}:\n try:\n  response=subprocess.run(['curl','--location','--silent','--show-error','--fail','--connect-timeout','4','--max-time','6','--write-out','\\n%{http_code}',url],capture_output=True,text=True,timeout=7)\n  body,status=response.stdout.rsplit('\\n',1)\n  results.append({'url':url,'status':int(status),'example':'Example Domain' in body} if response.returncode==0 else {'url':url,'error':response.stderr,'exitCode':response.returncode})\n except Exception as error: results.append({'url':url,'error':str(error)})\nprint(json.dumps(results))`;
  const result = await sandbox.executeCommand('python3', ['-c', program], { timeout: 25000 });
  assert.equal(result.exitCode, 0, result.stderr);
  return JSON.parse(result.stdout);
}
let source;
try {
  source = await owned({ ownerId, create: { env: { AUDIT_VALUE: 'created' } } });
  await source.writeFiles([{ path: '/tmp/audit-seed', content: 'original', mode: 0o640 }]);
  await check('factory, cached info, instructions, client options and creation env', async () => {
    const attachment = remember(
      renderSandboxProvider.createSandbox({ sandboxId: source.sandboxId, ownerId, workingDirectory: '/tmp' }),
    );
    await start(attachment);
    const info = attachment.getInfo();
    assert.equal(info.metadata.owned, false);
    assert.equal(info.metadata.sandboxId, source.sandboxId);
    assert(attachment.getInstructions().includes('/tmp'));
    assert.equal((await attachment.executeCommand('printf "$AUDIT_VALUE"')).stdout, 'created');
    await attachment.stop();
    const configured = remember(new RenderSandbox({ clientOptions: { ownerId }, sandboxId: source.sandboxId }));
    await start(configured);
    assert.equal((await configured.refresh()).status, 'running');
    await configured.destroy();
    return { factory: true, clientOptions: true, sourcePreserved: true, env: 'created' };
  });
  await check('native exec stdout, stderr, exit status and early iterator close', async () => {
    const events = [];
    for await (const event of source.exec('printf out; printf err >&2; exit 7')) events.push(event);
    assert.equal(
      events
        .filter(e => e.type === 'output' && e.stream === 'stdout')
        .map(e => e.data)
        .join(''),
      'out',
    );
    assert.equal(
      events
        .filter(e => e.type === 'output' && e.stream === 'stderr')
        .map(e => e.data)
        .join(''),
      'err',
    );
    assert.equal(events.at(-1).exit_code, 7);
    for await (const event of source.exec('echo ready; sleep 1; printf done > /tmp/iterator-closed'))
      if (event.type === 'output') break;
    await delay(1600);
    assert.equal((await source.readFile('/tmp/iterator-closed')).toString(), 'done');
    return { events, remoteContinuesAfterIteratorClose: true };
  });
  await check('upload string, Uint8Array, Buffer and file limit failures', async () => {
    for (const [label, data] of [
      ['string', 'hello 🦀'],
      ['uint8', new Uint8Array([0, 255, 128])],
      ['buffer', Buffer.from([1, 2, 3])],
    ]) {
      await source.upload('/tmp/' + label, data);
      assert.deepEqual((await source.download('/tmp/' + label)).data, Buffer.from(data));
    }
    const limited = remember(new RenderSandbox({ client, sandboxId: source.sandboxId, maxFileBytes: 2 }));
    await assert.rejects(limited.upload('/tmp/too-large', '123'), e => e.code === 'FILE_LIMIT');
    await assert.rejects(limited.download('/tmp/buffer'), e => e.code === 'FILE_LIMIT');
    await limited.destroy();
    return { inputForms: ['string', 'Uint8Array', 'Buffer'], uploadAndDownloadLimits: true };
  });
  await check('bounded output retains tail while callbacks receive complete streams', async () => {
    const limited = remember(new RenderSandbox({ client, sandboxId: source.sandboxId, maxOutputBytes: 8 }));
    let out = '',
      err = '';
    const result = await limited.executeCommand('printf 0123456789abcdef; printf fedcba9876543210 >&2', [], {
      onStdout: chunk => {
        out += chunk;
      },
      onStderr: chunk => {
        err += chunk;
      },
    });
    assert.equal(out, '0123456789abcdef');
    assert.equal(err, 'fedcba9876543210');
    assert.equal(result.stdout, '89abcdef');
    assert.equal(result.stderr, '76543210');
    await limited.destroy();
    return { result, out, err };
  });
  await check('snapshot create, wait, expiry, checkpoint priority and clone overrides', async () => {
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const name = 'audit-' + run;
    const receipt = await source.snapshots.create({
      sandboxId: source.sandboxId,
      kind: 'filesystem',
      name,
      expiresAt,
      ownerId,
    });
    snapshots.set(receipt.id, receipt);
    await save();
    const saved = await source.snapshots.waitForAvailable(receipt, { ownerId });
    snapshots.set(saved.id, saved);
    await save();
    assert.equal(new Date(saved.expiresAt).getTime(), new Date(expiresAt).getTime());
    await source.writeFiles([{ path: '/tmp/audit-seed', content: 'changed' }]);
    const copy = await start(
      remember(
        source.clone({
          checkpointName: name,
          seedCheckpointName: 'missing-' + run,
          env: { AUDIT_VALUE: 'clone' },
          workingDirectory: '/tmp',
        }),
      ),
    );
    assert.equal((await copy.readFile('/tmp/audit-seed')).toString(), 'original');
    assert.equal((await copy.executeCommand('printf "$AUDIT_VALUE"; pwd')).stdout, 'clone/tmp\n');
    const input = { snapshotId: saved.id, sandboxGroupId: saved.sandboxGroupId };
    await source.snapshots.delete(input);
    await assert.rejects(source.sdk.snapshots.get(input), e => e.statusCode === 404);
    assert.equal((await copy.readFile('/tmp/audit-seed')).toString(), 'original');
    await dispose(copy);
    return { snapshot: saved, restoredId: copy.sandboxId, preservedAfterSnapshotDeletion: true };
  });
  await check('clone fresh base fallback and attached clone', async () => {
    const fresh = await start(
      remember(source.clone({ checkpointName: 'missing-' + run, seedCheckpointName: 'missing-seed-' + run })),
    );
    assert.equal((await fresh.executeCommand('test ! -e /tmp/audit-seed')).exitCode, 0);
    assert.equal((await fresh.executeCommand('printf "$AUDIT_VALUE"')).stdout, 'created');
    await fresh.stop();
    record.cleanup.push(await confirmTermination(client, fresh.sandboxId));
    const attachment = await start(remember(source.clone({ sandboxId: source.sandboxId })));
    assert.equal(attachment.owned, false);
    assert.equal((await attachment.readFile('/tmp/audit-seed')).toString(), 'changed');
    await attachment.stop();
    assert.equal((await source.refresh()).status, 'running');
    return { freshId: fresh.sandboxId, attachmentPreservesSource: true };
  });
  await check('owned terminate, attached terminate and direct SDK lifecycle', async () => {
    const target = await owned();
    const attached = await start(remember(new RenderSandbox({ client, sandboxId: target.sandboxId })));
    await attached.terminate();
    record.cleanup.push(await confirmTermination(client, target.sandboxId));
    await target.destroy();
    const own = await owned();
    await own.terminate();
    record.cleanup.push(await confirmTermination(client, own.sandboxId));
    await own.sdk.terminate(own.sandboxId); // API termination is idempotent.
    const raw = await source.sdk.create({ timeoutSeconds: 120, networkPolicy: { default: 'deny-all' } });
    const rawAttachment = remember(new RenderSandbox({ client, sandboxId: raw.id }));
    await save();
    try {
      await rawAttachment.start();
      assert.equal((await source.sdk.get(raw.id)).status, 'running');
    } finally {
      await source.sdk.terminate(raw.id);
      await rawAttachment.destroy();
      record.cleanup.push(await confirmTermination(client, raw.id));
    }
    return { owned: own.sandboxId, attached: target.sandboxId, direct: raw.id };
  });
  await check('terminate cancellation mode and observe cancellation mode', async () => {
    const disposable = await owned({ cancellationMode: 'terminate' });
    const abort = new AbortController();
    await assert.rejects(
      disposable.executeCommand('echo ready; sleep 30', [], {
        abortSignal: abort.signal,
        onStdout: () => abort.abort(),
      }),
    );
    record.cleanup.push(await confirmTermination(client, disposable.sandboxId));
    const observer = remember(new RenderSandbox({ client, sandboxId: source.sandboxId, cancellationMode: 'observe' }));
    const stop = new AbortController();
    await assert.rejects(
      observer.executeCommand('echo ready; sleep 1; printf yes > /tmp/observe-marker', [], {
        abortSignal: stop.signal,
        onStdout: () => stop.abort(),
      }),
      e => e.details.remoteMayBeRunning === true,
    );
    await delay(1600);
    assert.equal((await source.readFile('/tmp/observe-marker')).toString(), 'yes');
    await observer.destroy();
    return { terminatedId: disposable.sandboxId, observationLeavesRemoteWork: true };
  });
  await check('released SDK legacy allow-list mismatch reproduction', async () => {
    let failed;
    try {
      const raw = await source.sdk.create({
        timeoutSeconds: 60,
        networkPolicy: { default: 'allow-list', allowedDomains: ['example.com'] },
      });
      const attached = remember(new RenderSandbox({ client, sandboxId: raw.id }));
      await save();
      await attached.terminate();
      record.cleanup.push(await confirmTermination(client, raw.id));
    } catch (error) {
      failed = { statusCode: error.statusCode, message: error.message };
    }
    assert.equal(failed?.statusCode, 400);
    assert(failed.message.includes('rules'));
    return { diagnostic: 'Expected failure reproduced in the unmodified SDK', failure: failed };
  });
  await check('host positive controls and deny-all actual egress', async () => {
    const host = [];
    for (const url of urls) {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200);
      assert((await response.text()).includes('Example Domain'));
      host.push({ url, status: response.status });
    }
    const denied = await egress(source);
    assert(denied.every(row => row.error));
    return { host, denied };
  });
  await check('explicit allow-all actual egress', async () => {
    const unrestricted = await owned({ create: { networkPolicy: { type: 'allow-all' } } });
    try {
      const results = await egress(unrestricted);
      assert(results.every(row => row.status === 200 && row.example));
      return { sandboxId: unrestricted.sandboxId, results };
    } finally {
      await dispose(unrestricted);
    }
  });
  for (const syntax of ['rules', 'allowedDomains'])
    await check('HTTPS allow-list enforcement using ' + syntax, async () => {
      const networkPolicy =
        syntax === 'rules'
          ? { type: 'allow-list', rules: [{ domain: 'example.com', protocol: 'https' }] }
          : { default: 'allow-list', allowedDomains: ['example.com'] };
      const allowed = await owned({ create: { networkPolicy } });
      try {
        const remote = await allowed.refresh();
        assert.equal(remote.networkPolicy.type ?? remote.networkPolicy.default, 'allow-list');
        assert.deepEqual(remote.networkPolicy.rules, [{ domain: 'example.com', protocol: 'https' }]);
        const results = await egress(allowed);
        assert.equal(results[0].status, 200);
        assert.equal(results[0].example, true);
        assert(results[1].error);
        assert(results[2].error);
        return { sandboxId: allowed.sandboxId, effectivePolicy: remote.networkPolicy, results };
      } finally {
        await dispose(allowed);
      }
    });
} finally {
  for (const sandbox of resources) {
    await Promise.allSettled(sandbox.snapshots.pendingCreates);
    for (const saved of sandbox.snapshots.createdSnapshots.values()) snapshots.set(saved.id, saved);
  }
  for (const snapshot of snapshots.values()) {
    const input = { snapshotId: snapshot.id, sandboxGroupId: snapshot.sandboxGroupId };
    try {
      try {
        await client.experimental.sandboxes.snapshots.delete(input);
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      }
      await assert.rejects(client.experimental.sandboxes.snapshots.get(input), e => e.statusCode === 404);
      record.cleanup.push({ snapshotId: snapshot.id, deleted: true });
    } catch (error) {
      record.cleanup.push({ snapshotId: snapshot.id, error: String(error) });
      process.exitCode = 1;
    }
  }
  for (const sandbox of resources.toReversed()) {
    try {
      await dispose(sandbox);
    } catch (error) {
      record.cleanup.push({ sandboxId: sandbox.sandboxId, error: String(error) });
      process.exitCode = 1;
    }
  }
  record.finishedAt = new Date().toISOString();
  record.result = process.exitCode ? 'FAIL' : 'PASS';
  await save();
  console.log(`Result: ${record.result}; ${record.cases.length} cases; ${output}`);
}
