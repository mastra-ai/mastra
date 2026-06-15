import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

export const subagentDelegationScenario: McE2eScenario = {
  name: 'subagent-delegation',
  description: 'Delegate to an AIMock-driven Explore subagent and render completed subagent activity in the TUI.',
  testName: 'renders real TUI subagent delegation and completed result activity',
  useOpenAIModel: true,
  aimockFixture: 'subagent-delegation.json',
  prepare({ projectDir }) {
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'subagent-marker.ts'),
      'export const SUBAGENT_E2E_MARKER = "subagent-delegation";\n',
      'utf8',
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Delegate an explore subagent to find the e2e marker.');

    await runtime.waitForScreenText(/Find the SUBAGENT_E2E_MARKER symbol/i, terminal, 10_000);
    await runtime.waitForScreenText(/subagent\s+explore\s+openai\/gpt-5\.4-mini.*✓/i, terminal, 10_000);
    await runtime.waitForScreenText(
      /Explore subagent e2e result: SUBAGENT_E2E_MARKER is defined in src\/subagent-marker\.ts/i,
      terminal,
      10_000,
    );

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 3) {
      throw new Error(`Expected subagent delegation scenario to make 3 AIMock requests, received ${requests.length}`);
    }
    const serialized = JSON.stringify(requests);
    if (!serialized.includes('call_subagent_delegation_e2e') || !serialized.includes('agentType')) {
      throw new Error('Expected parent request flow to include the subagent tool call.');
    }
    if (!serialized.includes('Find the SUBAGENT_E2E_MARKER symbol')) {
      throw new Error('Expected the delegated Explore subagent task to reach the subagent model request.');
    }
    if (!serialized.includes('Explore subagent e2e result')) {
      throw new Error('Expected parent follow-up request to include the subagent tool result.');
    }
  },
};
