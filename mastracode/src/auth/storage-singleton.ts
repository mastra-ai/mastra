import { AuthStorage } from "./storage"

// Singleton auth storage instance (shared with claude-max.ts)
let authStorageInstance: AuthStorage | null = null

/**
 * Get or create the shared AuthStorage instance
 */
export function getAuthStorage(): AuthStorage {
    if (!authStorageInstance) {
        authStorageInstance = new AuthStorage()
    }
    return authStorageInstance
}

/**
 * Set a custom AuthStorage instance (useful for TUI integration)
 */
export function setAuthStorage(storage: AuthStorage): void {
    authStorageInstance = storage
}