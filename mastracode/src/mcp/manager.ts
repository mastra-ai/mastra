/**
 * MCPManager — high-level orchestration for MCP server connections.
 * Created once at startup, provides tools from connected MCP servers.
 *
 * Uses Mastra's MCPClient which handles per-server connections and
 * namespaces tools as serverName_toolName automatically.
 */

import { MCPClient } from "@mastra/mcp"
import type { McpConfig, McpServerStatus } from "./types.js"
import {
	loadMcpConfig,
	getProjectMcpPath,
	getGlobalMcpPath,
	getClaudeSettingsPath,
} from "./config.js"

export class MCPManager {
	private config: McpConfig
	private projectDir: string
	private client: MCPClient | null = null
	private tools: Record<string, any> = {}
	private serverStatuses: Map<string, McpServerStatus> = new Map()
	private initialized = false

	constructor(projectDir: string) {
		this.projectDir = projectDir
		this.config = loadMcpConfig(projectDir)
	}

	/**
	 * Connect to all configured MCP servers and collect their tools.
	 * Errors on individual servers are caught and logged, not thrown.
	 */
	async init(): Promise<void> {
		if (this.initialized) return

		const servers = this.config.mcpServers
		if (!servers || Object.keys(servers).length === 0) {
			this.initialized = true
			return
		}

		// Build server definitions for MCPClient
		const serverDefs: Record<
			string,
			{ command: string; args?: string[]; env?: Record<string, string> }
		> = {}
		for (const [name, cfg] of Object.entries(servers)) {
			serverDefs[name] = {
				command: cfg.command,
				args: cfg.args,
				env: cfg.env,
			}
		}

		try {
			this.client = new MCPClient({
				id: "mastra-code-mcp",
				servers: serverDefs,
			})

			// listTools() connects to servers and returns namespaced tools
			// Tool names are serverName_toolName (handled by MCPClient)
			this.tools = await this.client.listTools()

			// Derive per-server status from tool names
			for (const name of Object.keys(servers)) {
				const prefix = `${name}_`
				const serverToolNames = Object.keys(this.tools).filter((t) =>
					t.startsWith(prefix),
				)
				this.serverStatuses.set(name, {
					name,
					connected: true,
					toolCount: serverToolNames.length,
					toolNames: serverToolNames,
				})
			}
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error)

			// If MCPClient throws at top level, mark all servers as failed
			for (const name of Object.keys(servers)) {
				this.serverStatuses.set(name, {
					name,
					connected: false,
					toolCount: 0,
					toolNames: [],
					error: errMsg,
				})
			}
		}

		this.initialized = true
	}

	/**
	 * Disconnect all servers, reload config from disk, reconnect.
	 */
	async reload(): Promise<void> {
		await this.disconnect()
		this.config = loadMcpConfig(this.projectDir)
		this.tools = {}
		this.serverStatuses.clear()
		this.initialized = false
		await this.init()
	}

	/**
	 * Disconnect from all MCP servers and clean up.
	 */
	async disconnect(): Promise<void> {
		if (this.client) {
			try {
				await this.client.disconnect()
			} catch {
				// Ignore disconnect errors
			}
			this.client = null
		}
	}

	/**
	 * Get all tools from connected MCP servers.
	 * Returns a Record<string, ToolAction> compatible with Mastra's agent tools.
	 * Tool names are serverName_toolName (namespaced by MCPClient).
	 */
	getTools(): Record<string, any> {
		return { ...this.tools }
	}

	/**
	 * Check if any MCP servers are configured.
	 */
	hasServers(): boolean {
		return (
			this.config.mcpServers !== undefined &&
			Object.keys(this.config.mcpServers).length > 0
		)
	}

	/**
	 * Get status of all servers.
	 */
	getServerStatuses(): McpServerStatus[] {
		return Array.from(this.serverStatuses.values())
	}

	/**
	 * Get config file paths for display.
	 */
	getConfigPaths(): { project: string; global: string; claude: string } {
		return {
			project: getProjectMcpPath(this.projectDir),
			global: getGlobalMcpPath(),
			claude: getClaudeSettingsPath(this.projectDir),
		}
	}

	/**
	 * Get the merged config.
	 */
	getConfig(): McpConfig {
		return this.config
	}
}
