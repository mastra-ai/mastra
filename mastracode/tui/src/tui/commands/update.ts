import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import {
  detectPackageManager,
  fetchChangelog,
  fetchLatestVersion,
  isNewerVersion,
  performUpdate,
} from '@mastra/code-sdk/utils/update-check';
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

  const answer = await new Promise<string | null>(resolve => {
    const component = new AskQuestionInlineComponent(
      {
        question,
        options: [
          { label: 'Yes', description: 'Update and restart' },
          { label: 'No', description: 'Skip this version' },
        ],
        allowCustomResponse: false,
        onSubmit: answer => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(answer);
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      ctx.state.ui,
    );

    ctx.state.chatContainer.addChild(component);
    ctx.state.activeInlineQuestion = component;
    component.focused = true;
    ctx.state.ui.requestRender();
  });

  if (answer === 'Yes') {
    ctx.showInfo(`Updating to v${latestVersion}…`);
    const outcome = await performUpdate(pm, latestVersion);
    if (outcome.status === 'updated') {
      // Printed after TUI teardown — a message rendered inside it is lost in the exit race.
      ctx.stop();
      console.info(outcome.message);
      process.exit(0);
    } else {
      ctx.showError(outcome.message);
    }
  } else if (answer === 'No') {
    const s = loadSettings();
    s.updateDismissedVersion = latestVersion;
    saveSettings(s);
    ctx.showInfo('Update skipped.');
  }
}
