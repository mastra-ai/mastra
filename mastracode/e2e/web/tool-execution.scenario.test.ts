import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Web equivalent of MastraCode's `workspace-tool-*` scenarios: the agent runs
 * real workspace tools (write then read a file). The tool cards render in the
 * transcript, and the file actually lands on disk in the sandboxed workspace.
 */
describe('web scenario: tool-execution', () => {
  it('runs real workspace file tools and renders the tool cards', async () => {
    await runScenario({
      name: 'tool-execution',
      description: 'Agent writes then reads a file via real workspace tools; the file lands on disk.',
      aimockFixture: 'tool-execution.json',
      server: { workspace: true },
      run: async ({ driver, workspaceRoot }) => {
        await driver.submit('Create greeting.txt that says hello world');

        // The write + read tool cards render in the transcript.
        await driver.waitForText('mastra_workspace_write_file');
        await driver.waitForText('mastra_workspace_read_file');
        await driver.waitForText('Created greeting.txt');

        // And the tool genuinely wrote to the sandboxed workspace.
        const written = readFileSync(join(workspaceRoot!, 'greeting.txt'), 'utf8');
        expect(written).toBe('hello world');
      },
    });
  });
});
