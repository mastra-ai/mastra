import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import { agentIdPathParams } from '../schemas/agents';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

/**
 * GET /agents/:agentId/avatar
 *
 * Streams the raw avatar bytes for `agentId` from the configured `AvatarStore`.
 * Returns 404 when no store is configured or no avatar has been persisted for
 * this agent. Callers must already hold `agents:read` for the agent; the same
 * permission gates `GET /agents/:agentId` so both surfaces are consistent.
 *
 * The response uses the stored mime type verbatim so an `<img src>` element can
 * render the returned bytes directly. Cache-Control is deliberately short and
 * private so overwrites via `agent.setAvatar()` become visible quickly.
 */
export const GET_AGENT_AVATAR_ROUTE = createRoute({
  method: 'GET' as const,
  path: '/agents/:agentId/avatar',
  responseType: 'datastream-response' as const,
  pathParamSchema: agentIdPathParams,
  summary: 'Get agent avatar bytes',
  description:
    'Returns the raw avatar image bytes for an agent from the configured AvatarStore. 404 when no store is configured, no avatar is stored, or the agent has no `metadata.avatarUrl` starting with `mastra-avatar:`. The Content-Type header reflects the stored mime type.',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  handler: async ({ agentId, mastra }) => {
    try {
      const store = (mastra as { getAvatarStore?: () => unknown }).getAvatarStore?.() as
        | {
            get: (id: string) => Promise<{ bytes: Buffer; mime: string } | null>;
          }
        | undefined;

      if (!store) {
        throw new HTTPException(404, { message: 'No AvatarStore configured' });
      }

      const stored = await store.get(agentId);
      if (!stored) {
        throw new HTTPException(404, { message: `No avatar stored for agent ${agentId}` });
      }

      // Convert Node Buffer to a fresh ArrayBuffer view so `new Response(...)`
      // doesn't leak the buffer's underlying pool memory to the client.
      const view = new Uint8Array(stored.bytes.byteLength);
      view.set(stored.bytes);

      return new Response(view, {
        status: 200,
        headers: {
          'Content-Type': stored.mime,
          'Content-Length': String(view.byteLength),
          'Cache-Control': 'private, max-age=60',
        },
      });
    } catch (error) {
      return handleError(error, 'Error reading agent avatar');
    }
  },
});
