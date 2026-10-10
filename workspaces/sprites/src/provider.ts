/**
 * Fly.io Sprites sandbox provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { spritesSandboxProvider } from '@mastra/sprites';
 *
 * const editor = new MastraEditor({
 *   sandboxes: { [spritesSandboxProvider.id]: spritesSandboxProvider },
 * });
 * ```
 */
import type { SandboxProvider } from '@mastra/core/editor';
import { SpritesSandbox } from './sandbox';

/**
 * Serializable subset of SpritesSandboxOptions for editor storage.
 */
interface SpritesProviderConfig {
  id?: string;
  token?: string;
  baseURL?: string;
  env?: Record<string, string>;
  timeout?: number;
  workingDirectory?: string;
}

export const spritesSandboxProvider: SandboxProvider<SpritesProviderConfig> = {
  id: 'sprites',
  name: 'Fly.io Sprites',
  description: 'Persistent Linux VM powered by Fly.io Sprites',
  configSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Sprite name. An existing Sprite with this name is reused.' },
      token: { type: 'string', description: 'Sprites API token (falls back to SPRITES_TOKEN)' },
      baseURL: { type: 'string', description: 'Sprites API base URL' },
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      timeout: { type: 'number', description: 'Default command timeout in ms' },
      workingDirectory: { type: 'string', description: 'Default working directory for commands' },
    },
  },
  createSandbox: config => new SpritesSandbox(config),
};
