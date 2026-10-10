import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { ModalSandbox } from '@mastra/modal';
import { ModalClient, NotFoundError } from 'modal';

// Run from the existing isolated other-providers-artifacts consumer.
// Credentials stay in the host process environment and are not sent as sandbox env.
const destination = resolve(process.env.EVIDENCE_DIR ?? '..');
await mkdir(destination, { recursive: true });
const name = `mastra-modal-cancel-${Date.now()}`;
const appName = 'mastra';
const image = 'python:3.13-slim';
const record = {
  core: '1.75.0',
  modalProvider: '0.7.1',
  modalSdk: '0.10.1',
  providerSource: '918704fd4608aa4d9d90d4d92c0a3429de2b880a',
  startedAt: new Date().toISOString(),
  evidence: 'Live Modal cloud sandbox, unchanged source-built adapter and core; no mocks',
  appName,
  name,
  image,
  sandboxLifetimeMs: 300_000,
  cases: [],
};
function sanitize(text) {
  for (const key of ['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET']) {
    if (process.env[key]) text = text.replaceAll(process.env[key], '[REDACTED]');
  }
  return text;
}
const save = () =>
  writeFile(resolve(destination, 'modal-cancellation-live.json'), sanitize(JSON.stringify(record, null, 2)) + '\n');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const sandbox = new ModalSandbox({
  id: name,
  appName,
  baseImage: image,
  timeoutMs: 300_000,
  workingDirectory: '/tmp',
});
const workspace = new Workspace({ sandbox });
const audit = new ModalClient();
let remote;
let failure;

async function inspect(mode, pids) {
  const script = `import json,os,pathlib\npids=${JSON.stringify(pids)}\ndef alive(pid):\n try:\n  os.kill(pid,0)\n  return True\n except ProcessLookupError:\n  return False\nprint(json.dumps({'alive':[alive(p) for p in pids],'markers':[pathlib.Path('/tmp/${name}-${mode}-'+kind).exists() for kind in ['parent','child']]}))`;
  const proc = await remote.exec(['python', '-c', script], { timeoutMs: 10_000 });
  const [stdout, stderr, exit] = await Promise.all([proc.stdout.readText(), proc.stderr.readText(), proc.wait()]);
  assert.equal(exit, 0, `Independent observation failed: ${stderr}`);
  return JSON.parse(stdout);
}
try {
  await save();
  console.log('Starting live Modal sandbox');
  await workspace.init();
  record.sandboxId = sandbox.modal.sandboxId;
  await save();
  // A distinct SDK client observes the backend without trusting adapter status.
  remote = await audit.sandboxes.fromId(record.sandboxId);
  assert.equal(await remote.poll(), null);
  console.log(`Sandbox ready: ${record.sandboxId}`);
  const tools = await createWorkspaceTools(workspace);
  for (const mode of ['normal', 'abort', 'timeout']) {
    const prefix = `/tmp/${name}-${mode}`;
    const childCode = `import time,pathlib; time.sleep(3); pathlib.Path('${prefix}-child').write_text('survived')`;
    const parentCode = `import subprocess,sys,os,time,pathlib; c=subprocess.Popen([sys.executable,'-c',${JSON.stringify(childCode)}]); print('started:'+str(os.getpid())+' child:'+str(c.pid),flush=True); time.sleep(3); pathlib.Path('${prefix}-parent').write_text('survived'); c.wait()`;
    const abort = new AbortController();
    const item = { mode, startedAt: new Date().toISOString() };
    record.cases.push(item);
    let streamed = '';
    const watchdog = setTimeout(() => {
      item.watchdogFired = true;
      abort.abort();
    }, 20_000);
    try {
      item.toolOutput = await tools.mastra_workspace_execute_command.execute(
        { command: `python -u -c ${quote(parentCode)}`, timeout: mode === 'timeout' ? 1 : 10 },
        {
          abortSignal: abort.signal,
          writer: {
            custom: async event => {
              if (event.type === 'data-sandbox-stdout') {
                streamed += event.data.output;
                const match = streamed.match(/started:(\d+) child:(\d+)/);
                if (match) {
                  item.pids = [Number(match[1]), Number(match[2])];
                  if (mode === 'abort' && !abort.signal.aborted) {
                    item.abortRequestedAt = new Date().toISOString();
                    abort.abort();
                  }
                }
              }
              if (event.type === 'data-sandbox-exit') item.exitEvent = event.data;
            },
          },
        },
      );
    } finally {
      clearTimeout(watchdog);
    }
    item.toolReturnedAt = new Date().toISOString();
    await save();
    assert.equal(item.watchdogFired, undefined, 'Harness deadline must not cause test cancellation');
    assert.equal(item.pids?.length, 2, 'Both test processes must have started');
    item.immediateObservation = await inspect(mode, item.pids);
    if (mode !== 'normal') await delay(4000);
    item.delayedObservation = await inspect(mode, item.pids);
    item.sandboxStillRunning = (await remote.poll()) === null;
    assert.equal(item.sandboxStillRunning, true, 'Sandbox must stay available for observation');
    if (mode === 'normal') {
      assert.equal(item.exitEvent?.exitCode, 0);
      assert.deepEqual(item.delayedObservation.markers, [true, true]);
      item.behavior = 'PASS: normal command completed';
    } else {
      const continued = item.delayedObservation.markers.some(Boolean);
      const claimedKilled = item.exitEvent?.killed === true;
      item.behavior =
        claimedKilled && continued
          ? 'FAIL: adapter claimed killed but remote work continued and wrote a delayed file'
          : !continued && !item.delayedObservation.alive.some(Boolean)
            ? 'PASS: no delayed files and both processes absent'
            : 'INCONCLUSIVE: inspect raw observations';
      if (mode === 'abort') assert.equal(abort.signal.aborted, true);
    }
    await save();
    console.log(`${mode}: ${item.behavior}`);
  }
  record.testExecution = 'COMPLETE';
  record.cancellationCorrect = record.cases.every(item => item.behavior.startsWith('PASS'));
} catch (error) {
  record.testExecution = 'ERROR';
  record.error = sanitize(`${error.name}: ${error.message}`);
  failure = error;
} finally {
  try {
    await workspace.destroy();
    // destroy() swallows termination errors, so confirm using the independent client.
    if (!remote && record.sandboxId) remote = await audit.sandboxes.fromId(record.sandboxId);
    if (!remote) {
      try {
        remote = await audit.sandboxes.fromName(appName, name);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
    if (remote) {
      const before = await remote.poll();
      const cleanupFallback = before === null;
      if (cleanupFallback) await remote.terminate({ wait: true });
      const exitCode = await remote.poll();
      assert.notEqual(exitCode, null, 'Cloud sandbox must be terminated');
      record.cleanup = {
        sandboxId: remote.sandboxId,
        terminated: true,
        exitCode,
        cleanupFallback,
        verifiedAt: new Date().toISOString(),
        verification: 'Independent ModalClient sandbox poll returned terminal exit code',
      };
    } else {
      record.cleanup = { created: false, verification: 'No matching running named sandbox found' };
    }
  } catch (error) {
    record.cleanup = {
      confirmed: false,
      error: sanitize(`${error.name}: ${error.message}`),
      sandboxId: record.sandboxId,
      appName,
      name,
    };
    failure ??= error;
  } finally {
    audit.close();
    record.finishedAt = new Date().toISOString();
    await save();
  }
}
console.log(sanitize(JSON.stringify(record, null, 2)));
if (failure) process.exitCode = 1;
