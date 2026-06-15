import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const streamingToolArgsScenario: McE2eScenario = {
  name: 'streaming-tool-args',
  description: 'Use a streamed AIMock view tool call and verify streamed args render and settle in the TUI.',
  testName: 'renders live partial tool args from an AIMock streamed tool call',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'streaming-tool-args.json',
  prepare({ projectDir }) {
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, 'streaming-args.ts'),
      Array.from({ length: 30 }, (_, index) => `export const line${index + 1} = ${index + 1};`).join('\n') + '\n',
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Inspect the streaming args fixture file.');

    await runtime.waitForScreenText(/view\s+src\/streaming-args\.ts/i, terminal, 8_000);
    await runtime.sleep(400);
    if (terminal.serialize().view.includes('src/streaming-args.ts:12-18')) {
      throw new Error('Expected partial streamed args before final view range appeared');
    }
    await runtime.waitForScreenText(/src\/streaming-args\.ts:12-18/i, terminal, 8_000);
    await runtime.waitForScreenText(/export const line12 = 12/i, terminal, 8_000);
    await runtime.waitForScreenText(/Streaming view tool e2e complete\./i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected streaming tool args scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const second = JSON.stringify(requests[1]);
    if (!second.includes('call_streaming_args_e2e_view') || !second.includes('src/streaming-args.ts')) {
      throw new Error('Expected second AIMock request to include the view tool result');
    }
  },
};
