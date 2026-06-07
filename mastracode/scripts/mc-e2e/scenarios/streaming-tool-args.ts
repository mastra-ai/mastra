import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const streamingToolArgsScenario: McE2eScenario = {
  name: 'streaming-tool-args',
  description: 'Emit live Harness tool-input events and verify streamed args render and settle in the TUI.',
  testName: 'renders live partial tool args from Harness display-state buffers',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-streaming-tool-args-entrypoint.ts'),
      `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
});

const emit = event => result.harness.emit(event);
setTimeout(() => {
  const toolCallId = 'streaming-tool-args-e2e';
  emit({ type: 'agent_start', agentId: 'code-agent', runId: 'streaming-tool-args-run' });
  emit({ type: 'tool_input_start', toolCallId, toolName: 'view' });
  setTimeout(() => emit({ type: 'tool_input_delta', toolCallId, argsTextDelta: '{"path":"src/streaming' }), 300);
  setTimeout(() => emit({ type: 'tool_input_delta', toolCallId, argsTextDelta: '-args.ts"' }), 800);
  setTimeout(() => emit({ type: 'tool_input_delta', toolCallId, argsTextDelta: ',"offset":12,"limit":7}' }), 1_800);
  setTimeout(() => emit({ type: 'tool_input_end', toolCallId }), 2_300);
  setTimeout(() => emit({
    type: 'tool_start',
    toolCallId,
    toolName: 'view',
    args: { path: 'src/streaming-args.ts', offset: 12, limit: 7 },
  }), 2_500);
  setTimeout(() => emit({
    type: 'tool_end',
    toolCallId,
    toolName: 'view',
    result: { content: 'streamed final result line', isError: false },
    isError: false,
  }), 3_100);
}, 2_500);

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-streaming-tool-args-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    await runtime.waitForScreenText(/view\s+src\/streaming-args\.ts/i, terminal, 8_000);
    await runtime.sleep(500);
    if (terminal.serialize().view.includes('src/streaming-args.ts:12-18')) {
      throw new Error('Expected partial streamed args before final view range appeared');
    }
    await runtime.waitForScreenText(/src\/streaming-args\.ts:12-18/i, terminal, 8_000);
    await runtime.waitForScreenText(/streamed final result line/i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
};
