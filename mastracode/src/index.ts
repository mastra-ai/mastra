import { Mastra } from "@mastra/core"
import { Agent } from "@mastra/core/agent"
import { noopLogger } from "@mastra/core/logger"
import { LibSQLStore } from "@mastra/libsql"

import { getDynamicInstructions } from "./agents/instructions.js"
import { getDynamicMemory, omState } from "./agents/memory.js"
import { getDynamicModel } from "./agents/model.js"
import { createDynamicTools } from "./agents/tools.js"
import { getDynamicWorkspace } from "./agents/workspace.js"
import { AuthStorage } from "./auth/storage.js"
import { DEFAULT_OBS_THRESHOLD, DEFAULT_REF_THRESHOLD } from "./constants.js"
import { Harness } from "./harness/harness.js"
import { HookManager } from "./hooks/index.js"
import { MCPManager } from "./mcp/index.js"
import {
	setAuthStorage,
} from "./providers/claude-max.js"
import {
	setAuthStorage as setOpenAIAuthStorage,
} from "./providers/openai-codex.js"
import { stateSchema } from "./schema.js"
import { mastra } from "./tui/theme.js"
import { syncGateways } from "./utils/gateway-sync.js"
import {
	detectProject,
	getStorageConfig,
	getUserId,
	getResourceIdOverride,
} from "./utils/project.js"

export function createMastraCode() {
	// Auth storage (shared with Claude Max / OpenAI providers and Harness)
	const authStorage = new AuthStorage()
	setAuthStorage(authStorage)
	setOpenAIAuthStorage(authStorage)

	// Project detection
	const project = detectProject(process.cwd())
	const autoDetectedResourceId = project.resourceId

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
	console.info("--------------------------------")

	// Storage
	const storageConfig = getStorageConfig(project.rootPath)
	const storage = new LibSQLStore({
		id: "mastra-code-storage",
		url: storageConfig.url,
		...(storageConfig.authToken ? { authToken: storageConfig.authToken } : {}),
	})

	const memory = getDynamicMemory(storage)

	// MCP
	const mcpManager = new MCPManager(project.rootPath)

	// Agent
	const codeAgent = new Agent({
		id: "code-agent",
		name: "Code Agent",
		instructions: getDynamicInstructions,
		model: getDynamicModel,
		memory,
		workspace: getDynamicWorkspace,
		tools: createDynamicTools(mcpManager),
	})

	const mastraInstance = new Mastra({
		agents: { codeAgent },
		storage,
	})
	mastraInstance.getLogger = () => noopLogger as any
	codeAgent.__setLogger(noopLogger)

	// Hooks
	const hookManager = new HookManager(project.rootPath, "session-init")

	if (hookManager.hasHooks()) {
		const hookConfig = hookManager.getConfig()
		const hookCount = Object.values(hookConfig).reduce(
			(sum, hooks) => sum + (hooks?.length ?? 0),
			0,
		)
		console.info(`Hooks: ${hookCount} hook(s) configured`)
	}

	// Harness
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
		authStorage,
		heartbeatHandlers: [
			{
				id: "gateway-sync",
				intervalMs: 5 * 60 * 1000,
				handler: () => syncGateways(),
			},
		],
	})

	// Keep omModelState in sync with harness state changes
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
			omState.observerModelId = harness.getObserverModelId()
			omState.reflectorModelId = harness.getReflectorModelId()
			omState.obsThreshold =
				harness.getState().observationThreshold ?? DEFAULT_OBS_THRESHOLD
			omState.refThreshold =
				harness.getState().reflectionThreshold ?? DEFAULT_REF_THRESHOLD
			hookManager.setSessionId((event as any).threadId)
		} else if (event.type === "thread_created") {
			hookManager.setSessionId((event as any).thread.id)
		}
	})

	return { harness, mcpManager }
}
