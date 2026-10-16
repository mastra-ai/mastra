import { z } from 'zod/v4';

import { SUPPORTED_AVATAR_MIME_TYPES } from '../../agent/avatar-store';
import type { SupportedAvatarMimeType } from '../../agent/avatar-store';
import { createTool } from '../tool';

/**
 * Adapter that produces avatar image bytes from a natural-language prompt.
 *
 * Kept generic (no direct AI SDK dependency) so callers can plug in
 * `experimental_generateImage` from AI SDK v4, `generateImage` from v5+, a
 * hosted service, or a stub for tests. Return the raw bytes and the mime type
 * so the tool never has to round-trip base64 through the LLM context window.
 */
export interface AvatarImageGenerator {
  (prompt: string): Promise<{ bytes: Buffer; mime: SupportedAvatarMimeType | (string & {}) }>;
}

/**
 * Options for {@link createSetOwnAvatarTool}.
 */
export interface CreateSetOwnAvatarToolOptions {
  /**
   * Image generator invoked with the model's prompt. The returned bytes are
   * passed straight to `agent.setAvatar` — the tool never asks the LLM to
   * emit base64, which would balloon token usage.
   */
  generateImage: AvatarImageGenerator;
  /**
   * Override the tool id (defaults to `'set_own_avatar'`).
   */
  id?: string;
  /**
   * Override the tool description shown to the model. The default nudges the
   * model to describe the desired avatar in a single prompt.
   */
  description?: string;
}

const DEFAULT_DESCRIPTION =
  "Regenerate the current agent's avatar. Provide a short natural-language prompt describing the desired image (subject, style, background, mood). The tool passes the prompt to the configured image model, persists the resulting bytes via the AvatarStore, and mirrors the update to any avatar-sync-capable channel adapters (Discord, etc.). Do NOT include or attempt to attach image bytes yourself — only the prompt.";

/**
 * Factory for a built-in "let this agent set its own avatar" tool.
 *
 * The returned tool takes a single `prompt` string, calls the configured
 * {@link AvatarImageGenerator} to produce image bytes, then calls
 * `agent.setAvatar` on the running agent. The persisted avatar URL and any
 * channel-sync results are returned to the model.
 *
 * @example
 * ```ts
 * import { experimental_generateImage } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { createSetOwnAvatarTool } from '@mastra/core/tools';
 *
 * const setOwnAvatar = createSetOwnAvatarTool({
 *   generateImage: async (prompt) => {
 *     const { image } = await experimental_generateImage({
 *       model: openai.image('dall-e-3'),
 *       prompt,
 *       size: '512x512',
 *     });
 *     return { bytes: Buffer.from(image.uint8Array), mime: image.mimeType };
 *   },
 * });
 * ```
 */
export function createSetOwnAvatarTool(options: CreateSetOwnAvatarToolOptions) {
  const { generateImage, id = 'set_own_avatar', description = DEFAULT_DESCRIPTION } = options;

  return createTool({
    id,
    description,
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe('Natural-language description of the desired avatar image (subject, style, background).'),
    }),
    execute: async ({ prompt }, context) => {
      try {
        const agentId = context?.agent?.agentId;
        if (!agentId) {
          return { ok: false as const, error: `${id} can only be called from an agent run context.` };
        }

        const mastra = context?.mastra;
        if (!mastra) {
          return { ok: false as const, error: `${id} requires a Mastra instance in the run context.` };
        }

        const getAgentById = (mastra as { getAgentById?: (id: string) => unknown }).getAgentById?.bind(mastra);
        if (!getAgentById) {
          return { ok: false as const, error: `${id} requires mastra.getAgentById to be available.` };
        }

        const agent = getAgentById(agentId) as
          | { setAvatar?: (bytes: Buffer, mime: string) => Promise<{ url: string; syncedChannels: unknown[] }> }
          | undefined;
        if (!agent?.setAvatar) {
          return { ok: false as const, error: `Agent "${agentId}" does not support setAvatar.` };
        }

        let bytes: Buffer;
        let mime: string;
        try {
          const generated = await generateImage(prompt);
          bytes = generated.bytes;
          mime = generated.mime;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { ok: false as const, error: `Image generation failed: ${message}` };
        }

        if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
          return { ok: false as const, error: 'Image generator returned no bytes.' };
        }
        if (!SUPPORTED_AVATAR_MIME_TYPES.includes(mime as SupportedAvatarMimeType)) {
          return {
            ok: false as const,
            error: `Image generator returned unsupported mime '${mime}'. Supported: ${SUPPORTED_AVATAR_MIME_TYPES.join(', ')}.`,
          };
        }

        const result = await agent.setAvatar(bytes, mime);
        return { ok: true as const, url: result.url, syncedChannels: result.syncedChannels };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { ok: false as const, error: `Failed to set avatar: ${message}` };
      }
    },
  });
}
