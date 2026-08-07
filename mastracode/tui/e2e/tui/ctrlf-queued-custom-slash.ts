import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const CTRL_F = '\x06';
const START_PROMPT = 'Start a slow Ctrl F custom slash queue run.';
const COMMAND_TEMPLATE = 'Queued custom slash autocomplete template.';
const EXPANDED_COMMAND_CONTENT = 'Queued custom slash autocomplete template.';

export const ctrlfQueuedCustomSlashScenario = {
  name: 'ctrlf-queued-custom-slash',
  description: 'Queues a custom slash command via Ctrl+F after slash autocomplete resolves during an active run.',
  testName: 'queues and drains a Ctrl+F custom slash command selected through autocomplete',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'ctrlf-queued-custom-slash.json',
  prepare({ projectDir }) {
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(
      join(commandsDir, 'queue-auto.md'),
      `---\ndescription: Queue command selected from autocomplete\n---\n${COMMAND_TEMPLATE}\n`,
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: project/i, terminal);

    terminal.submit(START_PROMPT);
    await runtime.waitForScreenText(/Initial Ctrl F custom slash run is still streaming/i, terminal, 8_000);

    terminal.write('/queue-au');
    await runtime.waitForScreenText(/Queue command selected from autocomplete/i, terminal, 8_000);
    terminal.write(CTRL_F);
    await runtime.waitForScreenText(/1 queued/i, terminal, 8_000);
    runtime.printScreen('after Ctrl+F queued custom slash command', terminal);

    await runtime.waitForScreenText(/Queued custom slash autocomplete template\./i, terminal, 18_000);
    await runtime.waitForScreenText(/Queued custom slash autocomplete response\./i, terminal, 12_000);
    runtime.printScreen('after queued custom slash command drained', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected initial and queued custom slash AIMock requests, received ${requests.length}`);
    }

    const body = JSON.stringify(requests.map((request: any) => request.body));
    if (!body.includes(START_PROMPT)) {
      throw new Error(`Expected initial prompt in AIMock requests: ${body.slice(0, 2000)}`);
    }
    if (!body.includes(EXPANDED_COMMAND_CONTENT)) {
      throw new Error(`Expected queued custom command content in AIMock requests: ${body.slice(0, 3000)}`);
    }
  },
} satisfies McE2eScenario;
