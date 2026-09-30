import { z } from 'zod/v4';

import { SUPPORTED_AVATAR_MIME_TYPES } from '../../agent/avatar-store';
import { createTool } from '../tool';

const mimeSchema = z.enum(SUPPORTED_AVATAR_MIME_TYPES as unknown as [string, ...string[]]);

/**
 * Built-in tool: let an agent set its own avatar image.
 *
 * The tool decodes the base64 bytes, resolves the current agent via the run
 * context, and calls `agent.setAvatar(bytes, mime)`. The avatar is written to
 * the configured `AvatarStore` (workspace-backed when a workspace filesystem
 * is attached, otherwise a local dir) and the stored-agent record's
 * `metadata.avatarUrl` is updated to the returned URL (typically
 * `mastra-avatar:<agentId>`).
 *
 * When the agent has channel adapters that implement `setAvatar`, the tool
 * fans out to sync each channel; per-channel failures are surfaced in the
 * `syncedChannels` result but do not fail the overall call.
 */
export const setOwnAvatarTool = createTool({
  id: 'set_own_avatar',
  description:
    "Set the current agent's avatar image. Provide the raw image as base64-encoded bytes and its MIME type. The avatar is persisted via the configured AvatarStore and mirrored to any avatar-sync-capable channel adapters (Discord, Slack, etc.). Use for agents that generate their own avatars (e.g. via an image-generation tool).",
  inputSchema: z.object({
    bytes: z.string().min(1).describe('Base64-encoded image bytes.'),
    mime: mimeSchema.describe('MIME type of the image.'),
  }),
  execute: async ({ bytes, mime }, context) => {
    try {
      const agentId = context?.agent?.agentId;
      if (!agentId) {
        return { ok: false, error: 'set_own_avatar can only be called from an agent run context.' };
      }

      const mastra = context?.mastra;
      if (!mastra) {
        return { ok: false, error: 'set_own_avatar requires a Mastra instance in the run context.' };
      }

      const getAgentById = (mastra as { getAgentById?: (id: string) => unknown }).getAgentById?.bind(mastra);
      if (!getAgentById) {
        return { ok: false, error: 'set_own_avatar requires mastra.getAgentById to be available.' };
      }

      const agent = getAgentById(agentId) as
        | { setAvatar?: (bytes: Buffer, mime: string) => Promise<{ url: string; syncedChannels: unknown[] }> }
        | undefined;
      if (!agent?.setAvatar) {
        return { ok: false, error: `Agent "${agentId}" does not support setAvatar.` };
      }

      let decoded: Buffer;
      try {
        decoded = Buffer.from(bytes, 'base64');
      } catch {
        return { ok: false, error: 'Failed to decode base64 bytes.' };
      }
      if (decoded.length === 0) {
        return { ok: false, error: 'Decoded avatar bytes were empty.' };
      }

      const result = await agent.setAvatar(decoded, mime);
      return { ok: true, url: result.url, syncedChannels: result.syncedChannels };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: `Failed to set avatar: ${message}` };
    }
  },
});
