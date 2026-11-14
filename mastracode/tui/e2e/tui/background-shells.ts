import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTool } from '@mastra/core/tools';
import { expect, vi } from 'vitest';
import { z } from 'zod/v3';

import type { McE2eScenario } from './types.js';

let slowProbeStarted = false;
let slowProbeAborted = false;

// Holds the parent run open until it is aborted, so Esc lands while a background shell runs.
const slowProbe = createTool({
  id: 'slow_probe',
  description: 'E2E-only tool that waits until the run is aborted.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    slowProbeStarted = true;
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 60_000);
      context?.abortSignal?.addEventListener(
        'abort',
        () => {
          slowProbeAborted = true;
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
    return { marker: 'SLOW_PROBE_DONE' };
  },
});

export const backgroundShellsScenario = {
  name: 'background-shells',
  description: 'Run shells in the background: exit notices wake the agent, Esc leaves them running, Ctrl+G kills them.',
  testName: 'reports background shell exits to the agent and lets the user inspect and kill a running shell',
  useOpenAIModel: true,
  aimockFixture: 'background-shells.json',
  prepare({ appDataDir }) {
    const path = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(path, 'utf8'));
    settings.backgroundTools = { enabled: true };
    writeFileSync(path, JSON.stringify(settings, null, 2));
  },
  inProcessApp({ startMastraCodeApp }) {
    slowProbeStarted = false;
    slowProbeAborted = false;
    return startMastraCodeApp({
      config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false, extraTools: { slow_probe: slowProbe } },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    terminal.resize(140, 80);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    // The parent finishes its turn while the build runs; the build's exit then wakes it.
    terminal.submit('Start the build in the background.');
    await runtime.waitForOutputText(/PARENT_CONTINUED/, terminal, 20_000);
    expect(terminal.serialize().view).not.toContain('SAW_BUILD_EXIT');
    await runtime.waitForOutputText(/SAW_BUILD_EXIT/, terminal, 30_000);
    await runtime.waitForScreenText(/↳ Shell finished · Running the slow build \(exit 3\)/, terminal, 10_000);
    await runtime.waitForScreenText(/Running the slow build\s+exit 3/, terminal, 10_000);

    // Esc stops the parent run, not the shell it started.
    terminal.submit('Start the dev server in the background.');
    await runtime.waitForScreenText(/slow_probe/, terminal, 20_000);
    await vi.waitFor(() => expect(slowProbeStarted).toBe(true), { timeout: 20_000 });
    terminal.write('\x1b');
    await vi.waitFor(() => expect(slowProbeAborted).toBe(true), { timeout: 10_000 });
    await runtime.waitForScreenText(/Starting the dev server\s+started/, terminal, 10_000);

    terminal.write('\x07');
    await runtime.waitForScreenText(/Background activity/, terminal, 10_000);
    await runtime.waitForScreenText(/◌ \$ Starting the dev server/, terminal, 10_000);
    await runtime.waitForScreenText(/running · PID/, terminal, 10_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/SERVER_READY/, terminal, 10_000);
    await runtime.waitForScreenText(/running · PID/, terminal, 10_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Esc close/, terminal, 10_000);

    // Killing it from the list posts no exit notice, so the agent is not woken.
    terminal.write('\x07');
    await runtime.waitForScreenText(/◌ \$ Starting the dev server/, terminal, 10_000);
    terminal.write('d');
    // The row turns `killed` from the exit event, which is published after any notice would have been sent.
    await runtime.waitForScreenText(/Starting the dev server\s+killed/, terminal, 10_000);
    const view = terminal.serialize().view;
    expect(view).not.toContain('Shell finished · Starting the dev server');
    expect(view).not.toContain('UNEXPECTED_MODEL_CALL');

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    // The exit notice carries the output tail; the killed server's output never reaches the model.
    // The commands build the markers from two strings, so only their output contains them.
    expect(serialized).toContain('BUILD_OUTPUT_MARKER');
    expect(serialized).not.toContain('SERVER_READY');
  },
} satisfies McE2eScenario;
