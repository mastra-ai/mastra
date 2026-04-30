import type { createNodeWebSocket as CreateNodeWebSocket } from '@hono/node-ws';
import { handleInputMessage, ViewerRegistry } from '@mastra/server/browser-stream';
import type { BrowserStreamConfig, BrowserStreamResult } from '@mastra/server/browser-stream';
import type { Env, Hono, Schema } from 'hono';

/**
 * Set up WebSocket-based browser stream endpoint for real-time screencast viewing.
 *
 * Creates a WebSocket route at `/browser/:agentId/stream` that:
 * - Accepts viewer connections
 * - Starts screencast when first viewer connects
 * - Broadcasts frames to all connected viewers
 * - Stops screencast when last viewer disconnects
 *
 * **Note**: Requires `ws` package to be installed. If not available, returns null
 * and logs a warning. Browser streaming will be disabled but everything else works.
 *
 * @param app - The Hono application instance
 * @param config - Configuration for browser stream
 * @returns Object containing injectWebSocket function and registry instance, or null if ws is not available
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { serve } from '@hono/node-server';
 * import { setupBrowserStream } from '@mastra/hono';
 *
 * const app = new Hono();
 * const browserStream = await setupBrowserStream(app, {
 *   getToolset: (agentId) => browserToolsets.get(agentId),
 * });
 *
 * const server = serve({ fetch: app.fetch, port: 4111 });
 * browserStream?.injectWebSocket(server);
 * ```
 */
export async function setupBrowserStream<E extends Env, S extends Schema, B extends string>(
  app: Hono<E, S, B>,
  config: BrowserStreamConfig,
): Promise<BrowserStreamResult | null> {
  // Dynamic import to avoid bundling ws into non-Node environments (e.g. Cloudflare Workers).
  // The variable-based specifier prevents bundlers from resolving the module at build time.
  let createNodeWebSocket: typeof CreateNodeWebSocket;
  try {
    const mod = '@hono/node-ws';
    const honoNodeWs = await import(/* @vite-ignore */ /* webpackIgnore: true */ mod);
    createNodeWebSocket = honoNodeWs.createNodeWebSocket;
  } catch {
    // @hono/node-ws is not available (e.g. no ws package installed).
    // This is expected in non-Node environments — silently disable browser streaming.
    return null;
  }

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  const registry = new ViewerRegistry();

  app.get(
    '/browser/:agentId/stream',
    upgradeWebSocket(c => {
      const agentId = c.req.param('agentId')!;
      const threadId = c.req.query('threadId');
      // Use composite key for thread-scoped screencasts
      const viewerKey = threadId ? `${agentId}:${threadId}` : agentId;

      return {
        onOpen(_event, ws) {
          // Send connected status immediately
          ws.send(JSON.stringify({ status: 'connected' }));

          // Add to registry (starts screencast if first viewer)
          // Fire-and-forget: screencast starts asynchronously
          // Pass agentId for toolset lookup, but viewerKey for registry scoping
          void registry.addViewer(viewerKey, ws, config.getToolset, agentId, threadId);
        },

        onMessage(event, _ws) {
          const data = typeof event.data === 'string' ? event.data : null;
          if (data) {
            void handleInputMessage(data, config.getToolset, agentId, threadId);
          }
        },

        onClose(_event, ws) {
          // Remove from registry (stops screencast if last viewer)
          // Fire-and-forget: cleanup is best-effort
          void registry.removeViewer(viewerKey, ws);
        },

        onError(event, ws) {
          console.error('[BrowserStream] WebSocket error:', event);
          // Fire-and-forget: cleanup is best-effort
          void registry.removeViewer(viewerKey, ws);
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

    const toolset = await config.getToolset(agentId);
    if (!toolset) {
      return c.json({ error: 'No browser session for this agent' }, 404);
    }

    try {
      // Parse threadId from request body
      let threadId: string | undefined;
      try {
        const body = await c.req.json();
        threadId = body?.threadId;
      } catch {
        // No body or invalid JSON - proceed without threadId
      }

      const scope = toolset.getScope();
      const viewerKey = threadId ? `${agentId}:${threadId}` : agentId;

      // For thread scope with a threadId, close only that thread's session
      if (scope === 'thread' && threadId) {
        // Close the session in the registry (stops screencast for this thread)
        await registry.closeBrowserSession(viewerKey);

        // Close just this thread's browser session
        if ('closeThreadSession' in toolset && typeof toolset.closeThreadSession === 'function') {
          await toolset.closeThreadSession(threadId);
        }
      } else {
        // For shared scope or no threadId, close the entire browser
        await registry.closeBrowserSession(viewerKey);
        await toolset.close();
      }

      return c.json({ success: true });
    } catch (error) {
      console.error(`[BrowserStream] Error closing browser for ${agentId}:`, error);
      return c.json({ error: 'Failed to close browser' }, 500);
    }
  });

  return { injectWebSocket: injectWebSocket as (server: unknown) => void, registry };
}
