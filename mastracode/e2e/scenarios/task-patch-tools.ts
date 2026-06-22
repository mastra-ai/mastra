import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const taskPatchToolsScenario: McE2eScenario = {
  name: 'task-patch-tools',
  description: 'Drive task patch/check tools through the real TUI and verify their rendered output.',
  testName: 'patches tasks and renders task check output from real task tools',
  skipReason: 'current main task-state/tool-result request shape no longer matches the AIMock task patch fixture',
  useOpenAIModel: true,
  aimockFixture: 'task-patch-tools.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Exercise task patch tools through real task tools.');

    await runtime.waitForScreenText(/Tasks\s+\[0\/1 completed\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/Verifying task patch e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/Task Status:\s+\[0\/1 completed\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/All tasks completed:\s+NO/i, terminal, 8_000);
    await runtime.waitForScreenText(/Task patch e2e complete\./i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 4) {
      throw new Error(`Expected task patch scenario to make 4 AIMock requests, received ${requests.length}`);
    }

    const serialized = JSON.stringify(requests);
    for (const needle of ['call_task_patch_write', 'call_task_patch_update', 'call_task_patch_check']) {
      if (!serialized.includes(needle)) {
        throw new Error(`Expected AIMock request flow to include ${needle}`);
      }
    }
  },
};
