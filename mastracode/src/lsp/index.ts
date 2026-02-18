import { readFile } from "fs/promises"
import { LSPClient } from "./client"
import { getServersForFile } from "./server"
import { getLanguageId } from "./language"
import { lspManager } from "./manager"

// Re-export for external use
export { LSPClient, getServersForFile }
export { lspManager }

/**
 * LSP wrapper that delegates to the singleton lspManager
 * This provides a consistent API for tests while using the same
 * underlying LSP manager as the tools
 */
class LSPWrapper {
	private initialized: boolean = false
	private cwd: string = process.cwd()

	/**
	 * Initialize LSP system
	 */
	async initialize(cwd: string = process.cwd()): Promise<void> {
		this.cwd = cwd
		this.initialized = true
	}

	/**
	 * Get LSP clients for a file
	 */
	async getClients(
		filePath: string,
		cwd: string = this.cwd,
	): Promise<LSPClient[]> {
		const client = await lspManager.getClient(filePath, cwd)
		return client ? [client] : []
	}

	/**
	 * Touch a file (notify LSP servers of changes)
	 */
	async touchFile(
		filePath: string,
		waitForDiagnostics: boolean = false,
		cwd: string = this.cwd,
	): Promise<void> {
		const clients = await this.getClients(filePath, cwd)
		const languageId = getLanguageId(filePath)
		if (!languageId) return

		try {
			const content = await readFile(filePath, "utf-8")

			for (const client of clients) {
				client.notifyOpen(filePath, content, languageId)

				if (waitForDiagnostics) {
					await client.waitForDiagnostics(filePath)
				}
			}
		} catch (error) {
			// File might not exist or be readable
			// That's ok - we'll handle it in the tools
		}
	}

	/**
	 * Get aggregated diagnostics from all clients
	 */
	async diagnostics(filePath: string, cwd: string = this.cwd): Promise<any[]> {
		const clients = await this.getClients(filePath, cwd)
		const allDiagnostics: any[] = []

		for (const client of clients) {
			const diagnostics = client.getDiagnostics(filePath)
			allDiagnostics.push(
				...diagnostics.map((d) => ({
					severity: d.severity,
					message: d.message,
					range: d.range,
					source: d.source || "lsp",
				})),
			)
		}

		return allDiagnostics
	}

	/**
	 * Get hover information
	 */
	async hover(
		filePath: string,
		line: number,
		character: number,
		cwd: string = this.cwd,
	): Promise<any> {
		const clients = await this.getClients(filePath, cwd)

		for (const client of clients) {
			const result = await client.getHover(filePath, line, character)
			if (result) return result
		}

		return null
	}

	/**
	 * Shutdown all clients
	 */
	async shutdown(): Promise<void> {
		await lspManager.shutdownAll()
		this.initialized = false
	}
}

// Global LSP instance (wrapper around lspManager)
export const lsp = new LSPWrapper()

// Export convenience functions
export const init = (cwd?: string) => lsp.initialize(cwd)
export const getClients = (filePath: string, cwd?: string) =>
	lsp.getClients(filePath, cwd)
export const touchFile = (
	filePath: string,
	waitForDiagnostics?: boolean,
	cwd?: string,
) => lsp.touchFile(filePath, waitForDiagnostics, cwd)
export const diagnostics = (filePath: string, cwd?: string) =>
	lsp.diagnostics(filePath, cwd)
export const hover = (
	filePath: string,
	line: number,
	character: number,
	cwd?: string,
) => lsp.hover(filePath, line, character, cwd)
export const shutdown = () => lsp.shutdown()
