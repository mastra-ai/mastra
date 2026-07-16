import { randomUUID } from 'node:crypto';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import type { ContextWithMastra, ApiRoute } from '@mastra/core/server';
import { AccessToken } from 'livekit-server-sdk';
import { DEFAULT_LIVEKIT_AGENT_NAME } from './constants';
import { serializeSessionMetadata } from './metadata';
import type { LiveKitSessionMetadata } from './metadata';

/** Response body of the connection-details route. Matches LiveKit's frontend starter contract. */
export interface LiveKitConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
}

export interface ConnectionRequestArgs {
  body: Record<string, unknown>;
  context: ContextWithMastra;
}

export interface LiveKitConnectionRouteOptions {
  /**
   * Route path. Defaults to `/voice/livekit/connection-details`. Mastra reserves the
   * `/api` prefix for built-in routes, so custom paths must not start with `/api`.
   */
  path?: string;
  /** LiveKit server URL (`wss://...`). Defaults to `LIVEKIT_URL`. */
  serverUrl?: string;
  /** Defaults to `LIVEKIT_API_KEY`. */
  apiKey?: string;
  /** Defaults to `LIVEKIT_API_SECRET`. */
  apiSecret?: string;
  /** LiveKit agent name for explicit dispatch. Must match the worker's `agentName`. */
  agentName?: string;
  /** Token time-to-live. Defaults to `'15m'`. */
  ttl?: string | number;
  /** Defaults to `true` (Mastra custom routes require auth unless opted out). */
  requiresAuth?: boolean;
  roomName?: string | ((args: ConnectionRequestArgs) => string);
  participantIdentity?: string | ((args: ConnectionRequestArgs) => string);
  /**
   * Session metadata delivered to the worker via agent dispatch. Defaults to passing
   * through `agentId`, `threadId`, and `resourceId` from the request body.
   */
  metadata?: (args: ConnectionRequestArgs) => LiveKitSessionMetadata | Promise<LiveKitSessionMetadata>;
}

function stringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * An ApiRoute for `server.apiRoutes` that mints a LiveKit access token with the Mastra
 * voice agent dispatched into the room. Frontends call it to join a voice session:
 *
 * ```ts
 * export const mastra = new Mastra({
 *   agents: { support },
 *   server: { apiRoutes: [liveKitConnectionRoute({ agentName: 'mastra-voice' })] },
 * });
 * ```
 */
export function liveKitConnectionRoute(options: LiveKitConnectionRouteOptions = {}): ApiRoute {
  const handler = async (c: ContextWithMastra) => {
    const serverUrl = options.serverUrl ?? process.env.LIVEKIT_URL;
    const apiKey = options.apiKey ?? process.env.LIVEKIT_API_KEY;
    const apiSecret = options.apiSecret ?? process.env.LIVEKIT_API_SECRET;
    if (!serverUrl || !apiKey || !apiSecret) {
      return c.json(
        {
          error:
            'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET ' +
            '(or pass serverUrl/apiKey/apiSecret to liveKitConnectionRoute).',
        },
        500,
      );
    }

    const body: Record<string, unknown> = await c.req
      .json()
      .then((parsed: unknown) =>
        parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {},
      )
      .catch(() => ({}));
    const args: ConnectionRequestArgs = { body, context: c };

    const metadata: LiveKitSessionMetadata = options.metadata
      ? await options.metadata(args)
      : {
          agentId: stringField(body, 'agentId'),
          threadId: stringField(body, 'threadId'),
          resourceId: stringField(body, 'resourceId'),
        };

    const roomName =
      typeof options.roomName === 'function'
        ? options.roomName(args)
        : (options.roomName ?? `mastra-voice-${randomUUID().slice(0, 8)}`);
    const identity =
      typeof options.participantIdentity === 'function'
        ? options.participantIdentity(args)
        : (options.participantIdentity ?? metadata.resourceId ?? `user-${randomUUID().slice(0, 8)}`);
    // One memory thread per room unless the caller pins a thread explicitly.
    metadata.threadId ??= roomName;

    const token = new AccessToken(apiKey, apiSecret, { identity, ttl: options.ttl ?? '15m' });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });
    token.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: options.agentName ?? DEFAULT_LIVEKIT_AGENT_NAME,
          metadata: serializeSessionMetadata(metadata),
        }),
      ],
    });

    const details: LiveKitConnectionDetails = {
      serverUrl,
      roomName,
      participantName: identity,
      participantToken: await token.toJwt(),
    };
    return c.json(details);
  };

  return {
    // Studio hardcodes this default and the server's /api/system/packages reports its
    // presence as liveKitConnectionRouteEnabled — change it in lockstep with both.
    path: options.path ?? '/voice/livekit/connection-details',
    method: 'POST',
    requiresAuth: options.requiresAuth,
    handler,
  } as ApiRoute;
}
