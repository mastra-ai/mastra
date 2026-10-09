/**
 * The update prompt and install, shared by `/update` and the startup update check.
 */
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { describeUpdate, performUpdate } from '@mastra/code-sdk/utils/update-check';
import type { PackageManager } from '@mastra/code-sdk/utils/update-check';
import { formatInstallingLabel, formatUpdateHeader, formatUpdateOutcome } from '../update-output.js';
import type { UpdateStyle } from '../update-output.js';
import { insertChatComponentWithBoundarySpacing } from './chat-boundary-reconciliation.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { showInfo, showLines, showProgress } from './display.js';
import type { TUIState } from './state.js';
import { theme } from './theme.js';

export const tuiUpdateStyle: UpdateStyle = {
  accent: text => theme.fg('accent', text),
  muted: text => theme.fg('muted', text),
  error: text => theme.fg('error', text),
  warning: text => theme.fg('warning', text),
  bold: text => theme.bold(text),
};

export interface UpdateOffer {
  currentVersion: string;
  latestVersion: string;
  pm: PackageManager;
  changelog: string | null;
}

export interface UpdateFlowHost {
  state: TUIState;
  /** Tear down the TUI before printing the success message to the shell. */
  stop(): void;
  exit(code: number): void;
}

/**
 * Ask whether to install `latestVersion`, then install it with a spinner.
 * On success the TUI exits and the result is printed to the shell; on failure
 * the result stays in the chat. No (and Esc, with `dismissOnCancel`) remembers
 * the version so startup doesn't offer it again.
 */
export async function offerUpdate(
  host: UpdateFlowHost,
  { currentVersion, latestVersion, pm, changelog }: UpdateOffer,
  { dismissOnCancel = false }: { dismissOnCancel?: boolean } = {},
): Promise<void> {
  const { state } = host;
  const update = describeUpdate(pm, latestVersion);

  let question = `Mastra Code v${currentVersion} → v${latestVersion}`;
  if (changelog) question += `\n\nWhat's new\n${changelog}`;
  question += '\n\nUpdate now?';

  const answer = await new Promise<string | null>(resolve => {
    const component = new AskQuestionInlineComponent(
      {
        question,
        options: [
          { label: 'Yes', description: `Install with ${update.via} and restart` },
          { label: 'No', description: `Skip v${latestVersion}` },
        ],
        allowCustomResponse: false,
        onSubmit: answer => {
          state.activeInlineQuestion = undefined;
          resolve(answer);
        },
        onCancel: () => {
          state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      state.ui,
    );

    insertChatComponentWithBoundarySpacing(state.chatContainer, component);
    state.activeInlineQuestion = component;
    component.focused = true;
    state.ui.requestRender();
  });

  if (answer === 'Yes') {
    const stopProgress = showProgress(state, formatInstallingLabel(tuiUpdateStyle, update));
    const outcome = await performUpdate(pm, latestVersion);
    stopProgress();
    if (outcome.status === 'updated') {
      // Let the TUI repaint without the spinner (it paints at most every 16ms) so
      // the screen left behind doesn't show a frozen "Installing" line.
      await new Promise(resolve => setTimeout(resolve, 50));
      // Printed after TUI teardown — a message rendered inside it is lost in the exit race.
      host.stop();
      console.info(
        [
          formatUpdateHeader(tuiUpdateStyle, currentVersion, latestVersion),
          ...formatUpdateOutcome(tuiUpdateStyle, outcome, latestVersion, { restartHint: true }),
        ].join('\n'),
      );
      host.exit(0);
    } else {
      showLines(state, formatUpdateOutcome(tuiUpdateStyle, outcome, latestVersion));
    }
    return;
  }

  if (answer === 'No' || dismissOnCancel) {
    const settings = loadSettings();
    settings.updateDismissedVersion = latestVersion;
    saveSettings(settings);
  }
  if (answer === 'No') showInfo(state, `Skipped v${latestVersion}. Run /update to install it later.`);
}
