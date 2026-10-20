import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2ePrepareContext, McE2eScenario } from './types.js';

/**
 * `/om` previews the memory model 'auto' picks with the same credential check runs
 * use: any usable Google credential (either Google env var, or a stored key) prefers
 * Gemini Flash; with Anthropic only, Auto follows the main model to Haiku.
 */
function prepareAnthropicMain({ appDataDir }: McE2ePrepareContext, storedGoogleKey?: string) {
  const settingsPath = join(appDataDir, 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
  settings.onboarding = { ...settings.onboarding, completedAt: new Date(0).toISOString(), skippedAt: null, version: 1 };
  settings.models = {
    ...settings.models,
    activeModelPackId: 'anthropic',
    modeDefaults: { ...settings.models?.modeDefaults, build: 'anthropic/claude-sonnet-4-5' },
    activeOmPackId: null,
    omModelOverride: null,
    observerModelOverride: null,
    observerModelSelection: 'auto',
    reflectorModelOverride: null,
    reflectorModelSelection: 'auto',
  };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  mkdirSync(appDataDir, { recursive: true });
  writeFileSync(
    join(appDataDir, 'auth.json'),
    JSON.stringify(storedGoogleKey ? { 'apikey:google': { type: 'api_key', key: storedGoogleKey } } : {}, null, 2),
  );
}

const noGoogleEnv = {
  ANTHROPIC_API_KEY: 'mc-om-auto-preview-anthropic',
  GOOGLE_GENERATIVE_AI_API_KEY: '',
  GOOGLE_API_KEY: '',
  MASTRA_GATEWAY_API_KEY: '',
};

function expectAutoPreview(expectedModel: string): McE2eScenario['run'] {
  return async ({ terminal, runtime }) => {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    const pattern = new RegExp(`Observer model\\s+Auto \\(${expectedModel}\\)`, 'i');
    await runtime.waitForScreenText(pattern, terminal, 8_000);
    await runtime.waitForScreenText(new RegExp(`Reflector model\\s+Auto \\(${expectedModel}\\)`, 'i'), terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);
    terminal.keyCtrlC();
  };
}

export const omAutoPreviewGoogleApiKeyScenario: McE2eScenario = {
  name: 'om-auto-preview-google-api-key',
  description: '/om previews Gemini when only GOOGLE_API_KEY provides Google access.',
  testName: 'previews Gemini Flash for Auto memory with GOOGLE_API_KEY and an Anthropic main model',
  enableObservationalMemory: true,
  env: () => ({ ...noGoogleEnv, GOOGLE_API_KEY: 'mc-om-auto-preview-google' }),
  prepare: context => prepareAnthropicMain(context),
  run: expectAutoPreview('gemini-3.5-flash'),
};

export const omAutoPreviewStoredGoogleKeyScenario: McE2eScenario = {
  name: 'om-auto-preview-stored-google-key',
  description: '/om previews Gemini when a Google API key is stored in auth.json.',
  testName: 'previews Gemini Flash for Auto memory with a stored Google key and an Anthropic main model',
  enableObservationalMemory: true,
  env: () => noGoogleEnv,
  prepare: context => prepareAnthropicMain(context, 'mc-om-auto-preview-stored-google'),
  run: expectAutoPreview('gemini-3.5-flash'),
};

export const omAutoPreviewAnthropicOnlyScenario: McE2eScenario = {
  name: 'om-auto-preview-anthropic-only',
  description: '/om previews Haiku when Anthropic is the only usable provider.',
  testName: 'previews Haiku for Auto memory with only Anthropic credentials',
  enableObservationalMemory: true,
  env: () => noGoogleEnv,
  prepare: context => prepareAnthropicMain(context),
  run: expectAutoPreview('claude-haiku-4-5'),
};
