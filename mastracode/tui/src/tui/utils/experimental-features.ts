import { getSettingsPath, loadSettings } from '@mastra/code-sdk/onboarding/settings';

const knowledgeEnabled = new Map<string, boolean>();

/** The /settings Knowledge toggle, read once per settings file: it changes on restart. */
export function isKnowledgeEnabled(): boolean {
  const settingsPath = getSettingsPath();
  let enabled = knowledgeEnabled.get(settingsPath);
  if (enabled === undefined) {
    enabled = loadSettings().signals.experimentalKnowledge;
    knowledgeEnabled.set(settingsPath, enabled);
  }
  return enabled;
}
