import { Spacer } from '@mariozechner/pi-tui';

import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import {
  detectPackageManager,
  fetchChangelog,
  fetchLatestVersion,
  getInstallCommand,
  isNewerVersion,
  runUpdate,
} from '../../utils/update-check.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

export async function handleUpdateCommand(ctx: SlashCommandContext): Promise<void> {
  const currentVersion = ctx.state.options.version;
  if (!currentVersion) {
    ctx.showError('Could not determine the current version.');
    return;
  }

  ctx.showInfo('Checking for updates…');

  const latestVersion = await fetchLatestVersion();
  if (!latestVersion) {
    ctx.showError('Could not reach the npm registry. Check your network connection.');
    return;
  }

  if (!isNewerVersion(currentVersion, latestVersion)) {
    ctx.showInfo(`You are already on the latest version (v${currentVersion}).`);
    return;
  }

  const [pm, changelog] = await Promise.all([detectPackageManager(), fetchChangelog(latestVersion)]);

  // Clear any previously dismissed version so the prompt always shows
  const settings = loadSettings();
  if (settings.updateDismissedVersion) {
    settings.updateDismissedVersion = null;
    saveSettings(settings);
  }

  // Build question text with optional changelog
  let question = `A new version is available: v${latestVersion} (current: v${currentVersion}).`;
  if (changelog) {
    question += `\n\nWhat's new:\n${changelog}`;
  }
  question += `\n\nWould you like to update now?`;

  // Show interactive prompt
  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question,
        options: [
          { label: 'Yes', description: 'Update and restart' },
          { label: 'No', description: 'Skip this version' },
        ],
        formatResult: answer => (answer === 'Yes' ? 'Updating…' : 'Update skipped.'),
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          if (answer === 'Yes') {
            ctx.showInfo(`Updating to v${latestVersion}…`);
            const ok = await runUpdate(pm, latestVersion);
            if (ok) {
              ctx.showInfo(`Updated to v${latestVersion}. Please restart Mastra Code.`);
              ctx.stop();
              process.exit(0);
            } else {
              const cmd = getInstallCommand(pm, latestVersion);
              ctx.showError(`Auto-update failed. Run \`${cmd}\` manually.`);
            }
          } else {
            const s = loadSettings();
            s.updateDismissedVersion = latestVersion;
            saveSettings(s);
            ctx.showInfo('Update skipped.');
          }
          resolve();
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve();
        },
      },
      ctx.state.ui,
    );

    ctx.state.activeInlineQuestion = questionComponent;
    ctx.state.chatContainer.addChild(questionComponent);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}
