import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import { agentIdPathParams } from '../schemas/agents';
import { createRoute } from '../server-adapter/routes/route-builder';
import { assertStoredResourceScope, getStoredResourceScope } from '../utils';

import { assertReadAccess } from './authorship';
import { handleError } from './error';

/**
 * GET /agents/:agentId/avatar
 *
 * Streams the raw avatar bytes for `agentId` from the configured `AvatarStore`.
 * Returns 404 when no store is configured or no avatar has been persisted for
 * this agent.
 *
 * Authorization: the caller must (a) hold `agents:read` on the resource, AND
 * (b) if a stored-agent record exists for `agentId`, satisfy the same scope
 * and read-access checks used by `GET /stored/agents/:storedAgentId`. Code-
 * defined agents with no stored record fall back to the flat `agents:read`
 * permission only.
 *
 * The response uses the stored mime type verbatim so an `<img src>` element can
 * render the returned bytes directly, EXCEPT for `image/svg+xml`: SVG bytes
 * can carry inline JavaScript, so the response is served with a locked-down
 * Content-Security-Policy and `Content-Disposition: attachment` to prevent
 * script execution under the server origin. Cache-Control is deliberately
 * short and private so overwrites via `agent.setAvatar()` become visible
 * quickly.
 */
export const GET_AGENT_AVATAR_ROUTE = createRoute({
  method: 'GET' as const,
  path: '/agents/:agentId/avatar',
  responseType: 'datastream-response' as const,
  pathParamSchema: agentIdPathParams,
  summary: 'Get agent avatar bytes',
  description:
    'Returns the raw avatar image bytes for an agent from the configured AvatarStore. 404 when no store is configured, no avatar is stored, or the agent has no `metadata.avatarUrl` starting with `mastra-avatar:`. The Content-Type header reflects the stored mime type; SVG responses are served with a strict CSP and `Content-Disposition: attachment` to prevent script execution.',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  handler: async ctx => {
    const { agentId, mastra, requestContext } = ctx as {
      agentId: string;
      mastra: any;
      requestContext: any;
    };
    try {
      // If a stored-agent record exists, apply the same scope + read-access
      // checks that gate `GET /stored/agents/:storedAgentId`. This prevents a
      // caller with the flat `agents:read` permission from reading a private
      // stored agent's avatar bytes when they wouldn't be able to read the
      // agent record itself. Code-defined agents (no stored record) fall
      // through to the flat permission check that already gated this route.
      try {
        const storage = mastra.getStorage?.();
        const agentsStore = storage ? await storage.getStore?.('agents') : undefined;
        const record = agentsStore ? await agentsStore.getById?.(agentId) : undefined;
        if (record) {
          assertStoredResourceScope(record, await getStoredResourceScope(mastra, requestContext));
          assertReadAccess({
            requestContext,
            resource: 'stored-agents',
            resourceId: agentId,
            record,
          });
        }
      } catch (authErr) {
        // Re-throw HTTPException (403/404 from scope/read checks) unchanged.
        if (authErr instanceof HTTPException) throw authErr;
        // Storage lookup failures shouldn't leak avatar bytes — fail closed.
        throw new HTTPException(500, { message: 'Failed to authorize agent avatar access' });
      }

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

      const headers: Record<string, string> = {
        'Content-Type': stored.mime,
        'Content-Length': String(view.byteLength),
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      };

      // SVG isolation: SVG bytes can contain inline <script>. Serve with a
      // sandbox CSP that disables script/plugin execution, and force the
      // browser to treat the response as a download so direct navigation
      // can't execute scripts under the server origin. Rendering via
      // <img src> stays safe (browsers ignore scripts in <img>-loaded SVGs).
      if (stored.mime === 'image/svg+xml') {
        headers['Content-Security-Policy'] =
          "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; sandbox";
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(agentId)}.svg"`;
      }

      return new Response(view, { status: 200, headers });
    } catch (error) {
      return handleError(error, 'Error reading agent avatar');
    }
  },
});
