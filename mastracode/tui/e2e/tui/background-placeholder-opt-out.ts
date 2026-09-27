import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { renderExistingMessages } from '../../src/tui/render-messages.js';
import type { TUIState } from '../../src/tui/state.js';
import type { McE2eScenario } from './types.js';

function backgroundPlaceholderScenario(enabled: boolean): McE2eScenario {
  let state: TUIState | undefined;

  return {
    name: enabled ? 'background-placeholder-opt-in' : 'background-placeholder-opt-out',
    description: `Foreground output resembling a background placeholder completes normally with background tools ${enabled ? 'enabled' : 'disabled'}.`,
    testName: 'never labels matching foreground output as background, live or after replay',
    useOpenAIModel: true,
    aimockFixture: 'background-placeholder-opt-out.json',
    prepare({ appDataDir }) {
      const path = join(appDataDir, 'settings.json');
      const settings = JSON.parse(readFileSync(path, 'utf8'));
      settings.backgroundTools = { enabled };
      writeFileSync(path, JSON.stringify(settings));
    },
    inProcessApp({ startMastraCodeApp }) {
      return startMastraCodeApp({
        config: {
          disableHooks: true,
          disableMcp: true,
          extraTools: {
            foreground_probe: {
              id: 'foreground_probe',
              description: 'Return ordinary text that resembles a background placeholder.',
              inputSchema: z.object({}),
              execute: async () => 'Background task started. Task ID: visible-demo-123',
            },
          },
        },
        onTuiCreated(tui) {
          if (!tui || (typeof tui !== 'object' && typeof tui !== 'function')) throw new Error('Expected TUI instance');
          state = Reflect.get(tui, 'state') as TUIState;
        },
      });
    },
    async run({ terminal, runtime }) {
      terminal.resize(140, 60);
      await runtime.waitForScreenText(/Resource ID:/i, terminal);
      terminal.submit('Run the foreground placeholder collision probe.');
      await runtime.waitForOutputText(/FOREGROUND_COLLISION_COMPLETE/, terminal);
      if (!state || state.options.backgroundToolsEnabled !== enabled)
        throw new Error('Unexpected background tools setting');
      const check = () => {
        const output = state!.chatContainer
          .render(140)
          .join('\n')
          .replace(/\x1b\[[0-9;]*m/g, '');
        if (output.includes('background · visible-demo-123'))
          throw new Error('Foreground result has a background badge');
        if (state!.pendingTools.has('call_collision')) throw new Error('Completed foreground tool remains pending');
        if ([...state!.backgroundActivities.values()].some(activity => activity.toolCallId === 'call_collision'))
          throw new Error('Foreground output created background activity');
        if (!output.includes('Background task started. Task ID: visible-demo-123'))
          throw new Error('Foreground output missing');
      };
      check();
      await renderExistingMessages(state);
      check();
    },
  };
}

export const backgroundPlaceholderOptOutScenario = backgroundPlaceholderScenario(false);
export const backgroundPlaceholderOptInScenario = backgroundPlaceholderScenario(true);
