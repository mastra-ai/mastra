/**
 * Gateway sync utility for keeping the model registry up to date.
 * Periodically fetches provider data from gateways and updates the global cache.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { ModelsDevGateway, NetlifyGateway } from "@mastra/core/llm"
import type { ProviderConfig } from "@mastra/core/llm"

// Cache paths (same as Mastra uses)
const CACHE_DIR = path.join(os.homedir(), ".cache", "mastra")
const CACHE_FILE = path.join(CACHE_DIR, "gateway-refresh-time")
const GLOBAL_PROVIDER_REGISTRY_JSON = path.join(
	CACHE_DIR,
	"provider-registry.json",
)
const GLOBAL_PROVIDER_TYPES_DTS = path.join(
	CACHE_DIR,
	"provider-types.generated.d.ts",
)

// Default sync interval: 5 minutes
const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000

let syncInterval: NodeJS.Timeout | null = null
let isSyncing = false

/**
 * Atomic file write to prevent corruption from concurrent writes
 */
async function atomicWriteFile(
	filePath: string,
	content: string,
): Promise<void> {
	const randomSuffix = Math.random().toString(36).substring(2, 15)
	const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`

	try {
		await fs.promises.writeFile(tempPath, content, "utf-8")
		await fs.promises.rename(tempPath, filePath)
	} catch (error) {
		try {
			await fs.promises.unlink(tempPath)
		} catch {
			// Ignore cleanup errors
		}
		throw error
	}
}

/**
 * Fetch providers from all gateways
 */
async function fetchProvidersFromGateways(): Promise<{
	providers: Record<string, ProviderConfig>
	models: Record<string, string[]>
}> {
	const allProviders: Record<string, ProviderConfig> = {}
	const allModels: Record<string, string[]> = {}

	const gateways = [new ModelsDevGateway({}), new NetlifyGateway()]

	for (const gateway of gateways) {
		try {
			const providers = await gateway.fetchProviders()

			// models.dev is a provider registry, not a true gateway - don't prefix its providers
			const isProviderRegistry = gateway.id === "models.dev"

			for (const [providerId, config] of Object.entries(providers)) {
				const typeProviderId = isProviderRegistry
					? providerId
					: providerId === gateway.id
						? gateway.id
						: `${gateway.id}/${providerId}`

				allProviders[typeProviderId] = config
				allModels[typeProviderId] = config.models.sort()
			}
		} catch (error) {
			console.warn(`[GatewaySync] Failed to fetch from ${gateway.id}:`, error)
		}
	}

	return { providers: allProviders, models: allModels }
}

/**
 * Generate TypeScript type definitions content
 */
function generateTypesContent(models: Record<string, string[]>): string {
	const providerModelsEntries = Object.entries(models)
		.map(([provider, modelList]) => {
			const modelsList = modelList.map((m) => `'${m}'`)
			const needsQuotes = /[^a-zA-Z0-9_$]/.test(provider)
			const providerKey = needsQuotes ? `'${provider}'` : provider
			const singleLine = `  readonly ${providerKey}: readonly [${modelsList.join(", ")}];`

			if (singleLine.length > 120) {
				const formattedModels = modelList.map((m) => `    '${m}',`).join("\n")
				return `  readonly ${providerKey}: readonly [\n${formattedModels}\n  ];`
			}

			return singleLine
		})
		.join("\n")

	return `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 * Generated from model gateway providers
 */

export type ProviderModelsMap = {
${providerModelsEntries}
};

export type Provider = keyof ProviderModelsMap;

export interface ProviderModels {
  [key: string]: string[];
}

export type ModelRouterModelId =
  | {
      [P in Provider]: \`\${P}/\${ProviderModelsMap[P][number]}\`;
    }[Provider]
  | (string & {});

export type ModelForProvider<P extends Provider> = ProviderModelsMap[P][number];
`
}

/**
 * Get the last sync time from disk
 */
function getLastSyncTime(): Date | null {
	try {
		if (!fs.existsSync(CACHE_FILE)) {
			return null
		}
		const timestamp = fs.readFileSync(CACHE_FILE, "utf-8").trim()
		return new Date(parseInt(timestamp, 10))
	} catch {
		return null
	}
}

/**
 * Save the last sync time to disk
 */
function saveLastSyncTime(date: Date): void {
	try {
		if (!fs.existsSync(CACHE_DIR)) {
			fs.mkdirSync(CACHE_DIR, { recursive: true })
		}
		fs.writeFileSync(CACHE_FILE, date.getTime().toString(), "utf-8")
	} catch (error) {
		console.warn("[GatewaySync] Failed to save sync time:", error)
	}
}

/**
 * Sync gateways and update the global cache
 */
export async function syncGateways(force = false): Promise<void> {
	if (isSyncing && !force) {
		return
	}

	// Check if we synced recently (within the last 5 minutes)
	if (!force) {
		const lastSync = getLastSyncTime()
		if (lastSync) {
			const timeSinceSync = Date.now() - lastSync.getTime()
			if (timeSinceSync < DEFAULT_SYNC_INTERVAL_MS) {
				// console.debug(`[GatewaySync] Skipping sync, last sync was ${Math.round(timeSinceSync / 1000)}s ago`)
				return
			}
		}
	}

	isSyncing = true

	try {
		// console.debug("[GatewaySync] Starting gateway sync...")

		const { providers, models } = await fetchProvidersFromGateways()

		// Ensure cache directory exists
		await fs.promises.mkdir(CACHE_DIR, { recursive: true })

		// Write registry JSON
		const registryData = {
			providers,
			models,
			version: "1.0.0",
		}
		await atomicWriteFile(
			GLOBAL_PROVIDER_REGISTRY_JSON,
			JSON.stringify(registryData, null, 2),
		)

		// Write types file
		const typesContent = generateTypesContent(models)
		await atomicWriteFile(GLOBAL_PROVIDER_TYPES_DTS, typesContent)

		// Save sync time
		const now = new Date()
		saveLastSyncTime(now)

		// console.debug(`[GatewaySync] ✅ Sync completed at ${now.toISOString()}`)
	} catch (error) {
		console.error("[GatewaySync] ❌ Sync failed:", error)
	} finally {
		isSyncing = false
	}
}

/**
 * Start periodic gateway sync
 * @param intervalMs Sync interval in milliseconds (default: 5 minutes)
 */
export function startGatewaySync(intervalMs = DEFAULT_SYNC_INTERVAL_MS): void {
	if (syncInterval) {
		return
	}

	// Do an initial sync
	syncGateways().catch(console.error)

	// Set up periodic sync
	syncInterval = setInterval(() => {
		syncGateways().catch(console.error)
	}, intervalMs)

	// Don't prevent process exit
	syncInterval.unref()
}

/**
 * Stop periodic gateway sync
 */
export function stopGatewaySync(): void {
	if (syncInterval) {
		clearInterval(syncInterval)
		syncInterval = null
	}
}
