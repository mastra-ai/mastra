import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const START_PROMPT = 'Start a slow steered slash command rendering run.';
const COMMAND_TEMPLATE = 'STEERED_SLASH_COMMAND_RENDERED_TEMPLATE';

export const steeredSlashCommandRenderingScenario = {
  name: 'steered-slash-command-rendering',
  description: 'Keeps a delivered custom slash command visible after it is sent as a signal during an active run.',
  testName: 'renders a delivered steered custom slash command after signal acceptance',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'steered-slash-command-rendering.json',
  prepare({ projectDir }) {
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(
      join(commandsDir, 'steer-render.md'),
      `---\ndescription: Steered slash render command\n---\n${COMMAND_TEMPLATE}\n`,
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: project/i, terminal);

    terminal.submit(START_PROMPT);
    await runtime.waitForScreenText(/Start a slow steered slash command rendering run\./i, terminal);
    await runtime.waitForScreenText(/still active/i, terminal, 20_000);

    terminal.submit('//steer-render');
    await runtime.waitForScreenText(/\/\/steer-render\s+pending/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/STEERED_SLASH_COMMAND_RENDERED_TEMPLATE/i, terminal, 1_000);
    runtime.printScreen('after steered slash command is pending', terminal);

    await runtime.waitForScreenText(/Steered slash command response completed\./i, terminal, 20_000);
    await runtime.waitForScreenTextAbsent(/\/\/steer-render\s+pending/i, terminal, 8_000);
    await runtime.waitForScreenText(/STEERED_SLASH_COMMAND_RENDERED_TEMPLATE/i, terminal, 8_000);
    await runtime.waitForScreenText(/\/steer-render/i, terminal, 8_000);
    runtime.printScreen('after steered slash command delivered', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected initial and steered slash AIMock requests, received ${requests.length}`);
    }

    const body = JSON.stringify(requests.map((request: any) => request.body));
    if (!body.includes(START_PROMPT)) {
      throw new Error(`Expected initial prompt in AIMock requests: ${body.slice(0, 2000)}`);
    }
    if (!body.includes(COMMAND_TEMPLATE)) {
      throw new Error(`Expected steered slash command content in AIMock requests: ${body.slice(0, 3000)}`);
    }
  },
} satisfies McE2eScenario;
