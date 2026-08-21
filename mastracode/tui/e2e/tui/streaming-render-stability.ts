import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import stripAnsi from 'strip-ansi';
import type { McE2eScenario } from './types.js';

const MARKERS = [
  'TOOL_BOUNDARY_CONTENT',
  'Streaming stability complete.',
  'const STREAM_FENCE = true;',
  'STREAM_LIST_ONE',
  'STREAM_LIST_TWO',
  'STREAM_EMPHASIS',
] as const;

function assertStableOutput(view: string): void {
  const output = stripAnsi(view);
  let previousIndex = -1;
  for (const marker of MARKERS) {
    const firstIndex = output.indexOf(marker);
    const lastIndex = output.lastIndexOf(marker);
    if (firstIndex < 0) throw new Error(`Expected final streaming output to include ${marker}`);
    if (firstIndex !== lastIndex) throw new Error(`Expected ${marker} exactly once in final streaming output`);
    if (firstIndex <= previousIndex) throw new Error(`Expected ${marker} after the preceding stream/tool marker`);
    previousIndex = firstIndex;
  }
}

export const streamingRenderStabilityScenario: McE2eScenario = {
  name: 'streaming-render-stability',
  description:
    'Preserve streamed Markdown and tool ordering through coalesced rendering, resize, and theme invalidation.',
  testName: 'renders tiny Markdown deltas once in order across a tool boundary, resize, and theme change',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'streaming-render-stability.json',
  prepare({ projectDir }) {
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(join(projectDir, 'src', 'streaming-render-stability.ts'), 'TOOL_BOUNDARY_CONTENT\n');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    terminal.resize(120, 40);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Exercise streaming render stability.');
    await runtime.waitForScreenText(/STREAM_EMPHASIS/, terminal, 15_000);
    assertStableOutput(terminal.serialize().view);

    terminal.resize(96, 40);
    await runtime.sleep(150);
    assertStableOutput(terminal.serialize().view);

    terminal.submit('/theme light');
    await runtime.waitForScreenText(/Theme set to light/i, terminal);
    assertStableOutput(terminal.serialize().view);

    runtime.printScreen('streaming render stability', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(
        `Expected streaming render stability scenario to make 2 AIMock requests, received ${requests.length}`,
      );
    }
    const second = JSON.stringify(requests[1]);
    for (const marker of ['call_streaming_render_stability', 'TOOL_BOUNDARY_CONTENT']) {
      if (!second.includes(marker)) throw new Error(`Expected second AIMock request to include ${marker}`);
    }
  },
};
