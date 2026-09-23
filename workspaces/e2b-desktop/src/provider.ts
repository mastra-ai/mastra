/**
 * E2B Desktop sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { e2bDesktopSandboxProvider } from '@mastra/e2b-desktop';
 *
 * const editor = new MastraEditor({
 *   sandboxes: [e2bDesktopSandboxProvider],
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';
import { E2BDesktopSandbox } from './sandbox';

/**
 * Serializable subset of E2BDesktopSandboxOptions for editor storage.
 * Non-serializable options (TemplateBuilder callbacks, runtime objects) are excluded.
 */
interface E2BDesktopProviderConfig {
  template?: string;
  timeout?: number;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
  resolution?: [number, number];
  dpi?: number;
  domain?: string;
  apiUrl?: string;
  apiKey?: string;
  accessToken?: string;
}

export const e2bDesktopSandboxProvider: SandboxProvider<E2BDesktopProviderConfig> = {
  id: 'e2b-desktop',
  name: 'E2B Desktop Sandbox',
  description: 'Cloud desktop (computer-use) sandbox powered by E2B',
  configSchema: {
    type: 'object',
    properties: {
      template: { type: 'string', description: 'Sandbox template ID (defaults to the E2B desktop template)' },
      timeout: { type: 'number', description: 'Execution timeout in milliseconds', default: 300000 },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      metadata: {
        type: 'object',
        description: 'Custom metadata',
        additionalProperties: true,
      },
      resolution: {
        type: 'array',
        description: 'Desktop resolution as [width, height] in pixels',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
      },
      dpi: { type: 'number', description: 'Desktop display DPI' },
      domain: { type: 'string', description: 'Domain for self-hosted E2B' },
      apiUrl: { type: 'string', description: 'API URL for self-hosted E2B' },
      apiKey: { type: 'string', description: 'E2B API key' },
      accessToken: { type: 'string', description: 'E2B access token' },
    },
  },
  createSandbox: config => {
    const { resolution, ...rest } = config;
    return new E2BDesktopSandbox({
      ...rest,
      ...(resolution && { resolution: [resolution[0]!, resolution[1]!] }),
    });
  },
};
