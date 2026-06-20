import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const blockedPrompt = 'blocked lifecycle hook prompt e2e';

function hookScript(label: string, reason: string): string {
  return `const fs = require('node:fs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  fs.appendFileSync('.mastracode/hook-events.jsonl', JSON.stringify({ label: ${JSON.stringify(label)}, event: payload.hook_event_name, message: payload.user_message || '' }) + '\\n');
  console.log(JSON.stringify({ decision: 'block', reason: ${JSON.stringify(reason)} }));
  process.exit(2);
});
`;
}

export const lifecycleHooksConfiguredScenario: McE2eScenario = {
  name: 'lifecycle-hooks-configured',
  description: 'Verify configured lifecycle hooks render, reload, and block user prompts through the real TUI.',
  testName: 'shows configured hooks, reloads them from disk, and blocks a prompt',
  projectFixture: 'long-branch',
  env() {
    return { MASTRACODE_DISABLE_HOOKS: '0' };
  },
  prepare({ projectDir }) {
    const hooksDir = join(projectDir, '.mastracode');
    mkdirSync(hooksDir, { recursive: true });

    writeFileSync(join(hooksDir, 'hook-before.cjs'), hookScript('before', 'blocked before reload e2e'));
    writeFileSync(join(hooksDir, 'hook-after.cjs'), hookScript('after', 'blocked after reload e2e'));

    writeFileSync(
      join(hooksDir, 'hooks.json'),
      JSON.stringify(
        {
          UserPromptSubmit: [
            {
              type: 'command',
              command: 'node .mastracode/hook-before.cjs',
              timeout: 10_000,
              description: 'before reload prompt block',
            },
          ],
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(hooksDir, 'rewrite-hooks.cjs'),
      `const fs = require('node:fs');
fs.writeFileSync('.mastracode/hooks.json', JSON.stringify({
  UserPromptSubmit: [{
    type: 'command',
    command: 'node .mastracode/hook-after.cjs',
    timeout: 10_000,
    description: 'after reload prompt block'
  }]
}, null, 2));
console.log('HOOKS_REWRITTEN=after');
`,
    );

    writeFileSync(
      join(hooksDir, 'assert-hook-log.cjs'),
      `const fs = require('node:fs');
const lines = fs.readFileSync('.mastracode/hook-events.jsonl', 'utf8').trim().split(/\\n+/).map(line => JSON.parse(line));
const hit = lines.find(entry => entry.label === 'after' && entry.event === 'UserPromptSubmit' && entry.message === ${JSON.stringify(blockedPrompt)});
if (!hit) {
  console.error('Missing after-reload hook event', lines);
  process.exit(1);
}
console.log('HOOK_BLOCK_LOG=after:UserPromptSubmit:true');
`,
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('/hooks');
    await runtime.waitForScreenText(/Hooks Configuration:/i, terminal);
    await runtime.waitForScreenText(/UserPromptSubmit \(1 hook\):/i, terminal);
    await runtime.waitForScreenText(/hook-before\.cjs/i, terminal);
    await runtime.waitForScreenText(/before reload prompt block/i, terminal);
    runtime.printScreen('after configured /hooks status', terminal);

    terminal.submit('!node .mastracode/rewrite-hooks.cjs');
    await runtime.waitForScreenText(/HOOKS_REWRITTEN=after/i, terminal);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);

    terminal.submit('/hooks reload');
    await runtime.waitForScreenText(/Hooks config reloaded\./i, terminal, 10_000);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);

    terminal.submit('/hooks');
    await runtime.waitForScreenText(/hook-after\.cjs/i, terminal);
    await runtime.waitForScreenText(/after reload prompt block/i, terminal);
    runtime.printScreen('after /hooks reload status', terminal);

    terminal.submit(blockedPrompt);
    await runtime.waitForScreenText(/blocked after reload e2e/i, terminal);
    runtime.printScreen('after blocked prompt', terminal);
    terminal.write('\x15');

    terminal.submit('!node .mastracode/assert-hook-log.cjs');
    await runtime.waitForScreenText(/HOOK_BLOCK_LOG=after:UserPromptSubmit:true/i, terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
