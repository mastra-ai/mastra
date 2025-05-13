import type { ToolsInput } from '../agent';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type {
  ConvertedTool,
  MCPServerConfig,
  MCPServerHonoSSEOptions,
  MCPServerHTTPOptions,
  MCPServerSSEOptions,
} from './types';

export * from './types';

/**
 * Abstract base class for MCP server implementations
 * This provides a common interface for all MCP servers that can be registered with Mastra
 */
export abstract class MCPServerBase extends MastraBase {
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
  public readonly convertedTools: Record<string, ConvertedTool>;

  public mastra: Mastra | undefined;

  /**
   * Get a read-only view of the registered tools (for testing/introspection).
   */
  tools(): Readonly<Record<string, ConvertedTool>> {
    return this.convertedTools;
  }

  public abstract convertTools(tools: ToolsInput): Record<string, ConvertedTool>;

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }
  /**
   * Constructor for the MCPServerBase
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

  /**
   * Start the MCP server using Hono SSE transport
   * Used for Hono servers
   * @param options Options for the SSE transport
   */
  public abstract startHonoSSE(options: MCPServerHonoSSEOptions): Promise<Response | undefined>;

  /**
   * Start the MCP server using HTTP transport
   * @param options Options for the HTTP transport
   */
  public abstract startHTTP(options: MCPServerHTTPOptions): Promise<void>;

  /**
   * Close the MCP server and all its connections
   */
  public abstract close(): Promise<void>;
}
