import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

/**
 * E2E scenario for lifecycle hook events (AgentStart, AgentEnd, Interrupt).
 *
 * Configures a single hook script that logs every event's stdin payload —
 * including `run_id` — to a JSONL file. The scenario starts an agent run,
 * interrupts it mid-stream with Ctrl+C, then asserts that AgentStart, AgentEnd,
 * and Interrupt were all emitted and share the same `run_id`.
 */
export const lifecycleHooksEventsScenario: McE2eScenario = {
  name: 'lifecycle-hooks-events',
  description:
    'Configure lifecycle hooks, run an agent, interrupt it, and verify AgentStart, AgentEnd, and Interrupt events carry the same run_id.',
  testName: 'emits AgentStart, AgentEnd, and Interrupt lifecycle hooks with a shared run_id',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'lifecycle-hooks-events.json',
  env() {
    return { MASTRACODE_DISABLE_HOOKS: '0' };
  },
  prepare({ projectDir }) {
    const hooksDir = join(projectDir, '.mastracode');
    mkdirSync(hooksDir, { recursive: true });

    // Hook script: log the full stdin payload (event name + run_id + relevant
    // fields) to a JSONL file, then exit 0 (lifecycle hooks are non-blocking).
    writeFileSync(
      join(hooksDir, 'lifecycle-hook.cjs'),
      `const fs = require('node:fs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  fs.appendFileSync('.mastracode/lifecycle-events.jsonl', JSON.stringify({
    event: payload.hook_event_name,
    run_id: payload.run_id || null,
    stop_reason: payload.stop_reason || null,
    reason: payload.reason || null,
  }) + '\\n');
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
});
`,
    );

    // Configure AgentStart, AgentEnd, and Interrupt hooks.
    writeFileSync(
      join(hooksDir, 'hooks.json'),
      JSON.stringify(
        {
          AgentStart: [
            {
              type: 'command',
              command: 'node .mastracode/lifecycle-hook.cjs',
              timeout: 5000,
              description: 'log lifecycle events',
            },
          ],
          AgentEnd: [
            {
              type: 'command',
              command: 'node .mastracode/lifecycle-hook.cjs',
              timeout: 5000,
              description: 'log lifecycle events',
            },
          ],
          Interrupt: [
            {
              type: 'command',
              command: 'node .mastracode/lifecycle-hook.cjs',
              timeout: 5000,
              description: 'log lifecycle events',
            },
          ],
        },
        null,
        2,
      ),
    );

    // Assertion script: verify AgentStart, AgentEnd, and Interrupt were logged
    // with a shared run_id, and AgentEnd has stop_reason 'aborted'.
    writeFileSync(
      join(hooksDir, 'assert-lifecycle.cjs'),
      `const fs = require('node:fs');
const raw = fs.readFileSync('.mastracode/lifecycle-events.jsonl', 'utf8').trim();
if (!raw) {
  console.error('No lifecycle events logged');
  process.exit(1);
}
const lines = raw.split(/\\n+/).map(line => JSON.parse(line));

const agentStart = lines.find(e => e.event === 'AgentStart' && e.run_id);
if (!agentStart) {
  console.error('Missing AgentStart with run_id', lines);
  process.exit(1);
}

const agentEnd = lines.find(e => e.event === 'AgentEnd' && e.run_id);
if (!agentEnd) {
  console.error('Missing AgentEnd with run_id', lines);
  process.exit(1);
}

if (agentEnd.stop_reason !== 'aborted') {
  console.error('Expected AgentEnd stop_reason to be aborted', agentEnd);
  process.exit(1);
}

const interrupt = lines.find(e => e.event === 'Interrupt' && e.run_id);
if (!interrupt) {
  console.error('Missing Interrupt with run_id', lines);
  process.exit(1);
}

if (agentStart.run_id !== agentEnd.run_id) {
  console.error('run_id mismatch: AgentStart vs AgentEnd', { agentStart: agentStart.run_id, agentEnd: agentEnd.run_id });
  process.exit(1);
}

if (agentStart.run_id !== interrupt.run_id) {
  console.error('run_id mismatch: AgentStart vs Interrupt', { agentStart: agentStart.run_id, interrupt: interrupt.run_id });
  process.exit(1);
}

console.log('LIFECYCLE_HOOKS_VERIFIED=true');
`,
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    // Start a slow run that will be interrupted.
    terminal.submit('Start a slow run for lifecycle hook e2e.');
    // Wait for the stream to actually start so AgentStart has fired and we
    // are interrupting mid-run.
    await runtime.waitForScreenText(/Lifecycle hook slow/i, terminal, 15_000);
    runtime.printScreen('mid-stream before abort', terminal);

    // Abort the run mid-stream — fires Interrupt, then AgentEnd (aborted).
    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
    await runtime.sleep(1_000);

    // Assert the hook log contains the expected lifecycle events.
    terminal.submit('!node .mastracode/assert-lifecycle.cjs');
    await runtime.waitForScreenText(/LIFECYCLE_HOOKS_VERIFIED=true/i, terminal, 10_000);
    runtime.printScreen('after lifecycle hook verification', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after final Ctrl-C', terminal);
  },
};
