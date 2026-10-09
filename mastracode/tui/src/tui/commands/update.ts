import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import {
  detectPackageManager,
  fetchChangelog,
  fetchLatestVersion,
  isNewerVersion,
} from '@mastra/code-sdk/utils/update-check';
import { formatRegistryError, formatUpdateHeader, formatUpToDate } from '../../update-output.js';
import { showLines, showProgress } from '../display.js';
import { offerUpdate, tuiUpdateStyle } from '../update-flow.js';
import type { SlashCommandContext } from './types.js';

export async function handleUpdateCommand(ctx: SlashCommandContext): Promise<void> {
  const currentVersion = ctx.state.options.version;
  if (!currentVersion) {
    ctx.showError('Could not determine the current version.');
    return;
  }

  const stopChecking = showProgress(ctx.state, 'Checking for updates');
  const latestVersion = await fetchLatestVersion();
  stopChecking();

  const header = formatUpdateHeader(tuiUpdateStyle, currentVersion);
  if (!latestVersion) {
    showLines(ctx.state, [header, formatRegistryError(tuiUpdateStyle)]);
    return;
  }
  if (!isNewerVersion(currentVersion, latestVersion)) {
    showLines(ctx.state, [header, formatUpToDate(tuiUpdateStyle)]);
    return;
  }

  const [pm, changelog] = await Promise.all([detectPackageManager(), fetchChangelog(latestVersion)]);

  // Clear any previously dismissed version so the prompt always shows
  const settings = loadSettings();
  if (settings.updateDismissedVersion) {
    settings.updateDismissedVersion = null;
    saveSettings(settings);
  }

  await offerUpdate(
    { state: ctx.state, stop: () => ctx.stop(), exit: code => (ctx.exit ? ctx.exit(code) : process.exit(code)) },
    { currentVersion, latestVersion, pm, changelog },
  );
}
