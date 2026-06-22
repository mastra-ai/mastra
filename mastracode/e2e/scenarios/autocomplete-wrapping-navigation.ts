import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const DOWN = '\x1b[B';
const ENTER = '\r';
const ALPHA_DESCRIPTION =
  'Alpha wrapped autocomplete description begins with readable context and continues across the terminal width until navigation-sentinel-wrap-tail remains visible on a wrapped continuation row.';
const BRAVO_TEMPLATE = 'Bravo wrapped autocomplete navigation template.';

async function typeTextSlowly(terminal: { write: (text: string) => void }, text: string): Promise<void> {
  for (const char of text) {
    terminal.write(char);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

export const autocompleteWrappingNavigationScenario = {
  name: 'autocomplete-wrapping-navigation',
  description: 'Wraps long custom slash descriptions while arrow navigation remains item-based.',
  testName: 'wraps long slash autocomplete descriptions and selects the next item with one Down arrow',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'autocomplete-wrapping-navigation.json',
  prepare({ projectDir }) {
    const commandsDir = join(projectDir, '.mastracode', 'commands');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(
      join(commandsDir, 'wrap-alpha.md'),
      `---\ndescription: ${ALPHA_DESCRIPTION}\n---\nAlpha should not run.\n`,
    );
    writeFileSync(
      join(commandsDir, 'wrap-bravo.md'),
      `---\ndescription: Bravo command selected after exactly one Down arrow from the wrapped alpha item\n---\n${BRAVO_TEMPLATE}\n`,
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project: project/i, terminal);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);

    await typeTextSlowly(terminal, '/wrap-');
    await runtime.waitForScreenText(/Alpha wrapped autocomplete description begins/i, terminal, 30_000);
    await runtime.waitForScreenText(/navigation-sentinel-wrap-tail/i, terminal, 20_000);
    await runtime.waitForScreenText(/Bravo command selected after exactly one Down arrow/i, terminal, 20_000);
    runtime.printScreen('wrapped custom slash autocomplete list', terminal);
    await terminal.flushInput?.();
    await new Promise(resolve => setTimeout(resolve, 200));

    terminal.write(DOWN);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/→ \/wrap-bravo/i, terminal, 30_000);
    terminal.write(ENTER);

    await runtime.waitForScreenText(/Bravo wrapped autocomplete navigation template\./i, terminal, 15_000);
    await runtime.waitForScreenText(/Bravo wrapped autocomplete response\./i, terminal, 12_000);
    runtime.printScreen('after selecting wrapped autocomplete second item', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(
        `Expected one AIMock request for selected wrapped autocomplete command, received ${requests.length}`,
      );
    }

    const body = JSON.stringify((requests[0] as any).body);
    if (!body.includes(BRAVO_TEMPLATE)) {
      throw new Error(`Expected Bravo command template in AIMock request: ${body.slice(0, 2000)}`);
    }
    if (body.includes('Alpha should not run')) {
      throw new Error(
        `Expected Down arrow to select Bravo, but Alpha command template was sent: ${body.slice(0, 2000)}`,
      );
    }
  },
} satisfies McE2eScenario;
