import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { runScenario } from './harness';

/**
 * Web equivalent of MastraCode's tool-approval flow: with auto-approve OFF, a
 * write tool surfaces a `tool_approval_required` prompt. Approving it (the web
 * ApprovalCard) lets the tool execute and the file lands on disk.
 */
describe('web scenario: tool-approval', () => {
  it('surfaces an approval prompt and executes the tool once approved', async () => {
    await runScenario({
      name: 'tool-approval',
      description: 'A write tool requires approval; approving it runs the tool.',
      aimockFixture: 'tool-approval.json',
      server: { workspace: true, yolo: false },
      run: async ({ driver, workspaceRoot }) => {
        await driver.submit('Write notes.txt with the text draft');

        const prompt = await driver.waitForApproval();
        if (prompt.toolName !== 'mastra_workspace_write_file') {
          throw new Error(`expected write_file approval, got ${prompt.toolName}`);
        }

        await driver.approve(true);
        await driver.waitForText('Wrote notes.txt');

        const written = readFileSync(join(workspaceRoot!, 'notes.txt'), 'utf8');
        expect(written).toBe('draft');
      },
    });
  });
});
