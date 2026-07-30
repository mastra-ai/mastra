import { describe, expect, it } from 'vitest';
import { injectStudioHtmlConfig } from './utils';
import type { StudioInjectionConfig } from './utils';

function baseConfig(overrides: Partial<StudioInjectionConfig> = {}): StudioInjectionConfig {
  return {
    host: "'localhost'",
    port: "'4111'",
    protocol: "'http'",
    apiPrefix: "'/api'",
    basePath: '',
    hideCloudCta: "'false'",
    cloudApiEndpoint: "''",
    experimentalFeatures: "'false'",
    templates: "'false'",
    telemetryDisabled: "''",
    requestContextPresets: "''",
    experimentalUI: "'false'",
    agentSignals: "'false'",
    signalsUI: "'false'",
    autoDetectUrl: "'false'",
    ...overrides,
  };
}

describe('injectStudioHtmlConfig $ handling', () => {
  it('injects a value containing $$ verbatim', () => {
    const html = "window.MASTRA_REQUEST_CONTEXT_PRESETS = '%%MASTRA_REQUEST_CONTEXT_PRESETS%%';";
    const value = "'a$$b'";

    const result = injectStudioHtmlConfig(html, baseConfig({ requestContextPresets: value }));

    expect(result).toBe(`window.MASTRA_REQUEST_CONTEXT_PRESETS = ${value};`);
  });

  it('injects a value containing $& verbatim', () => {
    const html = "window.MASTRA_REQUEST_CONTEXT_PRESETS = '%%MASTRA_REQUEST_CONTEXT_PRESETS%%';";
    const value = "'a$&b'";

    const result = injectStudioHtmlConfig(html, baseConfig({ requestContextPresets: value }));

    expect(result).toBe(`window.MASTRA_REQUEST_CONTEXT_PRESETS = ${value};`);
  });

  it('injects a basePath containing $ verbatim', () => {
    const html = "<base href='%%MASTRA_STUDIO_BASE_PATH%%'/> x %%MASTRA_STUDIO_BASE_PATH%%";

    const result = injectStudioHtmlConfig(html, baseConfig({ basePath: '/a$$b' }));

    expect(result).toBe("<base href='/a$$b'/> x /a$$b");
  });
});
