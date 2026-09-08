import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

/**
 * E2E scenario for receipt-time PermissionRequest hooks (#20861) and the
 * receipt-time agent_done notification (#20860) — both follow-ups to the
 * pre-queue notification tap shipped in #20857.
 *
 * The AIMock fixture emits ask_user and request_access as PARALLEL tool calls
 * in one model turn. Note on scope: the agent-controller serializes prompts
 * within a single run (`tool-call-approval` awaits the decision inside the
 * stream loop; a suspension winds the run down before the next tool executes),
 * so the second tool's `tool_suspended` is only emitted after the first prompt
 * is answered — a single-session fixture cannot place a permission event
 * behind a blocked queue. The receipt-time semantics are proven by the unit
 * suite (permission-hooks-receipt.test.ts), which drives the real subscription
 * listener with a genuinely blocked queue. This scenario guards the production
 * wiring end to end:
 *
 * 1. (#20861) The PermissionRequest hook fires for the request_access
 *    suspension with the correct payload — the receipt-time tap is the ONLY
 *    dispatch site left, so this fails if the tap's call site regresses.
 * 2. (#20860) After the run completes, the notification log contains EXACTLY
 *    ONE agent_done record (keyed on reason — the tap also logs ask_question /
 *    sandbox_access records). Red on pre-fix builds: the queued handler also
 *    pinged agent_done for each intermediate agent_end 'suspended', and this
 *    flow has two suspension cycles (observed on base 6c0fc33978: 3 records).
 *
 * Assertions run at the END so a single run surfaces every failure. All
 * assertions read the hook JSONL files, never screen text.
 */

let permissionLogPath = '';
let notificationLogPath = '';

export const permissionRequestHookScenario: McE2eScenario = {
  name: 'permission-request-hook',
  description:
    'PermissionRequest hook dispatch from the receipt-time tap (#20861) and exactly-once agent_done notification (#20860): parallel ask_user + request_access tool calls, hook JSONL assertions only.',
  testName: 'fires the PermissionRequest hook for a queued suspension and pings agent_done exactly once',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'permission-request-hook.json',
  env() {
    return { MASTRACODE_DISABLE_HOOKS: '0' };
  },
  prepare({ projectDir }) {
    const hooksDir = join(projectDir, '.mastracode');
    mkdirSync(hooksDir, { recursive: true });
    permissionLogPath = join(hooksDir, 'permission-events.jsonl');
    notificationLogPath = join(hooksDir, 'notification-events.jsonl');

    // PermissionRequest hook: log each payload's kind + tool context.
    writeFileSync(
      join(hooksDir, 'permission-hook.cjs'),
      `const fs = require('node:fs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  fs.appendFileSync('.mastracode/permission-events.jsonl', JSON.stringify({
    event: payload.hook_event_name,
    permission_kind: payload.permission_kind || null,
    tool_call_id: payload.tool_call_id || null,
    tool_name: payload.tool_name || null,
    ts: Date.now(),
  }) + '\\n');
  process.exit(0);
});
`,
    );

    // Notification hook: log reason + message (agent_done evidence for #20860).
    writeFileSync(
      join(hooksDir, 'notify-hook.cjs'),
      `const fs = require('node:fs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  fs.appendFileSync('.mastracode/notification-events.jsonl', JSON.stringify({
    event: payload.hook_event_name,
    reason: payload.reason || null,
    message: payload.message ?? null,
  }) + '\\n');
  process.exit(0);
});
`,
    );

    writeFileSync(
      join(hooksDir, 'hooks.json'),
      JSON.stringify(
        {
          PermissionRequest: [
            {
              type: 'command',
              command: 'node .mastracode/permission-hook.cjs',
              timeout: 5000,
              description: 'log permission request events',
            },
          ],
          Notification: [
            {
              type: 'command',
              command: 'node .mastracode/notify-hook.cjs',
              timeout: 5000,
              description: 'log notification events',
            },
          ],
        },
        null,
        2,
      ),
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('Run the permission request hook e2e.');
    await runtime.waitForScreenText(/Answer the blocking permission hook prompt\?/i, terminal, 15_000);
    runtime.printScreen('ask_user prompt visible (queue blocked)', terminal);

    const readJsonl = (path: string): Array<Record<string, unknown>> => {
      if (!existsSync(path)) return [];
      return readFileSync(path, 'utf8')
        .trim()
        .split(/\n+/)
        .filter(Boolean)
        .map(line => JSON.parse(line));
    };

    // Answer the blocking ask_user prompt, then grant the queued sandbox
    // access prompt, and let the run finish. Screen waits here are flow
    // control only — no assertion reads screen text.
    terminal.write('proceed');
    terminal.write('\r');
    await runtime.waitForScreenText(
      /Grant sandbox access to "\/tmp\/mastracode-permission-hook-e2e"\?/i,
      terminal,
      15_000,
    );
    runtime.printScreen('queued sandbox prompt active', terminal);

    // OBSERVATION 1 (#20861): the request_access suspension's PermissionRequest
    // hook must have fired by the time its prompt is on screen — the
    // receipt-time tap is the only dispatch site. The hook runs as a
    // fire-and-forget child process, so poll briefly.
    const permDeadline = Date.now() + 10_000;
    let sandboxRecord: Record<string, unknown> | undefined;
    while (Date.now() < permDeadline && !sandboxRecord) {
      sandboxRecord = readJsonl(permissionLogPath).find(
        entry => entry.event === 'PermissionRequest' && entry.permission_kind === 'sandbox_access',
      );
      if (!sandboxRecord) {
        await runtime.sleep(100);
      }
    }
    runtime.printScreen('permission log polled', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(/Permission hook e2e complete\./i, terminal, 15_000);
    runtime.printScreen('run complete', terminal);

    // OBSERVATION 2 (#20860): after completion, wait for the agent_done
    // notification record, then a short settle so any spurious extra record
    // (the pre-fix suspended-run ping) has time to land before counting.
    const doneDeadline = Date.now() + 10_000;
    while (Date.now() < doneDeadline) {
      const found = readJsonl(notificationLogPath).some(
        entry => entry.event === 'Notification' && entry.reason === 'agent_done',
      );
      if (found) break;
      await runtime.sleep(100);
    }
    await runtime.sleep(1_500);
    const agentDoneRecords = readJsonl(notificationLogPath).filter(
      entry => entry.event === 'Notification' && entry.reason === 'agent_done',
    );

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);

    // ASSERTIONS — both observations checked at the end.
    const failures: string[] = [];
    if (!sandboxRecord) {
      failures.push(
        'PermissionRequest hook never received a sandbox_access record for the request_access suspension (#20861 — the receipt-time tap is the only dispatch site). ' +
          `Final permission log: ${JSON.stringify(readJsonl(permissionLogPath))}`,
      );
    } else {
      if (sandboxRecord.tool_name !== 'request_access') {
        failures.push(`sandbox_access record carries the wrong tool_name: ${JSON.stringify(sandboxRecord.tool_name)}`);
      }
      if (sandboxRecord.tool_call_id !== 'call_permission_hook_access') {
        failures.push(
          `sandbox_access record carries the wrong tool_call_id: ${JSON.stringify(sandboxRecord.tool_call_id)}`,
        );
      }
    }
    if (agentDoneRecords.length !== 1) {
      failures.push(
        `expected exactly one agent_done notification record, found ${agentDoneRecords.length} (#20860 — pre-fix builds also ping for agent_end 'suspended')`,
      );
    }
    if (failures.length > 0) {
      throw new Error(failures.join('\n'));
    }
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    if (!serialized.includes('call_permission_hook_question') || !serialized.includes('call_permission_hook_access')) {
      throw new Error('Expected AIMock requests to include both parallel tool call ids');
    }
    if (requests.length < 2) {
      throw new Error(`Expected at least 2 AIMock requests for suspend + resume, received ${requests.length}`);
    }
  },
};
