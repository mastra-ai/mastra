/**
 * MCP server configuration loading from filesystem.
 * Loads from:
 *   1. .claude/settings.local.json  (Claude Code compat — lowest priority)
 *   2. ~/.mastracode/mcp.json       (global)
 *   3. .mastracode/mcp.json         (project — highest priority)
 *
 * Project overrides global by server name. Claude Code config is lowest priority.
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { McpConfig, McpServerConfig } from "./types.js"

export function loadMcpConfig(projectDir: string): McpConfig {
	const claudeConfig = loadClaudeSettings(projectDir)
	const globalConfig = loadSingleConfig(getGlobalMcpPath())
	const projectConfig = loadSingleConfig(getProjectMcpPath(projectDir))

	return mergeConfigs(claudeConfig, globalConfig, projectConfig)
}

export function getProjectMcpPath(projectDir: string): string {
	return path.join(projectDir, ".mastracode", "mcp.json")
}

export function getGlobalMcpPath(): string {
	return path.join(os.homedir(), ".mastracode", "mcp.json")
}

export function getClaudeSettingsPath(projectDir: string): string {
	return path.join(projectDir, ".claude", "settings.local.json")
}

function loadSingleConfig(filePath: string): McpConfig {
	try {
		if (!fs.existsSync(filePath)) return {}
		const raw = fs.readFileSync(filePath, "utf-8")
		return validateConfig(JSON.parse(raw))
	} catch {
		return {}
	}
}

function loadClaudeSettings(projectDir: string): McpConfig {
	try {
		const filePath = getClaudeSettingsPath(projectDir)
		if (!fs.existsSync(filePath)) return {}
		const raw = fs.readFileSync(filePath, "utf-8")
		const parsed = JSON.parse(raw)
		// Claude Code stores mcpServers at the top level of settings
		if (parsed?.mcpServers && typeof parsed.mcpServers === "object") {
			return validateConfig({ mcpServers: parsed.mcpServers })
		}
		return {}
	} catch {
		return {}
	}
}

function validateConfig(raw: unknown): McpConfig {
	if (!raw || typeof raw !== "object") return {}
	const obj = raw as Record<string, unknown>

	if (!obj.mcpServers || typeof obj.mcpServers !== "object") return {}

	const servers: Record<string, McpServerConfig> = {}
	const rawServers = obj.mcpServers as Record<string, unknown>

	for (const [name, entry] of Object.entries(rawServers)) {
		if (isValidServerConfig(entry)) {
			servers[name] = {
				command: (entry as Record<string, unknown>).command as string,
				args: Array.isArray((entry as Record<string, unknown>).args)
					? ((entry as Record<string, unknown>).args as string[])
					: undefined,
				env:
					typeof (entry as Record<string, unknown>).env === "object" &&
					(entry as Record<string, unknown>).env !== null
						? ((entry as Record<string, unknown>).env as Record<string, string>)
						: undefined,
			}
		}
	}

	if (Object.keys(servers).length === 0) return {}
	return { mcpServers: servers }
}

function isValidServerConfig(raw: unknown): boolean {
	if (!raw || typeof raw !== "object") return false
	const obj = raw as Record<string, unknown>
	return typeof obj.command === "string"
}

/**
 * Merge configs: claude (lowest priority) < global < project (highest).
 * Later configs override earlier by server name.
 */
function mergeConfigs(...configs: McpConfig[]): McpConfig {
	const merged: Record<string, McpServerConfig> = {}

	for (const config of configs) {
		if (config.mcpServers) {
			for (const [name, server] of Object.entries(config.mcpServers)) {
				merged[name] = server
			}
		}
	}

	if (Object.keys(merged).length === 0) return {}
	return { mcpServers: merged }
}
