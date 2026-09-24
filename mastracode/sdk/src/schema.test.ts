import { describe, expect, it } from 'vitest';

import { stateSchema } from './schema.js';

describe('stateSchema', () => {
  it('preserves task ids in controller state', () => {
    const parsed = stateSchema.parse({
      tasks: [
        {
          id: 'tests',
          content: 'Write tests',
          status: 'pending',
          activeForm: 'Writing tests',
        },
      ],
    });

    expect(parsed.tasks).toEqual([
      {
        id: 'tests',
        content: 'Write tests',
        status: 'pending',
        activeForm: 'Writing tests',
      },
    ]);
  });

  // Regression: the legacy controller validates its state against this schema and
  // assigns the parsed result back to state. Zod strips unknown keys, so if
  // currentModelId/modeId are not declared here, the seeded model is silently
  // discarded and the controller reports "no model selected" for every pack.
  it('preserves currentModelId through parse', () => {
    const parsed = stateSchema.parse({
      currentModelId: 'anthropic/claude-opus-4-8',
    });

    expect(parsed.currentModelId).toBe('anthropic/claude-opus-4-8');
  });

  it('preserves modeId through parse', () => {
    const parsed = stateSchema.parse({ modeId: 'build' });

    expect(parsed.modeId).toBe('build');
  });

  it('normalizes the HTTP null sentinel to an absent thinking override', () => {
    const parsed = stateSchema.parse({ thinkingLevel: null });

    expect(parsed.thinkingLevel).toBeUndefined();
  });

  it('preserves the factory identity keys through parse', () => {
    const parsed = stateSchema.parse({
      factoryProjectId: '2981c5b8-a843-4da0-96fb-d0a016963f04',
      factoryOrgId: 'FOdo4tqL98ibdYH8uhLXs0mZrDDE5Uiw',
    });

    expect(parsed.factoryProjectId).toBe('2981c5b8-a843-4da0-96fb-d0a016963f04');
    // The schema strips unknown keys on parse; a factoryOrgId missing from the
    // schema is silently discarded and the memory seam falls back to ownerId.
    expect(parsed.factoryOrgId).toBe('FOdo4tqL98ibdYH8uhLXs0mZrDDE5Uiw');
  });

  // Regression: /browser status compares the persisted active snapshot against the
  // settings file to detect drift. Any BrowserSettings field missing here is
  // stripped on parse, so the snapshot never matches the file and status reports
  // "Pending changes (not yet applied)" forever.
  it('preserves every BrowserSettings field in activeBrowserSettings', () => {
    const active = {
      enabled: true,
      provider: 'stagehand' as const,
      headless: false,
      viewport: { width: 1280, height: 720 },
      cdpUrl: 'http://127.0.0.1:9222',
      profile: '/tmp/profile',
      executablePath: '/usr/bin/chromium',
      scope: 'thread' as const,
      stagehand: {
        env: 'LOCAL' as const,
        projectId: 'proj',
        model: 'anthropic/claude-sonnet-4-5',
        preserveUserDataDir: true,
      },
      agentBrowser: { storageState: '/tmp/state.json' },
    };

    const parsed = stateSchema.parse({ activeBrowserSettings: active });

    expect(parsed.activeBrowserSettings).toEqual(active);
  });

  it('strips the Browserbase API key from activeBrowserSettings', () => {
    // Session state is readable by session clients; credentials must not leak into it.
    const parsed = stateSchema.parse({
      activeBrowserSettings: {
        enabled: true,
        provider: 'stagehand',
        stagehand: { env: 'BROWSERBASE', apiKey: 'bb-key', projectId: 'proj' },
      },
    });

    expect(parsed.activeBrowserSettings?.stagehand).toEqual({ env: 'BROWSERBASE', projectId: 'proj' });
  });

  it('preserves activeBrowserModel so status reports the model the browser launched with', () => {
    const activeBrowserModel = { modelName: 'openai/gpt-5.5', source: 'codex-oauth' as const };

    const parsed = stateSchema.parse({ activeBrowserModel });

    expect(parsed.activeBrowserModel).toEqual(activeBrowserModel);
  });
});
