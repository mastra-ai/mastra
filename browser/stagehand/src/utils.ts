import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Stagehand } from '@browserbasehq/stagehand';

/**
 * Patch Chrome's Preferences file to set exit_type to "Normal".
 *
 * Stagehand uses chrome-launcher which kills Chrome with SIGKILL. This races
 * with Chrome's own Preferences flush, often leaving exit_type as "Crashed".
 * On next launch Chrome shows the "didn't shut down correctly" restore dialog.
 *
 * Safe to call even if the file doesn't exist or isn't valid JSON.
 */
export function patchProfileExitType(profilePath: string, logger?: { debug?: (message: string) => void }): void {
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

/**
 * Extract the Chrome process PID from a Stagehand instance.
 *
 * Stagehand stores the chrome-launcher result in `state.chrome` after init.
 * The PID is at `chrome.process?.pid ?? chrome.pid`. This isn't part of
 * Stagehand's public API, so we access it via `as any`.
 *
 * Returns undefined if the PID can't be found (e.g. BROWSERBASE env, not yet init'd).
 */
export function getStagehandChromePid(stagehand: Stagehand): number | undefined {
  try {
    const state = (stagehand as any).state;
    if (state?.kind !== 'LOCAL' || !state.chrome) return undefined;
    const pid = state.chrome.process?.pid ?? state.chrome.pid;
    return typeof pid === 'number' && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}
