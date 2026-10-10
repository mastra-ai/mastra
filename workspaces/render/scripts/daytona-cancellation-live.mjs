import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Daytona, DaytonaNotFoundError, DaytonaGoneError, SandboxState } from '@daytonaio/sdk';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

// Execute from the existing isolated other-providers-artifacts consumer.
const destination = resolve(process.env.EVIDENCE_DIR ?? '..');
await mkdir(destination, { recursive: true });
const name = `mastra-daytona-cancel-${Date.now()}`;
const record = {
  core: '1.75.0',
  daytonaProvider: '0.11.2',
  daytonaSdk: '0.201.0',
  providerSource: '918704fd4608aa4d9d90d4d92c0a3429de2b880a',
  startedAt: new Date().toISOString(),
  name,
  evidence: 'Live Daytona cloud sandbox, unchanged source-built adapter and core; no mocks',
  config: {
    language: 'python',
    ephemeral: true,
    autoStopInterval: 2,
    autoDeleteInterval: 0,
    networkBlockAll: true,
    public: false,
  },
  cases: [],
};
const sanitize = text =>
  text
    .replaceAll(process.env.DAYTONA_API_KEY || 'NO_KEY_PROVIDED', '[REDACTED]')
    .replace(/dtn_[a-zA-Z0-9]+/g, '[REDACTED]');
const save = () =>
  writeFile(resolve(destination, 'daytona-cancellation-live.json'), sanitize(JSON.stringify(record, null, 2)) + '\n');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const sandbox = new DaytonaSandbox({
  id: name,
  name,
  ...record.config,
  timeout: 10_000,
  workingDirectory: '/tmp',
});
const workspace = new Workspace({ sandbox });
const audit = new Daytona({ otelEnabled: false });
let remote;
let failure;

async function inspect(mode, pids) {
  const script = `import json,os,pathlib\npids=${JSON.stringify(pids)}\ndef state(pid):\n try:\n  os.kill(pid,0)\n  return pathlib.Path('/proc/'+str(pid)+'/stat').read_text().rsplit(')',1)[1].strip().split()[0]\n except ProcessLookupError:\n  return 'absent'\n except FileNotFoundError:\n  return 'absent'\nstates=[state(p) for p in pids]\npaths=[pathlib.Path('/tmp/${name}-${mode}-'+kind) for kind in ['parent','child']]\nprint(json.dumps({'states':states,'running':[s not in ['absent','Z','X'] for s in states],'markers':[p.exists() for p in paths]}))`;
  const response = await remote.process.executeCommand(`python3 -c ${quote(script)}`, '/tmp', undefined, 10);
  assert.equal(response.exitCode, 0, 'Independent inspection must complete successfully');
  return JSON.parse(response.result);
}

try {
  await save();
  console.log('Starting live Daytona sandbox');
  await workspace.init();
  record.sandboxId = sandbox.daytona.id;
  await save();
  // A separate SDK client observes backend process state and files.
  remote = await audit.get(record.sandboxId);
  record.resources = { cpu: remote.cpu, memory: remote.memory, disk: remote.disk };
  record.initialState = remote.state;
  assert.equal(remote.state, SandboxState.STARTED);
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
        { command: `python3 -u -c ${quote(parentCode)}`, timeout: mode === 'timeout' ? 1 : 10 },
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
    item.sandboxState = (await audit.get(record.sandboxId)).state;
    assert.equal(item.sandboxState, SandboxState.STARTED);
    if (mode === 'normal') {
      assert.equal(item.exitEvent?.exitCode, 0);
      assert.deepEqual(item.delayedObservation.markers, [true, true]);
      item.behavior = 'PASS: normal command completed';
    } else {
      const continued = item.delayedObservation.markers.some(Boolean);
      const running = item.delayedObservation.running.some(Boolean);
      const metadataCorrect = item.exitEvent?.killed === true && item.exitEvent?.timedOut === (mode === 'timeout');
      item.metadataCorrect = metadataCorrect;
      item.behavior = continued
        ? 'FAIL: remote work continued and wrote a delayed file after cancellation or timeout'
        : running
          ? 'FAIL: at least one process remained running'
          : metadataCorrect
            ? 'PASS: parent and child stopped, no delayed files, correct kill and timeout metadata'
            : 'FAIL: processes stopped but kill or timeout metadata was inaccurate';
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
    try {
      await workspace.destroy();
    } catch (error) {
      record.destroyError = sanitize(`${error.name}: ${error.message}`);
    }
    const lookup = record.sandboxId ?? name;
    const observations = [];
    const deadline = Date.now() + 60_000;
    let verified = false;
    let fallback = false;
    while (Date.now() < deadline) {
      try {
        const current = await audit.get(lookup);
        record.sandboxId ??= current.id;
        observations.push(current.state);
        if (current.state === SandboxState.DESTROYED) {
          verified = true;
          break;
        }
        if (current.state !== SandboxState.DESTROYING && !fallback) {
          fallback = true;
          await audit.delete(current, 30, true);
        }
      } catch (error) {
        if (error instanceof DaytonaNotFoundError || error instanceof DaytonaGoneError) {
          observations.push(error.name);
          verified = true;
          break;
        }
        throw error;
      }
      await delay(1000);
    }
    assert.equal(verified, true, 'Independent SDK must confirm sandbox deletion');
    // Also query only this run's label, never delete unrelated resources.
    const remaining = [];
    for await (const candidate of audit.list({ labels: { 'mastra-sandbox-id': name } })) {
      if (candidate.state !== SandboxState.DESTROYED) remaining.push({ id: candidate.id, state: candidate.state });
    }
    assert.equal(remaining.length, 0, 'No live sandbox with the test label may remain');
    record.cleanup = {
      deleted: true,
      sandboxId: record.sandboxId,
      fallback,
      observations,
      matchingResourcesRemaining: remaining.length,
      verifiedAt: new Date().toISOString(),
      verification: 'Independent Daytona client get plus label-filtered list',
    };
  } catch (error) {
    record.cleanup = {
      confirmed: false,
      sandboxId: record.sandboxId,
      name,
      error: sanitize(`${error.name}: ${error.message}`),
    };
    failure ??= error;
  } finally {
    await audit[Symbol.asyncDispose]();
    record.finishedAt = new Date().toISOString();
    await save();
  }
}
console.log(sanitize(JSON.stringify(record, null, 2)));
// This CLI owns the clients; all cloud cleanup and evidence writes are awaited.
process.exit(failure ? 1 : 0);
