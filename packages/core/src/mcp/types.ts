import type * as http from 'node:http';
import type { Context } from 'hono';
import type { ToolsInput } from '../agent';
import type { InternalCoreTool } from '../tools';

/**
 * Configuration options for an MCP server
 */
export interface MCPServerConfig {
  /**
   * Name of the MCP server
   */
  name: string;

  /**
   * Version of the MCP server
   */
  version: string;

  /**
   * Tools to register with the MCP server
   */
  tools: ToolsInput;
}

export type ConvertedTool = {
  name: string;
  description?: string;
  parameters: InternalCoreTool['parameters'];
  execute: InternalCoreTool['execute'];
};

interface MCPServerSSEOptionsBase {
  /**
   * Parsed URL of the incoming request
   */
  url: URL;

  /**
   * Path for establishing the SSE connection (e.g. '/sse')
   */
  ssePath: string;

  /**
   * Path for POSTing client messages (e.g. '/message')
   */
  messagePath: string;
}

/**
 * Options for starting an MCP server with SSE transport
 */
export interface MCPServerSSEOptions extends MCPServerSSEOptionsBase {
  /**
   * Incoming HTTP request
   */
  req: http.IncomingMessage;

  /**
   * HTTP response (must support .write/.end)
   */
  res: http.ServerResponse<http.IncomingMessage>;
}

/**
 * Options for starting an MCP server with Hono SSE transport
 */
export interface MCPServerHonoSSEOptions extends MCPServerSSEOptionsBase {
  /**
   * Incoming Hono context
   */
  context: Context;
}

export interface MCPServerHTTPOptions {
  /**
   * Parsed URL of the incoming request
   */
  url: URL;

  /**
   * Path for establishing the HTTP connection (e.g. '/mcp')
   */
  httpPath: string;

  /**
   * Incoming HTTP request
   */
  req: http.IncomingMessage;

  /**
   * HTTP response (must support .write/.end)
   */
  res: http.ServerResponse<http.IncomingMessage>;

  /**
   * Optional options to pass to the transport (e.g. sessionIdGenerator)
   */
  options?: any; // Consider typing StreamableHTTPServerTransportOptions from @modelcontextprotocol/sdk if possible
}
