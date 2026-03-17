/**
 * DNS-AID integration for Mastra.
 *
 * Wraps the dns-aid MCP server via stdio transport, providing
 * DNS-based agent discovery as Mastra tools.
 *
 * Requires Python and dns-aid installed: pip install dns-aid
 */

import { spawn, ChildProcess } from "child_process";

interface DnsAidConfig {
  /** Path to Python executable. Defaults to "python". */
  pythonPath?: string;
}

interface ToolResult {
  content?: Array<{ type: string; text: string }>;
  error?: string;
}

/**
 * DNS-AID integration for Mastra.
 *
 * @example
 * ```ts
 * const dnsAid = new DnsAidIntegration();
 * const result = await dnsAid.discoverAgents("agents.example.com");
 * ```
 */
export class DnsAidIntegration {
  private pythonPath: string;

  constructor(config: DnsAidConfig = {}) {
    this.pythonPath = config.pythonPath ?? "python";
  }

  /**
   * Discover agents at a domain via DNS-AID.
   */
  async discoverAgents(
    domain: string,
    protocol?: string
  ): Promise<unknown> {
    const params: Record<string, unknown> = { domain };
    if (protocol) params.protocol = protocol;
    return this.callMcpTool("discover_agents_via_dns", params);
  }

  /**
   * Publish an agent to DNS via DNS-AID.
   */
  async publishAgent(params: {
    name: string;
    domain: string;
    protocol?: string;
    endpoint: string;
    port?: number;
    capabilities?: string[];
  }): Promise<unknown> {
    return this.callMcpTool("publish_agent_to_dns", params);
  }

  /**
   * Remove an agent from DNS via DNS-AID.
   */
  async unpublishAgent(
    name: string,
    domain: string,
    protocol: string = "mcp"
  ): Promise<unknown> {
    return this.callMcpTool("delete_agent_from_dns", { name, domain, protocol });
  }

  /**
   * Get Mastra-compatible tool definitions.
   */
  getTools(): Record<string, unknown> {
    return {
      discover_agents: {
        label: "Discover Agents via DNS-AID",
        description:
          "Query DNS SVCB records to find AI agents at a domain",
        schema: {
          type: "object" as const,
          properties: {
            domain: {
              type: "string",
              description: "Domain to search",
            },
            protocol: {
              type: "string",
              description: "Filter by protocol: a2a, mcp, https",
            },
          },
          required: ["domain"],
        },
        executor: async (params: { domain: string; protocol?: string }) =>
          this.discoverAgents(params.domain, params.protocol),
      },
      publish_agent: {
        label: "Publish Agent to DNS",
        description: "Create DNS-AID records for an AI agent",
        schema: {
          type: "object" as const,
          properties: {
            name: { type: "string" },
            domain: { type: "string" },
            protocol: { type: "string", default: "mcp" },
            endpoint: { type: "string" },
          },
          required: ["name", "domain", "endpoint"],
        },
        executor: async (params: {
          name: string;
          domain: string;
          protocol?: string;
          endpoint: string;
        }) => this.publishAgent(params),
      },
    };
  }

  private async callMcpTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error(`dns-aid MCP server timed out after 30s`));
      }, 30_000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (!proc.killed) proc.kill();
      };

      const proc: ChildProcess = spawn(this.pythonPath, [
        "-m",
        "dns_aid.mcp",
        "--transport",
        "stdio",
      ]);

      const request = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: toolName, arguments: params },
        id: 1,
      });

      let output = "";
      proc.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });

      proc.on("error", (err: Error) => {
        cleanup();
        reject(
          new Error(
            `Failed to start dns-aid MCP server: ${err.message}. ` +
              `Ensure Python and dns-aid are installed.`
          )
        );
      });

      proc.on("close", (code: number | null) => {
        cleanup();
        if (code !== 0 && !output) {
          reject(new Error(`dns-aid MCP server exited with code ${code}`));
          return;
        }
        try {
          const lines = output.trim().split("\n");
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          resolve(response.result ?? response);
        } catch {
          reject(new Error(`Failed to parse MCP response: ${output}`));
        }
      });

      proc.stdin?.write(request + "\n");
      proc.stdin?.end();
    });
  }
}

export default DnsAidIntegration;
