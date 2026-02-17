import { getStorageConfig } from "../utils/project"
import type { ProjectInfo } from "../utils/project"
import { LibSQLStore } from "@mastra/libsql"

// =============================================================================
// Create Storage (shared across all projects)
// =============================================================================

export function createStorage(project: ProjectInfo): LibSQLStore {
    const storageConfig = getStorageConfig(project.rootPath)
    return new LibSQLStore({
        id: "mastra-code-storage",
        url: storageConfig.url,
        ...(storageConfig.authToken ? { authToken: storageConfig.authToken } : {}),
    })
}

