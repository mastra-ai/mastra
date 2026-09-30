import type { ExperimentalAgent } from '@mastra/code-sdk/onboarding/settings';

import { expect } from 'vitest';

import type { McE2eScenario } from './types.js';

function experimentalAgentRuntimeScenario(selection: ExperimentalAgent): McE2eScenario {
  const expectedEngine = selection === 'evented' ? 'evented' : 'default';
  let startupDiagnostics: string[] = [];

  return {
    name: `experimental-agent-${selection}`,
    description: `Run a real Mastra Code chat on the ${selection} experimental agent implementation.`,
    testName: `streams a chat response on the ${selection} experimental agent`,
    useOpenAIModel: true,
    aimockFixture: 'automated-chat.json',
    env() {
      return { MASTRACODE_EXPERIMENTAL_AGENT: selection };
    },
    async inProcessApp({ startMastraCodeApp }) {
      startupDiagnostics = [];
      const originalInfo = console.info;
      console.info = (...args: unknown[]) => {
        startupDiagnostics.push(args.map(String).join(' '));
        originalInfo(...args);
      };
      try {
        return await startMastraCodeApp({
          onCreated({ codeAgent, controller, session }) {
            const workflow = (codeAgent as unknown as { getWorkflow(): { engineType?: string } }).getWorkflow();
            expect(workflow.engineType).toBe(expectedEngine);
            expect(controller.getCurrentAgent(session)).toBe(codeAgent);
          },
        });
      } finally {
        console.info = originalInfo;
      }
    },
    async run({ terminal, runtime }) {
      runtime.startLiveOutput(terminal);
      await runtime.waitForScreenText(/Mastra Code|Build|Plan|Fast|Type|Press|>/i, terminal);
      expect(startupDiagnostics).toContain(`Experimental agent: ${selection} (workflow engine: ${expectedEngine})`);

      terminal.submit('Return the configured Mastra Code e2e smoke phrase.');
      await runtime.waitForScreenText(/MC automated chat smoke response/i, terminal, 20_000);
      expect(terminal.serialize().view.match(/▐build▌/g) ?? []).toHaveLength(1);

      terminal.submit('/thread');
      await runtime.waitForScreenText(/Title: \(untitled\)[\s\S]*ID: [0-9a-f-]+/i, terminal);
      terminal.keyCtrlC();
    },
  };
}

export const experimentalAgentDurableScenario = experimentalAgentRuntimeScenario('durable');
export const experimentalAgentEventedScenario = experimentalAgentRuntimeScenario('evented');
