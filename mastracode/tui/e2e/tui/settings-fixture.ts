import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type MutableSettingsFixture = Record<string, unknown> & {
  onboarding: Record<string, unknown>;
  models: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readMutableSettingsFixture(path: string): MutableSettingsFixture {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isRecord(value)) {
    throw new Error(`Expected a settings object in ${path}`);
  }
  const onboarding = isRecord(value.onboarding) ? value.onboarding : {};
  const models = isRecord(value.models) ? value.models : {};
  return { ...value, onboarding, models };
}

/** Opts the TUI in to mouse support (off by default) through the `/settings` Mouse preferences. */
export function enableMouseSettings(appDataDir: string, mouse: { dialogs: boolean; input: boolean }): void {
  const path = join(appDataDir, 'settings.json');
  const settings = readMutableSettingsFixture(path);
  const preferences = isRecord(settings.preferences) ? settings.preferences : {};
  settings.preferences = { ...preferences, mouseDialogs: mouse.dialogs, mouseInput: mouse.input };
  writeFileSync(path, JSON.stringify(settings, null, 2));
}
