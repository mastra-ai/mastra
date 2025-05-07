import type { z } from 'zod';
import type { ToolsInput } from '../agent';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';

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
  inputSchema: any;
  zodSchema: z.ZodTypeAny;
  execute: any;
};

/**
 * Abstract base class for MCP server implementations
 * This provides a common interface for all MCP servers that can be registered with Mastra
 */
export abstract class MastraMCPServer extends MastraBase {
  /**
   * Name of the MCP server
   */
  public readonly name: string;

  /**
   * Version of the MCP server
   */
  public readonly version: string;

  /**
   * Tools registered with the MCP server
   */
  convertedTools: Record<string, ConvertedTool>;

  /**
   * Get a read-only view of the registered tools (for testing/introspection).
   */
  tools(): Readonly<Record<string, ConvertedTool>> {
    return this.convertedTools;
  }

  convertTools(tools: ToolsInput): Record<string, ConvertedTool> {
    console.error('Converting tools:', tools);
    throw new Error('Not implemented');
  }

  /**
   * Constructor for the MastraMCPServer
   * @param config Configuration options for the MCP server
   */
  constructor(config: MCPServerConfig) {
    super({ component: RegisteredLogger.MCP_SERVER, name: config.name });
    this.name = config.name;
    this.version = config.version;
    this.convertedTools = this.convertTools(config.tools);
  }

  /**
   * Start the MCP server using stdio transport
   * This is typically used for Windsurf integration
   */
  public abstract startStdio(): Promise<void>;

  /**
   * Start the MCP server using SSE transport
   * This is typically used for web integration
   * @param options Options for the SSE transport
   */
  public abstract startSSE(options: MCPServerSSEOptions): Promise<void>;

  public abstract startHTTP({
    url,
    httpPath,
    req,
    res,
    options,
  }: {
    url: URL;
    httpPath: string;
    req: any;
    res: any;
    options?: any;
  }): Promise<void>;

  /**
   * Close the MCP server and all its connections
   */
  public abstract close(): Promise<void>;
}

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
  req: any;

  /**
   * HTTP response (must support .write/.end)
   */
  res: any;
}
