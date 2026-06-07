import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const taskProgressEventsScenario: McE2eScenario = {
  name: 'task-progress-events',
  description: 'Emit live task tool/input events and verify pinned task progress plus completed inline history.',
  testName: 'renders streamed task progress and completion from Harness events',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-task-progress-entrypoint.ts'),
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
const activeTasks = [
  { id: 'plan-task-e2e', content: 'Plan task progress e2e', status: 'completed', activeForm: 'Planning task progress e2e' },
  { id: 'verify-task-e2e', content: 'Verify task progress e2e', status: 'in_progress', activeForm: 'Verifying task progress e2e' },
];
const completedTasks = activeTasks.map(task => ({ ...task, status: 'completed' }));

setTimeout(() => {
  const toolCallId = 'task-progress-events-e2e';
  emit({ type: 'agent_start', agentId: 'code-agent', runId: 'task-progress-events-run' });
  emit({ type: 'tool_input_start', toolCallId, toolName: 'task_write' });
  setTimeout(() => emit({
    type: 'tool_input_delta',
    toolCallId,
    argsTextDelta: JSON.stringify({ tasks: [
      { id: 'plan-task-e2e', content: 'Plan task progress e2e', status: 'in_progress', activeForm: 'Planning task progress e2e' },
      { id: 'verify-task-e2e', content: 'Verify task progress e2e', status: 'pending', activeForm: 'Verifying task progress e2e' },
    ] }),
  }), 500);
  setTimeout(() => emit({ type: 'tool_input_end', toolCallId }), 900);
  setTimeout(() => emit({ type: 'task_updated', tasks: activeTasks }), 1_200);
  setTimeout(() => emit({ type: 'task_updated', tasks: completedTasks }), 2_000);
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
    return join(projectDir, '.mc-e2e-task-progress-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    await runtime.waitForScreenText(/Tasks\s+\[0\/2 completed\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/Planning task progress e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/Verify task progress e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/Tasks\s+\[1\/2 completed\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/Verifying task progress e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/Tasks\s+\[2\/2 completed\]/i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
};
