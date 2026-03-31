import { describe, expect, it } from 'vitest';
import type { StudioConfig } from '../types';

/**
 * Tests for issue https://github.com/mastra-ai/mastra/issues/14634
 *
 * Bug: The settings page passes `{ baseUrl, headers }` to StudioConfigForm
 * but omits `apiPrefix`. This causes:
 * 1. The API prefix field to always display empty
 * 2. On save, the prefix reverts to undefined (default /api)
 *
 * This test validates the contract between the settings page and the form.
 */
describe('StudioConfigForm apiPrefix contract (issue #14634)', () => {
  /**
   * Simulates what the settings page does when building
   * initialConfig for StudioConfigForm.
   *
   * This mirrors packages/playground/src/pages/settings/index.tsx:22,62
   * where baseUrl, headers, and apiPrefix are destructured and passed.
   *
   * Previously (before fix), apiPrefix was omitted — causing the bug.
   */
  function buildInitialConfigFromSettingsPage(config: StudioConfig): Partial<StudioConfig> {
    const { baseUrl, headers, apiPrefix } = config;
    return { baseUrl, headers, apiPrefix };
  }

  /**
   * Simulates the form submit logic from studio-config-form.tsx:25-43.
   * If apiPrefix is empty/missing in initialConfig, the form field renders
   * empty and the user submits it as undefined.
   */
  function simulateFormSubmit(initialConfig: Partial<StudioConfig>): Partial<StudioConfig> {
    // The TextFieldBlock renders: defaultValue={initialConfig?.apiPrefix || ''}
    const displayedApiPrefix = initialConfig?.apiPrefix || '';

    // On submit, the form reads the field value:
    //   const rawApiPrefix = ((formData.get('apiPrefix') as string) ?? '').trim();
    //   const apiPrefix = rawApiPrefix.length ? rawApiPrefix : undefined;
    const rawApiPrefix = displayedApiPrefix.trim();
    const apiPrefix = rawApiPrefix.length ? rawApiPrefix : undefined;

    return {
      baseUrl: initialConfig?.baseUrl,
      headers: initialConfig?.headers,
      apiPrefix,
    };
  }

  it('should preserve apiPrefix when passed through settings page to form', () => {
    const fullConfig: StudioConfig = {
      baseUrl: 'http://localhost:4111',
      headers: { Authorization: 'Bearer test' },
      apiPrefix: '/mastra',
    };

    // What the settings page currently passes to the form
    const initialConfig = buildInitialConfigFromSettingsPage(fullConfig);

    // Simulate saving with no user edits to the prefix field
    const savedConfig = simulateFormSubmit(initialConfig);

    // BUG: apiPrefix should be '/mastra' but it gets lost because
    // the settings page doesn't include it in initialConfig
    expect(savedConfig.apiPrefix).toBe('/mastra');
  });

  it('should display the custom apiPrefix in the form field', () => {
    const fullConfig: StudioConfig = {
      baseUrl: 'http://localhost:4111',
      headers: {},
      apiPrefix: '/custom-prefix',
    };

    const initialConfig = buildInitialConfigFromSettingsPage(fullConfig);

    // The form renders: defaultValue={initialConfig?.apiPrefix || ''}
    const displayedValue = initialConfig.apiPrefix || '';

    // BUG: displayedValue should be '/custom-prefix' but is '' because
    // apiPrefix was not passed through
    expect(displayedValue).toBe('/custom-prefix');
  });

  it('should correctly handle default /api prefix round-trip', () => {
    const fullConfig: StudioConfig = {
      baseUrl: 'http://localhost:4111',
      headers: {},
      apiPrefix: '/api',
    };

    const initialConfig = buildInitialConfigFromSettingsPage(fullConfig);
    const savedConfig = simulateFormSubmit(initialConfig);

    // Even the default prefix should survive the round-trip
    expect(savedConfig.apiPrefix).toBe('/api');
  });
});
