import type * as http from 'node:http';
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

/**
 * Options for starting an MCP server with SSE transport
 */
export interface MCPServerSSEOptions {
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

  /**
   * Incoming HTTP request
   */
  req: http.IncomingMessage;

  /**
   * HTTP response (must support .write/.end)
   */
  res: http.ServerResponse<http.IncomingMessage>;
}
