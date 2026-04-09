import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Patch Chrome's Preferences file to set exit_type to "Normal".
 *
 * Stagehand uses chrome-launcher which kills Chrome with SIGKILL. This races
 * with Chrome's own Preferences flush, often leaving exit_type as "Crashed".
 * On next launch Chrome shows the "didn't shut down correctly" restore dialog.
 *
 * Safe to call even if the file doesn't exist or isn't valid JSON.
 */
export function patchProfileExitType(
  profilePath: string,
  logger?: { debug?: (message: string) => void },
): void {
  if (!profilePath) return;

  const prefsPath = join(profilePath, 'Default', 'Preferences');
  try {
    if (!existsSync(prefsPath)) return;
    const prefs = JSON.parse(readFileSync(prefsPath, 'utf-8'));
    if (prefs?.profile?.exit_type === 'Normal') return;
    prefs.profile = prefs.profile || {};
    prefs.profile.exit_type = 'Normal';
    writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf-8');
    logger?.debug?.(`Patched exit_type to Normal in ${prefsPath}`);
  } catch {
    // Preferences file may not exist yet or be malformed — ignore
  }
}
