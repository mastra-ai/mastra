import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { Render } from '@renderinc/sdk';
import { RenderSandbox } from '../dist/index.js';
import { confirmTermination } from './cleanup.ts';

// Feasibility probe only. The shipped Render adapter is not modified.
// The command wrapper and kill helper use only public Render SDK exec().
const client = new Render();
const api = client.experimental.sandboxes;
const owner = new RenderSandbox({
  client,
  create: { timeoutSeconds: 180, networkPolicy: { default: 'deny-all' } },
});
const name = `mastra-proc-proof-${randomUUID()}`;
const record = {
  startedAt: new Date().toISOString(),
  core: '1.75.0',
  renderSdk: '1.2.0',
  evidence:
    'Live Render sandbox; prototype process-group control through public WorkspaceSandbox and SDK APIs; current adapter unchanged',
  name,
  cases: [],
};
const save = () => writeFile('validation/render-process-control-probe.json', JSON.stringify(record, null, 2) + '\n');
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const spawnWrapper = `umask 077
mkdir -p "$1" && chmod 700 "$1" || exit 126
exec setsid -w bash -c 'printf "%s\\n" "$$" > "$1" || exit 126; bash -c "$2"; ret=$?; rm -f "$1"; exit "$ret"' bash "$2" "$3"`;
const killWrapper = `export LC_ALL=C
file="$1"
for i in {1..40}; do [ -s "$file" ] && break; sleep 0.05; done
[ -s "$file" ] || exit 3
pgid=$(cat "$file")
[[ "$pgid" =~ ^[0-9]+$ ]] && [ "$pgid" -gt 1 ] || exit 4
kill -STOP -- "-$pgid" 2>/dev/null
kill -KILL -- "-$pgid" 2>/dev/null
for i in {1..40}; do
  if err=$(kill -0 -- "-$pgid" 2>&1); then sleep 0.05; continue; fi
  case "$err" in *[Nn]o\\ such\\ process*) rm -f "$file"; exit 0 ;; *) printf "%s\\n" "$err" >&2; exit 5 ;; esac
done
exit 6`;

async function capture(command) {
  let stdout = '',
    stderr = '',
    exitCode;
  const stream = await api.exec(owner.sandboxId, command, undefined, AbortSignal.timeout(15_000));
  try {
    for await (const event of stream) {
      if (event.type === 'exit') exitCode = event.exit_code;
      else if (event.stream === 'stdout') stdout += event.data;
      else stderr += event.data;
    }
  } finally {
    await stream.return(undefined);
  }
  assert(Number.isInteger(exitCode), 'SDK must deliver a final exit event');
  return { stdout, stderr, exitCode };
}

async function executeControlled(command, _args, options = {}) {
  const start = Date.now();
  const path = `/tmp/${name}/${randomUUID()}`;
  let stopPromise,
    stopReason,
    timer,
    stdout = '',
    stderr = '',
    exitCode;
  const stop = reason => {
    if (!stopPromise) {
      stopReason = reason;
      stopPromise = capture(`bash -c ${quote(killWrapper)} bash ${quote(path)}`);
      stopPromise.catch(() => {});
    }
  };
  const onAbort = () => stop('abort');
  options.abortSignal?.throwIfAborted();
  options.abortSignal?.addEventListener('abort', onAbort, { once: true });
  let stream;
  try {
    stream = await api.exec(
      owner.sandboxId,
      `bash -c ${quote(spawnWrapper)} bash ${quote(`/tmp/${name}`)} ${quote(path)} ${quote(command)}`,
      undefined,
      AbortSignal.timeout(15_000),
    );
    timer = setTimeout(() => stop('timeout'), options.timeout ?? 10_000);
    for await (const event of stream) {
      if (event.type === 'exit') exitCode = event.exit_code;
      else if (event.stream === 'stdout') {
        stdout += event.data;
        await options.onStdout?.(event.data);
      } else {
        stderr += event.data;
        await options.onStderr?.(event.data);
      }
    }
    const killReport = stopPromise ? await stopPromise : undefined;
    if (killReport)
      assert.equal(
        killReport.exitCode,
        0,
        `Process-group termination was not confirmed: ${JSON.stringify(killReport)}`,
      );
    assert(Number.isInteger(exitCode), 'No confirmed command exit');
    return {
      stdout,
      stderr,
      exitCode,
      success: exitCode === 0,
      executionTimeMs: Date.now() - start,
      killed: !!killReport,
      timedOut: stopReason === 'timeout' && !!killReport,
    };
  } finally {
    clearTimeout(timer);
    options.abortSignal?.removeEventListener('abort', onAbort);
    await stopPromise?.catch(() => {});
    await stream?.return(undefined);
  }
}

try {
  await owner.start();
  record.sandboxId = owner.sandboxId;
  await save();
  const prerequisites = await capture('command -v setsid && setsid -w true && command -v python3');
  assert.equal(prerequisites.exitCode, 0, 'Prototype requires setsid -w and Python');
  record.prerequisites = prerequisites.stdout;
  const workspace = new Workspace({
    sandbox: {
      id: name,
      name: 'Render process-control feasibility probe',
      provider: 'render-probe',
      status: 'running',
      snapshot: async () => {},
      executeCommand: executeControlled,
    },
  });
  const tools = await createWorkspaceTools(workspace);
  for (const mode of ['normal', 'abort', 'timeout']) {
    const prefix = `/tmp/${name}-${mode}`;
    const child = `import time,pathlib; time.sleep(3); pathlib.Path('${prefix}-child').write_text('survived')`;
    const parent = `import subprocess,os,sys,time,pathlib; c=subprocess.Popen([sys.executable,'-c',${JSON.stringify(child)}]); print('started:'+str(os.getpid())+' child:'+str(c.pid),flush=True); time.sleep(3); pathlib.Path('${prefix}-parent').write_text('survived'); c.wait()`;
    const unrelated = capture(`sleep 3; printf preserved > ${quote(`${prefix}-unrelated`)}`);
    unrelated.catch(() => {});
    const controller = new AbortController();
    const item = { mode };
    record.cases.push(item);
    let output = '';
    item.toolOutput = await tools.mastra_workspace_execute_command.execute(
      { command: `python3 -u -c ${quote(parent)}`, timeout: mode === 'timeout' ? 1 : 10 },
      {
        abortSignal: controller.signal,
        writer: {
          custom: async event => {
            if (event.type === 'data-sandbox-stdout') {
              output += event.data.output;
              const match = output.match(/started:(\d+) child:(\d+)/);
              if (match) {
                item.pids = [Number(match[1]), Number(match[2])];
                if (mode === 'abort') controller.abort();
              }
            }
            if (event.type === 'data-sandbox-exit') item.exitEvent = event.data;
          },
        },
      },
    );
    await save();
    assert.equal(item.pids?.length, 2);
    if (mode !== 'normal') await delay(4000);
    const inspect = `import json,os,pathlib\npids=${JSON.stringify(item.pids)}\ndef alive(pid):\n try:\n  os.kill(pid,0)\n  return True\n except ProcessLookupError:\n  return False\nprint(json.dumps({'alive':[alive(p) for p in pids],'markers':[pathlib.Path('${prefix}-'+k).exists() for k in ['parent','child']],'unrelated':pathlib.Path('${prefix}-unrelated').read_text()}))`;
    assert.equal((await unrelated).exitCode, 0);
    const observed = await capture(`python3 -c ${quote(inspect)}`);
    assert.equal(observed.exitCode, 0);
    item.observed = JSON.parse(observed.stdout);
    assert.deepEqual(item.observed.alive, [false, false]);
    assert.deepEqual(item.observed.markers, mode === 'normal' ? [true, true] : [false, false]);
    assert.equal(item.observed.unrelated, 'preserved');
    assert.equal(item.exitEvent.killed, mode !== 'normal');
    assert.equal(item.exitEvent.timedOut, mode === 'timeout');
    item.sandboxState = (await api.get(owner.sandboxId)).status;
    assert.equal(item.sandboxState, 'running');
    if (mode === 'normal') assert.equal(item.exitEvent.exitCode, 0);
    item.result = 'PASS';
    console.log(`${mode}: PASS; unrelated work preserved and sandbox still running`);
    await save();
  }
  record.result = 'PASS';
} catch (error) {
  record.result = 'FAIL';
  record.error = `${error.name}: ${error.message}`;
  process.exitCode = 1;
} finally {
  try {
    await owner.destroy();
    if (owner.sandboxId) record.cleanup = await confirmTermination(client, owner.sandboxId);
  } finally {
    record.finishedAt = new Date().toISOString();
    await save();
  }
}
console.log(JSON.stringify(record, null, 2));
