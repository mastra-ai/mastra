import { LIST_MCP_SERVERS_ROUTE, GET_MCP_SERVER_DETAIL_ROUTE } from '../../handlers/mcp';
import type { ServerRoute } from '.';

export const MCP_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_MCP_SERVERS_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  // Note: getMcpServerMessageHandler is not included here because it requires
  // direct access to raw Node.js req/res and doesn't fit the standard route pattern.
  // It should be registered directly with the router using its standalone handler function.
];
