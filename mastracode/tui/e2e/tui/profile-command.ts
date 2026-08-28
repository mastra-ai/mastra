import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createProcessMemoryDiagnosticsFromEnvironment } from '@mastra/code-sdk/process-memory-diagnostics';

import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const profileCommandScenario: McE2eScenario = {
  name: 'profile-command',
  description: 'Control real process memory diagnostics and verify durable allocation artifacts from the TUI.',
  testName: 'starts, captures, reports, and stops process memory diagnostics',
  env({ appDataDir }) {
    return {
      MASTRACODE_PROFILE: null,
      MASTRACODE_PROFILE_DIR: join(appDataDir, 'profiles'),
    };
  },
  async inProcessApp({ startMastraCodeApp }) {
    const setup = createProcessMemoryDiagnosticsFromEnvironment(process.env);
    const app = await startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        memory: false,
        unixSocketPubSub: false,
      },
      tui: { processMemoryDiagnostics: setup.diagnostics },
    });
    return {
      stop: async () => {
        await app.stop?.();
        await setup.diagnostics.stop();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    terminal.submit('/help');
    await runtime.waitForScreenText(/\/help\s+Show this help/i, terminal);

    terminal.submit('/profile status');
    await runtime.waitForScreenText(/Process memory diagnostics: inactive/i, terminal);

    terminal.submit('/profile start');
    await runtime.waitForScreenText(/Process memory diagnostics started/i, terminal);

    terminal.submit('/profile capture');
    await runtime.waitForScreenText(/Allocation profile captured/i, terminal);

    terminal.submit('/profile status');
    await runtime.waitForScreenText(/Process memory diagnostics: active/i, terminal);

    terminal.submit('/profile stop');
    await runtime.waitForScreenText(/Process memory diagnostics stopped/i, terminal);

    const profileParent = process.env.MASTRACODE_PROFILE_DIR;
    if (!profileParent || !existsSync(profileParent))
      throw new Error('Expected the profile parent directory to exist.');
    const runDirectories = readdirSync(profileParent);
    expect(runDirectories).toHaveLength(1);
    const runDirectory = join(profileParent, runDirectories[0]!);
    const files = readdirSync(runDirectory);

    expect(files).toContain('metadata.json');
    expect(files).toContain('process-samples.jsonl');
    expect(files).toContain('gc-events.jsonl');
    const profiles = files.filter(file => file.endsWith('.heapprofile')).sort();
    expect(profiles).toHaveLength(2);

    JSON.parse(readFileSync(join(runDirectory, 'metadata.json'), 'utf8'));
    const samples = readFileSync(join(runDirectory, 'process-samples.jsonl'), 'utf8').trim().split('\n');
    expect(samples.length).toBeGreaterThan(1);
    for (const sample of samples) JSON.parse(sample);
    for (const profile of profiles) {
      const parsed = JSON.parse(readFileSync(join(runDirectory, profile), 'utf8')) as { head?: unknown };
      if (!parsed.head) throw new Error(`Expected ${profile} to contain a Chrome allocation profile head.`);
    }

    terminal.keyCtrlC();
  },
};
