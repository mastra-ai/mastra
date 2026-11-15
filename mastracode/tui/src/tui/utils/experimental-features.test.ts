import { describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ path: '/app-one/settings.json', enabled: false }));
vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  getSettingsPath: () => settings.path,
  loadSettings: () => ({ signals: { experimentalKnowledge: settings.enabled } }),
}));

import { isKnowledgeEnabled } from './experimental-features.js';

describe('Knowledge startup settings', () => {
  it('keeps each settings file independent and retains its startup snapshot', () => {
    expect(isKnowledgeEnabled()).toBe(false);
    settings.path = '/app-two/settings.json';
    settings.enabled = true;
    expect(isKnowledgeEnabled()).toBe(true);

    settings.enabled = false;
    expect(isKnowledgeEnabled()).toBe(true);
    settings.path = '/app-one/settings.json';
    expect(isKnowledgeEnabled()).toBe(false);
  });
});
