import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const fileAutocompleteScenario = {
  name: 'file-autocomplete',
  description: 'shows and inserts @ file autocomplete suggestions from an isolated fixture project',
  testName: 'inserts a file reference from real TUI autocomplete',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    const srcDir = join(projectDir, 'src');
    const binDir = join(projectDir, '.bin');
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(srcDir, 'autocomplete-target.ts'), 'export const target = true;\n');
    writeFileSync(join(srcDir, 'another-file.md'), '# another fixture\n');

    const fdPath = join(binDir, 'fd');
    writeFileSync(
      fdPath,
      '#!/bin/sh\nPROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)\n[ -f "$PROJECT_DIR/src/autocomplete-target.ts" ] || exit 0\nprintf "%s\\n" "src/autocomplete-target.ts" "src/another-file.md"\n',
    );
    chmodSync(fdPath, 0o755);
  },
  env({ projectDir }) {
    return { PATH: `${join(projectDir, '.bin')}:${process.env.PATH ?? ''}` };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Branch: feature\/super-long-branch-name/i, terminal);
    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);

    for (const char of 'Attach @auto') {
      terminal.write(char);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/Attach @auto/i, terminal, 10_000);
    await runtime.waitForScreenText(/autocomplete-target\.ts/i, terminal, 30_000);
    runtime.printScreen('file autocomplete suggestions', terminal);

    terminal.write('\t');
    await runtime.waitForScreenText(/Attach @src\/autocomplete-target\.ts/i, terminal);
    runtime.printScreen('file autocomplete inserted', terminal);
  },
} satisfies McE2eScenario;
