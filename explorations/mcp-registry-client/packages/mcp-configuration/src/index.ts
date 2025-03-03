import { RegistryClient } from "@mcp/registry/dist/registry.js"
import { readFile, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { ServerDefinition } from "@mcp/registry"
import { MastraMCPClient } from "@mastra/mcp"
import { z } from "zod"

// Basic configuration schema that applies regardless of server
const baseConfigSchema = z.object({
	command: z.string().min(1, "Command is required"),
	env: z.record(z.string()).optional(),
	args: z.array(z.string()).optional(),
	runtimeArgs: z.array(z.string()).optional()
})

export interface ServerConfiguration {
	serverId: string
	config: {
		command: string
		env?: Record<string, string>
		args?: string[]
		runtimeArgs?: string[]
	}
	createdAt: string
	updatedAt: string
}

export type ConfiguredServer = ServerConfiguration & {
	server: ServerDefinition
}

interface ConfigStore {
	configurations: Record<string, ServerConfiguration>
}

export class McpConfiguration {
	public registry: RegistryClient
	private id: string
	private headers?: Record<string, string>
	private configPath: string
	private store: ConfigStore

	constructor(args: {
		id: string
		registry: RegistryClient
		headers?: Record<string, string>
	}) {
		this.id = args.id
		this.registry = args.registry
		this.headers = args.headers
		this.configPath = join(process.cwd(), ".mcp-config.json")
		this.store = { configurations: {} }
	}

	private parseConfig(
		config: unknown,
		server: ServerDefinition
	): Record<string, unknown> {
		if (!config || typeof config !== "object") {
			throw new Error("Configuration must be an object")
		}

		// Always validate against base schema first
		baseConfigSchema.parse(config)

		// Do server-specific validation and parsing
		return server.parseConfig(config as ConfiguredServer["config"])
	}

	private async loadStore() {
		try {
			if (existsSync(this.configPath)) {
				const content = await readFile(this.configPath, "utf-8")
				this.store = JSON.parse(content)
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error)
			throw new Error(`Failed to load configuration store: ${message}`)
		}
	}

	private async saveStore() {
		try {
			await writeFile(this.configPath, JSON.stringify(this.store, null, 2))
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error)
			throw new Error(`Failed to save configuration store: ${message}`)
		}
	}

	public async add({ server, config }: { server: ServerDefinition; config: ConfiguredServer["config"] }) {
		await this.loadStore()

		// Check for duplicate configuration
		const existingConfig = await this.get(server.id)
		if (existingConfig) {
			throw new Error(`Configuration for server "${server.id}" already exists`)
		}

		// Parse and validate the initial configuration
		this.parseConfig(config, server)

		// Add default arguments from server configuration
		const runtimeConfig = server.schemas?.find((c) => c.command === config.command)
		const configWithDefaults = {
			...config,
			args: runtimeConfig?.args ? [...runtimeConfig.args] : undefined,
		}

		// Parse and validate the configuration again with default arguments
		this.parseConfig(configWithDefaults, server)

		const now = new Date().toISOString()
		this.store.configurations[server.id] = {
			serverId: server.id,
			config: configWithDefaults,
			createdAt: now,
			updatedAt: now,
		}

		await this.saveStore()
		return this.store.configurations[server.id]
	}

	public async edit(input: {
		server: { id: string }
		config: ConfiguredServer["config"]
	}) {
		await this.loadStore()
		
		// Get the full server definition for validation
		const serverDef = await this.registry.getServerDefinition({ id: input.server.id })
		this.parseConfig(input.config, serverDef)

		const existing = this.store.configurations[input.server.id]
		if (!existing) {
			throw new Error(`Configuration for server ${input.server.id} not found`)
		}

		this.store.configurations[input.server.id] = {
			...existing,
			config: {
				...input.config,
				args: serverDef.schemas?.find((c) => c.command === input.config.command)
					?.args ? [...serverDef.schemas.find((c) => c.command === input.config.command)!.args!] : undefined,
			},
			updatedAt: new Date().toISOString(),
		}

		await this.saveStore()
		return this.store.configurations[input.server.id]
	}

	public async remove(serverId: string) {
		await this.loadStore()

		if (!this.store.configurations[serverId]) {
			throw new Error(`Configuration for server ${serverId} not found`)
		}

		const removed = this.store.configurations[serverId]
		delete this.store.configurations[serverId]
		await this.saveStore()
		return removed
	}

	public async get(serverId: string) {
		await this.loadStore()
		const config = this.store.configurations[serverId]
		if (!config) {
			return null
		}
		return config
	}

	public async list(): Promise<Array<ConfiguredServer>> {
		await this.loadStore()
		return Promise.all(
			Object.values(this.store.configurations).map(async (c) => {
				return {
					...c,
					server: await this.registry.getServerDefinition({
						id: c.serverId,
					}),
				}
			}),
		)
	}

	private mcpClientsById = new Map<string, MastraMCPClient>()
	public async getConnectedTools() {
		const toolsets: Record<string, any> = {}
		const configurations = await this.list()

		for (const { config, server } of configurations) {
			const id =
				server.name +
				config.command +
				(config.args || []).join() +
				(config.runtimeArgs || []).join() +
				JSON.stringify(config.env)

			const exists = this.mcpClientsById.has(id)

			if (!exists) {
				console.log(`Connecting to ${server.name} MCP server`)
			}

			const mcpClient = exists
				? this.mcpClientsById.get(id)!
				: new MastraMCPClient({
						name: server.name,
						server: {
							command: config.command,
							args: [...(config.args || []), ...(config.runtimeArgs || [])],
							env: config.env,
						},
					})

			if (!exists) {
				await mcpClient.connect()
				this.mcpClientsById.set(id, mcpClient)
				process.on(`exit`, () => {
					mcpClient.disconnect()
				})
			}

			const tools = await mcpClient.tools()
			if (tools) {
				toolsets[server.name] = tools
			}
		}

		return toolsets
	}
}
