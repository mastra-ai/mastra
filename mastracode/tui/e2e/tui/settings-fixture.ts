import { readFileSync } from 'node:fs';

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
