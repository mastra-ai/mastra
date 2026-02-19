/**
 * Hook configuration loading from filesystem.
 * Loads from global (~/.mastracode/hooks.json) and project (.mastracode/hooks.json).
 * Global hooks run first, project hooks append.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import type { HooksConfig, HookDefinition, HookEventName } from "./types.js"

const VALID_EVENTS: HookEventName[] = [
	"PreToolUse",
	"PostToolUse",
	"Stop",
	"UserPromptSubmit",
	"SessionStart",
	"SessionEnd",
]

export function loadHooksConfig(projectDir: string): HooksConfig {
	const globalPath = getGlobalHooksPath()
	const projectPath = getProjectHooksPath(projectDir)

	const globalConfig = loadSingleConfig(globalPath)
	const projectConfig = loadSingleConfig(projectPath)

	return mergeConfigs(globalConfig, projectConfig)
}

export function getProjectHooksPath(projectDir: string): string {
	return path.join(projectDir, ".mastracode", "hooks.json")
}

export function getGlobalHooksPath(): string {
	return path.join(os.homedir(), ".mastracode", "hooks.json")
}

function loadSingleConfig(filePath: string): HooksConfig {
	try {
		if (!fs.existsSync(filePath)) return {}
		const raw = fs.readFileSync(filePath, "utf-8")
		return validateConfig(JSON.parse(raw))
	} catch {
		return {}
	}
}

function validateConfig(raw: unknown): HooksConfig {
	if (!raw || typeof raw !== "object") return {}

	const config: HooksConfig = {}
	const obj = raw as Record<string, unknown>

	for (const event of VALID_EVENTS) {
		if (Array.isArray(obj[event])) {
			const hooks = (obj[event] as unknown[]).filter(isValidHook)
			if (hooks.length > 0) {
				config[event] = hooks
			}
		}
	}

	return config
}

function isValidHook(raw: unknown): raw is HookDefinition {
	if (!raw || typeof raw !== "object") return false
	const obj = raw as Record<string, unknown>
	return obj.type === "command" && typeof obj.command === "string"
}

function mergeConfigs(global: HooksConfig, project: HooksConfig): HooksConfig {
	const merged: HooksConfig = {}

	for (const event of VALID_EVENTS) {
		const combined = [...(global[event] ?? []), ...(project[event] ?? [])]
		if (combined.length > 0) {
			merged[event] = combined
		}
	}

	return merged
}
