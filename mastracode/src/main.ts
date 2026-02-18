/**
 * Main entry point for Mastra Code TUI.
 * This is an example of how to wire up the Harness and TUI together.
 */
import * as fs from "node:fs"
import * as path from "node:path"

import { createAnthropic } from "@ai-sdk/anthropic"
import { Mastra } from "@mastra/core"
import { Agent } from "@mastra/core/agent"
import { ModelRouterLanguageModel } from "@mastra/core/llm"
import { noopLogger } from "@mastra/core/logger"
import type { RequestContext } from "@mastra/core/request-context"
import { LibSQLStore } from "@mastra/libsql"
import { Memory } from "@mastra/memory"

import { getDynamicWorkspace } from "./agents/workspace.js"
import { AuthStorage } from "./auth/storage.js"
import { DEFAULT_OM_MODEL_ID } from "./constants.js"
import { Harness } from "./harness/harness.js"
import type { HarnessRuntimeContext } from "./harness/types.js"
import { HookManager } from "./hooks/index.js"
import { MCPManager } from "./mcp/index.js"
import type { PromptContext } from "./prompts/index.js"
import { buildFullPrompt } from "./prompts/index.js"
import {
	opencodeClaudeMaxProvider,
	setAuthStorage,
} from "./providers/claude-max.js"
import {
	openaiCodexProvider,
	setAuthStorage as setOpenAIAuthStorage,
} from "./providers/openai-codex.js"
import { stateSchema } from "./schema.js"
import {
	createViewTool,
	createExecuteCommandTool,
	stringReplaceLspTool,
	astSmartEditTool,
	createWebSearchTool,
	createWebExtractTool,
	hasTavilyKey,
	createGrepTool,
	createGlobTool,
	createWriteFileTool,
	createSubagentTool,
	todoWriteTool,
	todoCheckTool,
	askUserTool,
	submitPlanTool,
	requestSandboxAccessTool,
} from "./tools/index.js"
import { MastraTUI } from "./tui/index.js"
import { mastra } from "./tui/theme.js"
import { startGatewaySync } from "./utils/gateway-sync.js"
import {
	detectProject,
	getStorageConfig,
	getUserId,
	getOmScope,
	getResourceIdOverride,
	getAppDataDir,
} from "./utils/project.js"
import { releaseAllThreadLocks } from "./utils/thread-lock.js"


// =============================================================================
// Start Gateway Sync (keeps model registry up to date)
// =============================================================================

startGatewaySync(5 * 60 * 1000) // Sync every 5 minutes

// =============================================================================
// Helpers
// =============================================================================

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
// =============================================================================
// Create Memory with Observational Memory support
// =============================================================================

// Default OM thresholds — per-thread overrides are loaded from thread metadata
const DEFAULT_OBS_THRESHOLD = 40_000
const DEFAULT_REF_THRESHOLD = 50_000

// Mutable OM state — updated by harness event listeners, read by OM config
// functions. We use this instead of requestContext because Mastra's OM system
// does NOT propagate requestContext to observer/reflector agent.generate() calls.
const omState = {
	observerModelId: DEFAULT_OM_MODEL_ID,
	reflectorModelId: DEFAULT_OM_MODEL_ID,
	obsThreshold: DEFAULT_OBS_THRESHOLD,
	refThreshold: DEFAULT_REF_THRESHOLD,
}

/**
 * Dynamic model function for Observer agent.
 * Reads from module-level omState (kept in sync by harness events).
 */
function getObserverModel() {
	return resolveModel(omState.observerModelId)
}

/**
 * Dynamic model function for Reflector agent.
 * Reads from module-level omState (kept in sync by harness events).
 */
function getReflectorModel() {
	return resolveModel(omState.reflectorModelId)
}
// Cache for Memory instances by threshold config
let cachedMemory: Memory | null = null
let cachedMemoryKey: string | null = null

// Resolved OM scope (read once at startup, can be changed via config)
const omScope = getOmScope(project.rootPath)

/**
 * Dynamic memory factory function.
 * Creates Memory with current threshold values from harness state.
 * Caches instance and reuses if config unchanged.
 */
function getDynamicMemory({
	requestContext,
}: {
	requestContext: RequestContext
}) {
	const ctx = requestContext.get("harness") as
		| HarnessRuntimeContext<typeof stateSchema>
		| undefined
	const state = ctx?.getState?.()

	const obsThreshold = state?.observationThreshold ?? omState.obsThreshold
	const refThreshold = state?.reflectionThreshold ?? omState.refThreshold

	const cacheKey = `${obsThreshold}:${refThreshold}:${omScope}`
	if (cachedMemory && cachedMemoryKey === cacheKey) {
		return cachedMemory
	}

	cachedMemory = new Memory({
		storage,
		options: {
			observationalMemory: {
				enabled: true,
				scope: omScope,
				observation: {
					bufferTokens: 1 / 10,
					bufferActivation: 4 / 5,
					model: getObserverModel,
					messageTokens: obsThreshold,
					blockAfter: 1,
					modelSettings: {
						maxOutputTokens: 60000,
					},
				},
				reflection: {
					bufferActivation: 1 / 2,
					blockAfter: 1.1,
					model: getReflectorModel,
					observationTokens: refThreshold,
					modelSettings: {
						maxOutputTokens: 60000,
					},
				},
			},
		},
	})
	cachedMemoryKey = cacheKey

	return cachedMemory
}

// =============================================================================
// Create Agent
// =============================================================================
// Create tools with project root
const viewTool = createViewTool(project.rootPath)
const executeCommandTool = createExecuteCommandTool(project.rootPath)
const grepTool = createGrepTool(project.rootPath)
const globTool = createGlobTool(project.rootPath)
const writeFileTool = createWriteFileTool(project.rootPath)
const webSearchTool = createWebSearchTool()
const webExtractTool = createWebExtractTool()
/**
 * Resolve a model ID to the correct provider instance.
 * Shared by the main agent, observer, and reflector.
 *
 * - For anthropic/* models: Uses Claude Max OAuth provider (opencode auth)
 * - For openai/* models with OAuth: Uses OpenAI Codex OAuth provider
 * - For moonshotai/* models: Uses Moonshot AI Anthropic-compatible endpoint
 * - For all other providers: Uses Mastra's model router (models.dev gateway)
 */
function resolveModel(modelId: string) {
	const isAnthropicModel = modelId.startsWith("anthropic/")
	const isOpenAIModel = modelId.startsWith("openai/")
	const isMoonshotModel = modelId.startsWith("moonshotai/")

	if (isMoonshotModel) {
		if (!process.env.MOONSHOT_AI_API_KEY) {
			throw new Error(`Need MOONSHOT_AI_API_KEY`)
		}
		return createAnthropic({
			apiKey: process.env.MOONSHOT_AI_API_KEY!,
			baseURL: "https://api.moonshot.ai/anthropic/v1",
			name: "moonshotai.anthropicv1",
		})(modelId.substring("moonshotai/".length))
	} else if (isAnthropicModel) {
		return opencodeClaudeMaxProvider(modelId.substring(`anthropic/`.length))
	} else if (isOpenAIModel && authStorage.isLoggedIn("openai-codex")) {
		return openaiCodexProvider(modelId.substring(`openai/`.length))
	} else {
		return new ModelRouterLanguageModel(modelId)
	}
}

/**
 * Dynamic model function that reads the current model from harness state.
 * This allows runtime model switching via the /models picker.
 */
function getDynamicModel({
	requestContext,
}: {
	requestContext: RequestContext
}) {
	const harnessContext = requestContext.get("harness") as
		| HarnessRuntimeContext<typeof stateSchema>
		| undefined

	const modelId = harnessContext?.state?.currentModelId
	if (!modelId) {
		throw new Error("No model selected. Use /models to select a model first.")
	}

	return resolveModel(modelId)
}

// =============================================================================
// Create Subagent Tool (subagent delegation)
// =============================================================================

// The subagent tool needs tools and resolveModel to spawn subagents.
// We pass all tools that subagents might need based on their type.
const subagentTool = createSubagentTool({
	tools: {
		// Read-only tools (for explore, plan)
		view: viewTool,
		search_content: grepTool,
		find_files: globTool,
		// Write tools (for execute)
		string_replace_lsp: stringReplaceLspTool,
		write_file: writeFileTool,
		execute_command: executeCommandTool,
		// Task tracking (for execute)
		todo_write: todoWriteTool,
		todo_check: todoCheckTool,
	},
	resolveModel,
})

// Read-only subagent tool for plan mode — no execute type allowed
const subagentToolReadOnly = createSubagentTool({
	tools: {
		view: viewTool,
		search_content: grepTool,
		find_files: globTool,
	},
	resolveModel,
	allowedAgentTypes: ["explore", "plan"],
})

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
			date: new Date().toISOString().split("T")[0],
			mode: modeId,
			activePlan: state?.activePlan ?? null,
			// Add missing fields for PromptContext
			modeId: modeId,
			currentDate: new Date().toISOString().split("T")[0],
			workingDir: state?.projectPath ?? project.rootPath,
			state: state,
		}

		return buildFullPrompt(promptCtx)
	},
	model: getDynamicModel,
	memory: getDynamicMemory,
	workspace: getDynamicWorkspace,
	tools: ({ requestContext }) => {
		const harnessContext = requestContext.get("harness") as
			| HarnessRuntimeContext<typeof stateSchema>
			| undefined
		const modeId = harnessContext?.modeId ?? "build"

		// Build tool set based on mode
		// NOTE: Tool names "grep" and "glob" are reserved by Anthropic's OAuth
		// validation (they match Claude Code's internal tools). We use
		// "search_content" and "find_files" to avoid the collision.
		const tools: Record<string, any> = {
			// Read-only tools — always available
			view: viewTool,
			search_content: grepTool,
			find_files: globTool,
			execute_command: executeCommandTool,
			// Subagent delegation — read-only in plan mode
			subagent: modeId === "plan" ? subagentToolReadOnly : subagentTool,
			// Todo tracking — always available (planning tool, not a write tool)
			todo_write: todoWriteTool,
			todo_check: todoCheckTool,
			// User interaction — always available
			ask_user: askUserTool,
			request_sandbox_access: requestSandboxAccessTool,
		}

		// Write tools — NOT available in plan mode
		if (modeId !== "plan") {
			tools.string_replace_lsp = stringReplaceLspTool
			tools.ast_smart_edit = astSmartEditTool
			tools.write_file = writeFileTool
		}

		// Plan submission — only available in plan mode
		if (modeId === "plan") {
			tools.submit_plan = submitPlanTool
		}
		// Web tools — prefer Tavily when available (avoids Anthropic native
		// web_search provider tool which can cause stream freezes). Fall back
		// to Anthropic's native web search via getToolsets() for Anthropic models.
		// Note: hasTavilyKey() is checked at request time, not module load time,
		// so the key can be set after startup and still be picked up.
		if (hasTavilyKey()) {
			tools.web_search = webSearchTool
			tools.web_extract = webExtractTool
		}

		// MCP server tools — injected from connected servers
		const mcpTools = mcpManager.getTools()
		Object.assign(tools, mcpTools)

		return tools
	},
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
// Anthropic Provider Tools (web search & fetch - zero implementation needed)
// Only used as fallback when Tavily API key is not configured.
// =============================================================================
const anthropic = createAnthropic({})

function getToolsets(
	modelId: string,
): Record<string, Record<string, unknown>> | undefined {
	// If Tavily is available, skip Anthropic's native web search
	if (hasTavilyKey()) return undefined

	const isAnthropicModel = modelId.startsWith("anthropic/")
	if (!isAnthropicModel) return undefined

	return {
		anthropic: {
			web_search: anthropic.tools.webSearch_20250305(),
		},
	}
}

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
// Create MCP Manager
// =============================================================================
const mcpManager = new MCPManager(project.rootPath)

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
	getToolsets,
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
// Clean up MCP connections on exit
process.on("beforeExit", async () => {
	await mcpManager.disconnect()
})

// Release thread locks on exit (handles SIGINT, SIGTERM, and normal exit)
const cleanupThreadLocks = () => {
	harness.releaseCurrentThreadLock()
	releaseAllThreadLocks()
}
process.on("exit", cleanupThreadLocks)
process.on("SIGINT", () => {
	cleanupThreadLocks()
	process.exit(0)
})
process.on("SIGTERM", () => {
	cleanupThreadLocks()
	process.exit(0)
})
