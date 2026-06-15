/**
 * Upstash Box sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { upstashBoxSandboxProvider } from '@mastra/upstash-box';
 *
 * const editor = new MastraEditor({
 *   sandboxes: { [upstashBoxSandboxProvider.id]: upstashBoxSandboxProvider },
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';
import type { NetworkPolicy } from '@upstash/box';
import { UpstashBoxSandbox } from './sandbox';

/**
 * Serializable subset of UpstashBoxSandboxOptions for editor storage.
 * (`instructions` is omitted because its function form isn't JSON-serializable.)
 */
interface UpstashBoxProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  boxId?: string;
  runtime?: 'node' | 'python' | 'golang' | 'ruby' | 'rust';
  size?: 'small' | 'medium' | 'large';
  keepAlive?: boolean;
  env?: Record<string, string>;
  workdir?: string;
  networkPolicy?: NetworkPolicy;
  skills?: string[];
  timeout?: number;
  requestTimeout?: number;
  debug?: boolean;
}

export const upstashBoxSandboxProvider: SandboxProvider<UpstashBoxProviderConfig> = {
  id: 'upstash-box',
  name: 'Upstash Box Sandbox',
  description: 'Managed, disposable cloud sandbox for AI coding agents powered by Upstash Box',
  configSchema: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', description: 'Box API key (falls back to UPSTASH_BOX_API_KEY)' },
      baseUrl: { type: 'string', description: 'Box API base URL (falls back to UPSTASH_BOX_BASE_URL)' },
      boxId: { type: 'string', description: 'Reconnect to an existing box by its server-side id' },
      runtime: {
        type: 'string',
        description: 'Runtime preinstalled in the box',
        enum: ['node', 'python', 'golang', 'ruby', 'rust'],
        default: 'node',
      },
      size: {
        type: 'string',
        description: 'Resource size of the box',
        enum: ['small', 'medium', 'large'],
        default: 'small',
      },
      keepAlive: { type: 'boolean', description: 'Keep the box alive instead of letting it idle-pause' },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      workdir: { type: 'string', description: 'Default working directory for spawned commands' },
      networkPolicy: { type: 'object', description: 'Outbound network access policy' },
      skills: {
        type: 'array',
        description: "GitHub 'owner/repo' skills to install on the box",
        items: { type: 'string' },
      },
      timeout: { type: 'number', description: 'Default command timeout in ms (commands without their own)' },
      requestTimeout: { type: 'number', description: 'Request timeout in ms for Box API calls' },
      debug: { type: 'boolean', description: 'Enable Box SDK debug logging' },
    },
  },
  createSandbox: config => new UpstashBoxSandbox(config),
};
