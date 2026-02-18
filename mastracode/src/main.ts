/**
 * Main entry point for Mastra Code TUI.
 * This is an example of how to wire up the Harness and TUI together.
 */
import * as fs from "node:fs"
import * as path from "node:path"

import { Mastra } from "@mastra/core"
import { Agent } from "@mastra/core/agent"
import { noopLogger } from "@mastra/core/logger"
import { LibSQLStore } from "@mastra/libsql"
import { getDynamicMemory, omState } from "./agents/memory.js"
import { getDynamicModel } from "./agents/model.js"
import { createDynamicTools } from "./agents/tools.js"
import { getDynamicWorkspace } from "./agents/workspace.js"
import { AuthStorage } from "./auth/storage.js"
import { DEFAULT_OBS_THRESHOLD, DEFAULT_REF_THRESHOLD } from "./constants.js"
import { Harness } from "./harness/harness.js"
import type { HarnessRuntimeContext } from "./harness/types.js"
import { HookManager } from "./hooks/index.js"
import { MCPManager } from "./mcp/index.js"
import type { PromptContext } from "./prompts/index.js"
import { buildFullPrompt } from "./prompts/index.js"
import {
	setAuthStorage,
} from "./providers/claude-max.js"
import {
	setAuthStorage as setOpenAIAuthStorage,
} from "./providers/openai-codex.js"
import { stateSchema } from "./schema.js"
import { MastraTUI } from "./tui/index.js"
import { mastra } from "./tui/theme.js"
import { syncGateways } from "./utils/gateway-sync.js"
import {
	detectProject,
	getStorageConfig,
	getUserId,
	getResourceIdOverride,
	getAppDataDir,
} from "./utils/project.js"
import { releaseAllThreadLocks } from "./utils/thread-lock.js"


// =============================================================================
// Create Auth Storage (shared with Claude Max provider and Harness)
// =============================================================================

const authStorage = new AuthStorage()
setAuthStorage(authStorage)
setOpenAIAuthStorage(authStorage)

// =============================================================================
// Project Detection
// =============================================================================

const project = detectProject(process.cwd())
const autoDetectedResourceId = project.resourceId

// Apply resource ID override if configured (env var or .mastracode/database.json)
const resourceIdOverride = getResourceIdOverride(project.rootPath)
if (resourceIdOverride) {
	project.resourceId = resourceIdOverride
	project.resourceIdOverride = true
}

console.info(`Project: ${project.name}`)
console.info(
	`Resource ID: ${project.resourceId}${project.resourceIdOverride ? " (override)" : ""}`,
)
if (project.gitBranch) console.info(`Branch: ${project.gitBranch}`)
if (project.isWorktree) console.info(`Worktree of: ${project.mainRepoPath}`)

const userId = getUserId(project.rootPath)
console.info(`User: ${userId}`)
console.info('--------------------------------')

// =============================================================================
// Configuration
// =============================================================================

// State schema for the harness

// =============================================================================
// Create Storage (shared across all projects)
// =============================================================================

const storageConfig = getStorageConfig(project.rootPath)
const storage = new LibSQLStore({
	id: "mastra-code-storage",
	url: storageConfig.url,
	...(storageConfig.authToken ? { authToken: storageConfig.authToken } : {}),
})

const memory = getDynamicMemory(storage)

// =============================================================================
// Create MCP Manager
// =============================================================================
const mcpManager = new MCPManager(project.rootPath)

// Create agent with dynamic model, dynamic prompt, and full toolset
const codeAgent = new Agent({
	id: "code-agent",
	name: "Code Agent",
	instructions: ({ requestContext }) => {
		const harnessContext = requestContext.get("harness") as
			| HarnessRuntimeContext<typeof stateSchema>
			| undefined
		const state = harnessContext?.state
		const modeId = harnessContext?.modeId ?? "build"

		const promptCtx: PromptContext = {
			projectPath: state?.projectPath ?? project.rootPath,
			projectName: state?.projectName ?? project.name,
			gitBranch: state?.gitBranch ?? project.gitBranch,
			platform: process.platform,
			date: new Date().toISOString().split("T")[0]!,
			mode: modeId,
			activePlan: state?.activePlan ?? null,
			// Add missing fields for PromptContext
			modeId: modeId,
			currentDate: new Date().toISOString().split("T")[0]!,
			workingDir: state?.projectPath ?? project.rootPath,
			state: state,
		}

		return buildFullPrompt(promptCtx)
	},
	model: getDynamicModel,
	memory,
	workspace: getDynamicWorkspace,
	tools: createDynamicTools(mcpManager),
})

// Register the agent with a Mastra instance so that workflow snapshot storage
// is available. This is required for requireToolApproval (approveToolCall /
// declineToolCall use resumeStream which loads snapshots from storage).
const mastraInstance = new Mastra({
	agents: { codeAgent },
	storage,
})
// Suppress internal logging after Mastra init (Mastra sets its own logger)
mastraInstance.getLogger = () => noopLogger as any

// Suppress @mastra/core's internal ConsoleLogger which dumps raw error objects
// to the terminal. Our harness already catches and formats these errors properly.
codeAgent.__setLogger(noopLogger)

// =============================================================================
// Create Hook Manager
// =============================================================================
const hookManager = new HookManager(project.rootPath, "session-init")

if (hookManager.hasHooks()) {
	const hookConfig = hookManager.getConfig()
	const hookCount = Object.values(hookConfig).reduce(
		(sum, hooks) => sum + (hooks?.length ?? 0),
		0,
	)
	console.info(`Hooks: ${hookCount} hook(s) configured`)
}

// =============================================================================
// Create Harness
// =============================================================================
const harness = new Harness({
	id: "mastra-code",
	resourceId: project.resourceId,
	defaultResourceId: autoDetectedResourceId,
	userId,
	isRemoteStorage: storageConfig.isRemote,
	storage,
	stateSchema,
	initialState: {
		projectPath: project.rootPath,
		projectName: project.name,
		gitBranch: project.gitBranch,
	},
	workspace: getDynamicWorkspace,
	hookManager,
	mcpManager,
	modes: [
		{
			id: "build",
			name: "Build",
			default: true,
			defaultModelId: "anthropic/claude-opus-4-6",
			color: mastra.purple,
			agent: codeAgent,
		},
		{
			id: "plan",
			name: "Plan",
			defaultModelId: "openai/gpt-5.2-codex",
			color: mastra.blue,
			agent: codeAgent,
		},
		{
			id: "fast",
			name: "Fast",
			defaultModelId: "cerebras/zai-glm-4.7",
			color: mastra.green,
			agent: codeAgent,
		},
	],
	authStorage, // Share auth storage with Claude Max provider
	heartbeatHandlers: [
		{
			id: "gateway-sync",
			intervalMs: 5 * 60 * 1000,
			handler: () => syncGateways(),
		},
	],
})

// Keep omModelState in sync with harness state changes.
// We listen for both explicit model changes and thread switches (which restore
// persisted OM model preferences from thread metadata).
harness.subscribe((event) => {
	if (event.type === "om_model_changed") {
		const { role, modelId } = event as {
			type: string
			role: string
			modelId: string
		}
		if (role === "observer") omState.observerModelId = modelId
		if (role === "reflector") omState.reflectorModelId = modelId
	} else if (event.type === "thread_changed") {
		// Thread switch restores OM model IDs and thresholds from metadata — re-read from harness state
		omState.observerModelId = harness.getObserverModelId()
		omState.reflectorModelId = harness.getReflectorModelId()
		omState.obsThreshold =
			harness.getState().observationThreshold ?? DEFAULT_OBS_THRESHOLD
		omState.refThreshold =
			harness.getState().reflectionThreshold ?? DEFAULT_REF_THRESHOLD
		// Keep hook manager session ID in sync
		hookManager.setSessionId((event as any).threadId)
	} else if (event.type === "thread_created") {
		hookManager.setSessionId((event as any).thread.id)
	}
})

// =============================================================================
// Create and Run TUI
// =============================================================================
const tui = new MastraTUI({
	harness,
	appName: "Mastra Code",
	version: "0.1.0",
	inlineQuestions: true,
})

	// Initialize MCP connections, then run the TUI
	; (async () => {
		if (mcpManager.hasServers()) {
			await mcpManager.init()
			const statuses = mcpManager.getServerStatuses()
			const connected = statuses.filter((s) => s.connected)
			const failed = statuses.filter((s) => !s.connected)
			const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0)
			console.log(
				`MCP: ${connected.length} server(s) connected, ${totalTools} tool(s)`,
			)
			for (const s of failed) {
				console.log(`MCP: Failed to connect to "${s.name}": ${s.error}`)
			}
		}
		// Redirect console.error/warn to a log file once the TUI owns the terminal.
		// @mastra/core internally uses console.error/warn to dump raw error objects
		// (e.g., "Error in LLM execution", "Error in agent stream") which corrupt the
		// TUI display. Our harness already catches and formats these errors properly.
		const logFile = path.join(getAppDataDir(), "debug.log")
		const logStream = fs.createWriteStream(logFile, { flags: "a" })
		const fmt = (a: unknown): string => {
			if (typeof a === "string") return a
			if (a instanceof Error) return `${a.name}: ${a.message}`
			try {
				return JSON.stringify(a)
			} catch {
				return String(a)
			}
		}
		const originalConsoleError = console.error.bind(console)
		console.error = (...args: unknown[]) => {
			logStream.write(
				`[ERROR] ${new Date().toISOString()} ${args.map(fmt).join(" ")}\n`,
			)
		}
		console.warn = (...args: unknown[]) => {
			logStream.write(
				`[WARN] ${new Date().toISOString()} ${args.map(fmt).join(" ")}\n`,
			)
		}

		tui.run().catch((error) => {
			originalConsoleError("Fatal error:", error)
			process.exit(1)
		})
	})()
// Graceful async cleanup (MCP connections, heartbeat shutdown hooks)
process.on("beforeExit", async () => {
	await Promise.all([
		mcpManager.disconnect(),
		harness.stopHeartbeats(),
	])
})

// Synchronous cleanup on exit / signals (thread locks)
const cleanup = () => {
	harness.releaseCurrentThreadLock()
	releaseAllThreadLocks()
}
process.on("exit", cleanup)
process.on("SIGINT", () => {
	cleanup()
	process.exit(0)
})
process.on("SIGTERM", () => {
	cleanup()
	process.exit(0)
})
