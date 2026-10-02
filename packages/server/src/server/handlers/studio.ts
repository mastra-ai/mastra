import { HTTPException } from '../http-exception';
import type { ServerContext } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { MCPHttpTransportResult } from './mcp';

export const STUDIO_MCP_ROUTE = createRoute({
  method: 'ALL',
  path: '/studio/mcp',
  responseType: 'mcp-http',
  summary: 'Mastra Studio MCP App',
  description: 'Opens the public Studio trace viewer in an MCP Apps host.',
  tags: ['Studio'],
  // Only a UI shell and public connection information are served here. The UI
  // reads the existing observability endpoints, which retain their auth policy.
  requiresAuth: false,
  handler: async ({ request, routePrefix }: ServerContext): Promise<MCPHttpTransportResult> => {
    if (!request) throw new HTTPException(500, { message: 'Studio MCP requires the HTTP request context' });
    // Reverse proxies may terminate HTTPS before the adapter sees the request.
    // Use an explicit public URL in that case; never trust forwarded host headers.
    const configuredUrl = process.env.MASTRA_STUDIO_PUBLIC_URL;
    const publicUrl = new URL(configuredUrl || new URL(request.url).origin);
    if (
      !['http:', 'https:'].includes(publicUrl.protocol) ||
      publicUrl.username ||
      publicUrl.password ||
      publicUrl.search ||
      publicUrl.hash
    ) {
      throw new HTTPException(500, {
        message:
          'MASTRA_STUDIO_PUBLIC_URL must be an HTTP(S) base URL without credentials, query parameters, or a fragment',
      });
    }
    const { createStudioMcpServer } = await import('../studio/mcp-app');
    return {
      server: createStudioMcpServer({ baseUrl: publicUrl.href.replace(/\/$/, ''), apiPrefix: routePrefix ?? '/api' }),
      httpPath: '/studio/mcp',
    };
  },
});
