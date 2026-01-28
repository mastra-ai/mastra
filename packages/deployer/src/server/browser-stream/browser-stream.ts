import { createNodeWebSocket } from '@hono/node-ws';
import type { Env, Hono, Schema } from 'hono';

import type { BrowserStreamConfig } from './types.js';
import { ViewerRegistry } from './viewer-registry.js';

/**
 * Set up WebSocket-based browser stream endpoint for real-time screencast viewing.
 *
 * Creates a WebSocket route at `/browser/:agentId/stream` that:
 * - Accepts viewer connections
 * - Starts screencast when first viewer connects
 * - Broadcasts frames to all connected viewers
 * - Stops screencast when last viewer disconnects
 *
 * @param app - The Hono application instance
 * @param config - Configuration for browser stream
 * @returns Object containing injectWebSocket function and registry instance
 *
 * @example
 * ```typescript
 * const app = new Hono();
 * const { injectWebSocket, registry } = setupBrowserStream(app, {
 *   getToolset: (agentId) => browserToolsets.get(agentId),
 * });
 *
 * const server = serve({ fetch: app.fetch, port: 4111 });
 * injectWebSocket(server);
 * ```
 */

export function setupBrowserStream<E extends Env, S extends Schema, B extends string>(
  app: Hono<E, S, B>,
  config: BrowserStreamConfig,
) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  const registry = new ViewerRegistry();

  app.get(
    '/browser/:agentId/stream',
    upgradeWebSocket(c => {
      const agentId = c.req.param('agentId');

      return {
        onOpen(_event, ws) {
          // Send connected status immediately
          ws.send(JSON.stringify({ status: 'connected' }));

          // Add to registry (starts screencast if first viewer)
          // Fire-and-forget: screencast starts asynchronously
          void registry.addViewer(agentId, ws, config.getToolset);
        },

        onMessage(_event, _ws) {
          // Future: handle input events for Phase 10+ (mouse/keyboard injection)
        },

        onClose(_event, ws) {
          // Remove from registry (stops screencast if last viewer)
          // Fire-and-forget: cleanup is best-effort
          void registry.removeViewer(agentId, ws);
        },

        onError(event, ws) {
          console.error('[BrowserStream] WebSocket error:', event);
          // Fire-and-forget: cleanup is best-effort
          void registry.removeViewer(agentId, ws);
        },
      };
    }),
  );

  return { injectWebSocket, registry };
}
