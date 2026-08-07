import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

const PLAN_TASK = 'Draft a plan for verifying SUBAGENT_PLAN_E2E without editing files.';
const EXECUTE_TASK = 'Create the subagent execute output file with SUBAGENT_EXECUTE_E2E content.';

function findRequestBodyContaining(requests: unknown[], needle: string): any {
  const request = requests.find(candidate => JSON.stringify((candidate as any)?.body).includes(needle));
  if (!request) throw new Error(`Expected AIMock request body to include ${needle}`);
  return (request as any).body;
}

function toolNames(body: any): string[] {
  const tools = body?.tools;
  if (!Array.isArray(tools)) return [];
  return tools.map((tool: any) => tool?.function?.name ?? tool?.name).filter(Boolean);
}

export const subagentPlanExecuteToolsScenario: McE2eScenario = {
  name: 'subagent-plan-execute-tools',
  description: 'Delegate Plan and Execute subagents and verify execute inherits workspace write tools in the real TUI.',
  testName: 'runs Plan and Execute subagents with expected workspace tool boundaries',
  skipReason: 'current main execute subagent does not write expected workspace file in this flow',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'subagent-plan-execute-tools.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Delegate plan and execute subagents for workspace tool boundary verification.');

    await runtime.waitForScreenText(/Draft a plan for verifying SUBAGENT_PLAN_E2E/i, terminal, 10_000);
    await runtime.waitForScreenText(/Create the subagent execute output file/i, terminal, 10_000);
    await runtime.waitForScreenText(/subagent\s+plan\s+openai\/gpt-5\.4-mini.*✓/i, terminal, 15_000);
    await runtime.waitForScreenText(/subagent\s+execute\s+openai\/gpt-5\.4-mini.*✓/i, terminal, 15_000);
    await runtime.waitForScreenText(/Parent received Plan and Execute subagent results\./i, terminal, 20_000);

    terminal.submit("!printf 'SUBAGENT_EXECUTE_CAT=' && cat subagent-execute-output.txt");
    await runtime.waitForScreenText(/SUBAGENT_EXECUTE_CAT=SUBAGENT_EXECUTE_FILE_WRITTEN_E2E/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 5) {
      throw new Error(`Expected subagent plan/execute scenario to make 5 AIMock requests, received ${requests.length}`);
    }

    const serialized = JSON.stringify(requests);
    for (const needle of [
      'call_subagent_plan_e2e',
      'call_subagent_execute_e2e',
      PLAN_TASK,
      EXECUTE_TASK,
      'call_subagent_execute_write_file',
      'Parent received Plan and Execute subagent results.',
    ]) {
      if (!serialized.includes(needle)) throw new Error(`Expected AIMock flow to include ${needle}`);
    }

    const planTools = toolNames(findRequestBodyContaining(requests, PLAN_TASK));
    if (planTools.includes('write_file')) {
      throw new Error('Expected Plan subagent request to omit write_file from its available tools.');
    }

    const executeTools = toolNames(findRequestBodyContaining(requests, EXECUTE_TASK));
    if (!executeTools.includes('write_file')) {
      throw new Error('Expected Execute subagent request to include write_file in its available tools.');
    }
  },
};
