import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const AGENTS_PHRASE = 'PROJECT AGENTS E2E INSTRUCTION: prefer the raven answer.';
const CLAUDE_PHRASE = 'CLAUDE FALLBACK E2E INSTRUCTION: this should not win.';
const SINGULAR_PHRASE = 'SINGULAR AGENT E2E INSTRUCTION: this should be ignored.';

function stringifyRequests(requests: unknown[]): string {
  return JSON.stringify(requests);
}

export const promptContextInstructionsScenario: McE2eScenario = {
  name: 'prompt-context-instructions',
  description: 'Verify project instruction files reach the real model request built from a TUI prompt.',
  testName: 'injects winning project instructions into the AIMock-backed TUI model request',
  skipReason: 'current main no longer includes fixture AGENTS.md content in this TUI model request path',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'prompt-context-instructions.json',
  prepare({ projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'AGENTS.md'), AGENTS_PHRASE);
    writeFileSync(join(projectDir, 'CLAUDE.md'), CLAUDE_PHRASE);
    writeFileSync(join(projectDir, 'AGENT.md'), SINGULAR_PHRASE);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Project:|Resource ID:|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Confirm the active project instruction phrase.');
    await runtime.waitForScreenText(/MC prompt context instruction response/i, terminal);
    runtime.printScreen('after prompt-context prompt', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const body = stringifyRequests(requests);
    expect(body).toContain(AGENTS_PHRASE);
    expect(body).not.toContain(CLAUDE_PHRASE);
    expect(body).not.toContain(SINGULAR_PHRASE);
  },
};
