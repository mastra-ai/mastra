import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const toolSuspensionSameRunResumeScenario: McE2eScenario = {
  name: 'tool-suspension-same-run-resume',
  description: 'Answer an ask_user prompt and verify the same-run-id resumed stream reaches the real TUI.',
  testName: 'resumes same-run-id tool suspension through the real TUI subscription',
  useOpenAIModel: true,
  aimockFixture: 'tool-suspension-same-run-resume.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('Run the same-run tool suspension resume e2e.');
    await runtime.waitForScreenText(/Which environment should the same-run resume test use\?/i, terminal, 10_000);
    runtime.printScreen('ask_user prompt visible', terminal);

    terminal.write('Preview');
    terminal.write('\r');

    await runtime.waitForScreenText(/Same-run resume complete for Preview\./i, terminal, 15_000);
    runtime.printScreen('after same-run resume completion', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    if (!serialized.includes('call_same_run_resume_env')) {
      throw new Error('Expected AIMock requests to include the ask_user tool call id');
    }
    if (!serialized.includes('Preview')) {
      throw new Error('Expected AIMock requests to include the ask_user resume answer');
    }
    if (requests.length < 2) {
      throw new Error(`Expected at least 2 AIMock requests for suspend + resume, received ${requests.length}`);
    }
  },
};
