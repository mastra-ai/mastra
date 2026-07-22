import { z } from 'zod/v3';

import type { McE2eScenario } from './types.js';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function visit(value: unknown, visitor: (value: JsonObject) => void): void {
  if (!value || typeof value !== 'object') return;
  if (isObject(value)) visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, visitor);
    return;
  }
  for (const child of Object.values(value as JsonObject)) visit(child, visitor);
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function count(text: string, value: string): number {
  return text.split(value).length - 1;
}

const delayedProbeTool = {
  id: 'background_probe',
  description: 'E2E-only deterministic tool for deferred, awaited, and failed background execution.',
  background: { enabled: true },
  inputSchema: z.object({
    label: z.string(),
    fail: z.boolean().optional(),
  }),
  execute: async (input: unknown) => {
    const values = isObject(input) ? input : {};
    await new Promise(resolve => setTimeout(resolve, 100));
    if (values.fail === true) throw new Error(`BACKGROUND_PROBE_FAILURE:${String(values.label)}`);
    return { marker: `BACKGROUND_PROBE_RESULT:${String(values.label)}` };
  },
};

export const backgroundSubagentsScenario = {
  name: 'background-subagents',
  description: 'Exercise deferred and awaited tools plus bounded nested subagent background work in the real TUI.',
  testName: 'keeps background tool and delegated-subagent lifecycle output ordered and deduplicated',
  useOpenAIModel: true,
  aimockFixture: 'background-subagents.json',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        extraTools: { background_probe: delayedProbeTool },
        unixSocketPubSub: false,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    terminal.resize(120, 100);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit('Run the deterministic background tools and bounded subagents e2e flow.');
    await runtime.waitForOutputText(/BACKGROUND_SUBAGENTS_COMPLETE/i, terminal, 60_000);

    const output = terminal.serialize().view;
    const markers = [
      'DEFERRED_PARENT_CONTINUED',
      'DEFERRED_WORK_COMPLETED',
      'AWAITED_WORK_COMPLETED',
      'AWAITED_FAILURE_SURFACED',
      'DEEP_DELEGATION_FOREGROUND',
      'NESTED_BACKGROUND_COMPLETED',
      'BACKGROUND_SUBAGENTS_COMPLETE',
    ];

    for (const marker of markers) {
      check(count(output, marker) === 1, `Expected exactly one visible ${marker} marker.\n${output}`);
    }

    for (let index = 1; index < markers.length; index++) {
      check(
        output.indexOf(markers[index - 1]!) < output.indexOf(markers[index]!),
        `Expected ${markers[index - 1]} before ${markers[index]}.\n${output}`,
      );
    }

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const backgroundArguments: JsonObject[] = [];
    let nestedDelegationWithoutOverride = false;

    visit(requests, value => {
      let argumentsValue = value.arguments;
      if (typeof argumentsValue === 'string') {
        try {
          argumentsValue = JSON.parse(argumentsValue);
        } catch {
          return;
        }
      }
      if (value.name === 'background_probe' && isObject(argumentsValue)) {
        backgroundArguments.push(argumentsValue);
      }
      if (
        value.name === 'subagent' &&
        isObject(argumentsValue) &&
        argumentsValue.task === 'Return the exact marker DEEP_DELEGATION_FOREGROUND.' &&
        !('_background' in argumentsValue)
      ) {
        nestedDelegationWithoutOverride = true;
      }
    });

    const dispositions = backgroundArguments
      .map(argumentsValue => argumentsValue._background)
      .filter(isObject)
      .map(background => background.disposition);

    check(dispositions.includes('deferred'), `Expected a deferred background probe call: ${JSON.stringify(requests)}`);
    check(dispositions.includes('awaited'), `Expected awaited background probe calls: ${JSON.stringify(requests)}`);
    check(
      backgroundArguments.some(argumentsValue => argumentsValue.fail === true),
      `Expected an induced background probe failure: ${JSON.stringify(requests)}`,
    );
    check(
      nestedDelegationWithoutOverride,
      `Expected foreground nested delegation without _background: ${JSON.stringify(requests)}`,
    );
  },
} satisfies McE2eScenario;
