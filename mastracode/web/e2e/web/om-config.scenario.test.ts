import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { applyOmRoleOverride } from '@mastra/code-sdk/onboarding/om-settings';
import { readOMConfig } from '@mastra/factory/routes/config';
import type { OMSession } from '@mastra/factory/routes/config';

/**
 * The web settings panel surfaces observational-memory config through the same
 * primitives the TUI's `/om` command uses: the session's observer/reflector
 * model + threshold reads, and GlobalSettings (`settings.json`) for the durable
 * override/threshold/observe-attachments writes. These tests exercise the
 * server-side bridge against a fake session and an isolated settings file so the
 * user's real settings are never touched.
 */
describe('web OM config (TUI /om parity)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mc-om-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Build a fake session whose OM roles/state mirror a real Session's surface. */
  function fakeSession(state: Record<string, unknown>): OMSession {
    return {
      mode: { get: () => 'build' },
      model: { switch: async () => {} },
      subagents: { model: { set: async () => {} } },
      thread: { getId: () => 't1', setSetting: async () => {}, list: async () => [] },
      state: { get: () => state, set: async () => {} },
      om: {
        observer: {
          modelId: () => state.observerModelId as string | undefined,
          threshold: () => state.observationThreshold as number | undefined,
          switchModel: async () => {},
        },
        reflector: {
          modelId: () => state.reflectorModelId as string | undefined,
          threshold: () => state.reflectionThreshold as number | undefined,
          switchModel: async () => {},
        },
      },
    };
  }

  it('reads OM config from the session, falling back to defaults', () => {
    // No models/thresholds set → route reports empty model ids and the
    // `/om` default thresholds, and observe-attachments defaults to 'auto'.
    const cfg = readOMConfig(fakeSession({}));
    expect(cfg.observerModelId).toBe('');
    expect(cfg.reflectorModelId).toBe('');
    expect(cfg.observationThreshold).toBe(30_000);
    expect(cfg.reflectionThreshold).toBe(40_000);
    expect(cfg.observeAttachments).toBe('auto');
  });

  it('reflects session state when models/thresholds/attachments are set', () => {
    const cfg = readOMConfig(
      fakeSession({
        observerModelId: 'anthropic/claude-haiku-4-5',
        reflectorModelId: 'openai/gpt-5.4-mini',
        observationThreshold: 12_345,
        reflectionThreshold: 54_321,
        observeAttachments: false,
      }),
    );
    expect(cfg.observerModelId).toBe('anthropic/claude-haiku-4-5');
    expect(cfg.reflectorModelId).toBe('openai/gpt-5.4-mini');
    expect(cfg.observationThreshold).toBe(12_345);
    expect(cfg.reflectionThreshold).toBe(54_321);
    expect(cfg.observeAttachments).toBe(false);
  });

  it('persists a role model override and thresholds to settings (what the routes write)', () => {
    const settingsPath = join(tmpDir, 'settings.json');
    const settings = loadSettings(settingsPath);

    // Start on a built-in OM pack so switching one role to a custom model
    // snapshots the *other* role's resolved model (matching the TUI behavior).
    settings.models.activeOmPackId = 'anthropic';

    // The observer-model route applies the same override + snapshots the other
    // role, then sets thresholds — mirror that sequence and assert the result.
    applyOmRoleOverride(settings, 'observer', 'anthropic/claude-haiku-4-5', 'openai/gpt-5.4-mini');
    settings.models.omObservationThreshold = 20_000;
    settings.models.omReflectionThreshold = 60_000;
    settings.models.omObserveAttachments = false;
    saveSettings(settings, settingsPath);

    const reloaded = loadSettings(settingsPath);
    expect(reloaded.models.observerModelOverride).toBe('anthropic/claude-haiku-4-5');
    // Switching to a custom override snapshots the other role so it survives.
    expect(reloaded.models.reflectorModelOverride).toBe('openai/gpt-5.4-mini');
    expect(reloaded.models.activeOmPackId).toBe('custom');
    expect(reloaded.models.omObservationThreshold).toBe(20_000);
    expect(reloaded.models.omReflectionThreshold).toBe(60_000);
    expect(reloaded.models.omObserveAttachments).toBe(false);
  });
});
