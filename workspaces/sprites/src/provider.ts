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
 *
 * `baseURL` is deliberately excluded: the sandbox falls back to the server's
 * SPRITES_TOKEN, so a stored API host could redirect that token elsewhere.
 */
interface SpritesProviderConfig {
  id?: string;
  token?: string;
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
      env: {
        type: 'object',
        description: 'Environment variables',
        additionalProperties: { type: 'string' },
      },
      timeout: { type: 'number', description: 'Default command timeout in ms' },
      workingDirectory: { type: 'string', description: 'Default working directory for commands' },
    },
  },
  // Pick known fields so extra stored keys (such as baseURL) never reach the sandbox.
  createSandbox: ({ id, token, env, timeout, workingDirectory }) =>
    new SpritesSandbox({ id, token, env, timeout, workingDirectory }),
};
