import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

/**
 * E2E scenario for receipt-time input-request notifications (#20398).
 *
 * Configures a Notification hook that logs every notification's stdin payload
 * to a JSONL file, then triggers an ask_user prompt through the real TUI. The
 * scenario asserts the hook received an `ask_question` notification while the
 * prompt is still unanswered — proving the notification fired when the input
 * request arrived, through the production subscription wiring, not when the
 * prompt handler eventually resolved.
 *
 * This guards the pre-queue notification tap's production call site: if the
 * TUI's controller subscription stops routing events through the tap, no
 * notification fires at all (the old in-handler notify calls were removed)
 * and this scenario fails.
 */

let notificationLogPath = '';

export const notifyInputRequestHookScenario: McE2eScenario = {
  name: 'notify-input-request-hook',
  description:
    'Configure a Notification hook, trigger an ask_user prompt, and verify the hook fires while the prompt is still pending.',
  testName: 'fires the Notification hook at input-request receipt while the prompt is unanswered',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'notify-input-request-hook.json',
  env() {
    return { MASTRACODE_DISABLE_HOOKS: '0' };
  },
  prepare({ projectDir }) {
    const hooksDir = join(projectDir, '.mastracode');
    mkdirSync(hooksDir, { recursive: true });
    notificationLogPath = join(hooksDir, 'notification-events.jsonl');

    // Hook script: log each Notification payload (reason + message) to a
    // JSONL file, then exit 0 (notification hooks are non-blocking).
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

    terminal.submit('Run the notify input request hook e2e.');
    await runtime.waitForScreenText(
      /Which notification channel should the notify hook e2e verify\?/i,
      terminal,
      15_000,
    );
    runtime.printScreen('ask_user prompt visible', terminal);

    // The prompt is on screen and unanswered. The Notification hook must have
    // fired at event receipt — poll the hook log for the ask_question record.
    // The hook runs as a fire-and-forget child process, so allow it a moment
    // to append its line.
    const deadline = Date.now() + 10_000;
    let askQuestionRecord: { event: string; reason: string | null; message: string | null } | undefined;
    while (Date.now() < deadline && !askQuestionRecord) {
      if (existsSync(notificationLogPath)) {
        const lines = readFileSync(notificationLogPath, 'utf8')
          .trim()
          .split(/\n+/)
          .filter(Boolean)
          .map(line => JSON.parse(line));
        askQuestionRecord = lines.find(entry => entry.event === 'Notification' && entry.reason === 'ask_question');
      }
      if (!askQuestionRecord) {
        await runtime.sleep(100);
      }
    }

    if (!askQuestionRecord) {
      throw new Error('Notification hook never received an ask_question record while the prompt was pending');
    }
    if (askQuestionRecord.message !== 'Which notification channel should the notify hook e2e verify?') {
      throw new Error(`Notification hook received the wrong message: ${JSON.stringify(askQuestionRecord.message)}`);
    }
    runtime.printScreen('notification hook verified while prompt pending', terminal);

    // Answer the prompt and let the run finish normally.
    terminal.write('Bell');
    terminal.write('\r');
    await runtime.waitForScreenText(/Notify hook e2e complete for Bell\./i, terminal, 15_000);
    runtime.printScreen('after prompt answered', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    if (!serialized.includes('call_notify_input_request')) {
      throw new Error('Expected AIMock requests to include the ask_user tool call id');
    }
    if (requests.length < 2) {
      throw new Error(`Expected at least 2 AIMock requests for suspend + resume, received ${requests.length}`);
    }
  },
};
