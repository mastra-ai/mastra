import { createNodeWebSocket } from '@hono/node-ws';
import type { Env, Hono, Schema } from 'hono';

import { handleInputMessage } from './input-handler.js';
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

        onMessage(event, _ws) {
          const data = typeof event.data === 'string' ? event.data : null;
          if (data) {
            handleInputMessage(data, config.getToolset, agentId);
          }
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

  // Close browser session endpoint
  app.post('/api/agents/:agentId/browser/close', async c => {
    const agentId = c.req.param('agentId');
    if (!agentId) {
      return c.json({ error: 'Agent ID is required' }, 400);
    }

    const toolset = config.getToolset(agentId);
    if (!toolset) {
      return c.json({ error: 'No browser session for this agent' }, 404);
    }

    try {
      // First, close the session in the registry (stops screencast, notifies viewers)
      await registry.closeBrowserSession(agentId);

      // Then close the browser toolset
      await toolset.close();

      return c.json({ success: true });
    } catch (error) {
      console.error(`[BrowserStream] Error closing browser for ${agentId}:`, error);
      return c.json({ error: 'Failed to close browser' }, 500);
    }
  });

  return { injectWebSocket, registry };
}
