/**
 * MastraCode CLI entrypoint.
 */
import { Harness } from "@mastra/core/harness"
import { createStorage } from "./storage"
import { MastraTUI, mastra } from "./tui"
import { detectProject } from "./utils"
import { stateSchema } from "./state/schema"
import type { MastraCodeCustomEvent } from "./harness"
import { createCodingAgent } from "./agents/coding"
import { getAuthStorage } from "./auth/storage-singleton"

const DEFAULT_MODEL_ID = "anthropic/claude-sonnet-4-20250514"

async function main() {
    const project = detectProject(process.cwd())
    const storage = createStorage(project)
    const agent = createCodingAgent(storage)

    // Resolve initial model: last used > hardcoded default
    const authStorage = getAuthStorage()
    const initialModelId = authStorage.getLastModelId() || DEFAULT_MODEL_ID

    const harness = new Harness<typeof stateSchema, MastraCodeCustomEvent>({
        id: "mastra-code",
        resourceId: project.resourceId,
        storage,
        stateSchema: stateSchema,
        initialState: {
            projectPath: project.rootPath,
            projectName: project.name,
            gitBranch: project.gitBranch,
            currentModelId: initialModelId,
        },
        modes: [
            {
                id: "build",
                name: "Build",
                default: true,
                color: mastra.purple,
                agent,
            },
            {
                id: "plan",
                name: "Plan",
                color: mastra.blue,
                agent,
                toolPolicy: {
                    readOnly: true,
                    allowedTools: [
                        "mastra_workspace_read_file",
                        "mastra_workspace_list_files",
                        "grep",
                        "todo_write",
                        "ask_user",
                        "submit_plan",
                        "subagent",
                    ],
                },
            },
            {
                id: "fast",
                name: "Fast",
                color: mastra.green,
                agent,
            },
        ],
    })

    const tui = new MastraTUI({
        harness,
        appName: "Mastra Code",
        version: "0.1.0",
        inlineQuestions: true,
    })

    await tui.run()
}

void main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
})
