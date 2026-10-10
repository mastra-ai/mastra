import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { Workspace, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
import { ModalSandbox } from '@mastra/modal';
import { afterAll, expect, it, vi } from 'vitest';

// Only the cloud SDK boundary is substituted. The real ModalSandbox,
// ModalProcessManager, ProcessHandle and Mastra tool execute unchanged.
const sdk = vi.hoisted(() => ({ remote: null }));
vi.mock('modal', () => ({
  NotFoundError: class NotFoundError extends Error {},
  ClientClosedError: class ClientClosedError extends Error {},
  ModalClient: class ModalClient {
    sandboxes = { fromName: async () => sdk.remote };
  },
}));

const evidence = {
  commit: '918704fd4608aa4d9d90d4d92c0a3429de2b880a',
  core: '1.75.0',
  modal: '0.7.1',
  startedAt: new Date().toISOString(),
  cases: [],
};
const base = resolve('runs');
await mkdir(base, { recursive: true });
const run = await mkdtemp(join(base, 'cancellation-'));
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const code = marker =>
  `const fs=require('node:fs'); process.stdout.write('started:'+process.pid+'\\n'); setTimeout(()=>fs.writeFileSync(${JSON.stringify(marker)},'survived'),500);`;
const command = marker => `${quote(process.execPath)} -e ${quote(code(marker))}`;

function streamFrom(childStream, state) {
  let canceled = false;
  return new ReadableStream({
    start(controller) {
      childStream.setEncoding('utf8');
      childStream.on('data', chunk => {
        if (!canceled) controller.enqueue(chunk);
      });
      childStream.on('end', () => {
        if (!canceled) controller.close();
      });
      childStream.on('error', error => {
        if (!canceled) controller.error(error);
      });
    },
    cancel() {
      canceled = true;
      state.readerCancels++;
    },
  });
}

async function modalCase(cancel) {
  const marker = join(run, `modal-${cancel}.txt`);
  const state = { readerCancels: 0, terminateCalls: 0, child: null, exit: null };
  sdk.remote = {
    sandboxId: 'controlled-sdk-boundary',
    exec: async (argv, options) => {
      state.child = spawn(argv[0], argv.slice(1), {
        cwd: options?.workdir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      state.exit = new Promise((resolveExit, reject) => {
        state.child.once('error', reject);
        state.child.once('exit', (code, signal) => resolveExit({ code, signal }));
      });
      return {
        stdout: streamFrom(state.child.stdout, state),
        stderr: streamFrom(state.child.stderr, state),
        wait: async () => (await state.exit).code,
      };
    },
    terminate: async () => {
      state.terminateCalls++;
      if (state.child?.exitCode === null && state.child?.signalCode === null) state.child.kill('SIGKILL');
      await state.exit;
    },
  };
  const workspace = new Workspace({
    sandbox: new ModalSandbox({ id: `modal-check-${cancel}`, workingDirectory: run }),
  });
  const abort = new AbortController();
  let exitEvent;
  let observation;
  try {
    await workspace.init();
    const tools = await createWorkspaceTools(workspace);
    const output = await tools.mastra_workspace_execute_command.execute(
      { command: command(marker) },
      {
        abortSignal: abort.signal,
        writer: {
          custom: async event => {
            if (event.type === 'data-sandbox-stdout' && cancel) abort.abort();
            if (event.type === 'data-sandbox-exit') exitEvent = event.data;
          },
        },
      },
    );
    const aliveWhenToolReturned = state.child.exitCode === null && state.child.signalCode === null;
    const completed = await state.exit;
    observation = {
      provider: 'Modal',
      mode: cancel ? 'cancel' : 'normal',
      evidence:
        'Real source-built adapter and tool; Modal SDK substituted with a real local child process. Not a Modal cloud test.',
      toolOutput: output,
      exitEvent,
      aliveWhenToolReturned,
      eventualProcessExit: completed,
      markerWritten: existsSync(marker),
      readerCancels: state.readerCancels,
      terminateCallsBeforeDestroy: state.terminateCalls,
    };
    if (cancel) {
      expect(exitEvent.killed).toBe(true);
      expect(output).toContain('so it was killed');
      expect(aliveWhenToolReturned).toBe(true);
      expect(state.readerCancels).toBe(2);
      expect(state.terminateCalls).toBe(0);
      expect(completed).toEqual({ code: 0, signal: null });
      expect(existsSync(marker)).toBe(true);
      observation.cancellationReporting = 'FAIL: adapter reports killed while the process continues';
    } else {
      expect(exitEvent.success).toBe(true);
      expect(exitEvent.exitCode).toBe(0);
      expect(output).not.toContain('so it was killed');
      expect(existsSync(marker)).toBe(true);
      observation.cancellationReporting = 'PASS: normal command control';
    }
  } finally {
    await workspace.destroy();
    if (state.child?.exitCode === null && state.child?.signalCode === null) state.child.kill('SIGKILL');
    if (state.exit) await state.exit;
    if (observation) {
      observation.cleanup = 'child process exited; workspace destroyed';
      evidence.cases.push(observation);
    }
  }
}

it('Modal normal command control runs to completion', async () => {
  await modalCase(false);
});
it('Modal adapter reports killed although its SDK process continues', async () => {
  await modalCase(true);
});
it('LocalSandbox live cancellation actually stops the process', async () => {
  const marker = join(run, 'local.txt');
  const workspace = new Workspace({ sandbox: new LocalSandbox({ workingDirectory: run }) });
  const abort = new AbortController();
  let exitEvent, pid;
  try {
    await workspace.init();
    const tools = await createWorkspaceTools(workspace);
    const output = await tools.mastra_workspace_execute_command.execute(
      { command: command(marker) },
      {
        abortSignal: abort.signal,
        writer: {
          custom: async event => {
            if (event.type === 'data-sandbox-stdout' && event.data.output.includes('started:')) {
              pid = Number(event.data.output.match(/started:(\d+)/)?.[1]);
              abort.abort();
            }
            if (event.type === 'data-sandbox-exit') exitEvent = event.data;
          },
        },
      },
    );
    expect(abort.signal.aborted).toBe(true);
    expect(exitEvent.killed).toBe(true);
    expect(output).toContain('so it was killed');
    await delay(700);
    expect(existsSync(marker)).toBe(false);
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') alive = false;
      else throw error;
    }
    expect(alive).toBe(false);
    evidence.cases.push({
      provider: 'LocalSandbox',
      evidence: 'Live local process; no provider or process mocking',
      toolOutput: output,
      exitEvent,
      processStillExists: alive,
      markerWritten: false,
      cancellationReporting: 'PASS: actual process termination confirmed',
      cleanup: 'process absent; workspace destroyed in finally',
    });
  } finally {
    await workspace.destroy();
  }
});

afterAll(async () => {
  await writeFile('other-provider-cancellation.json', JSON.stringify(evidence, null, 2) + '\n');
});
