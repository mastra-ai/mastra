import { ServerDefinition, ServerData } from "./server.js"
import { MOCK_REGISTRIES, type MockRegistry } from "./mock-servers.js"

export type RegistryDirectory = {
	name: string
	description: string
	homepage: string
}

export type RegistryClientOptions = {
	url: string
}

export class RegistryClient {
	private directoryUrl: string

	constructor(options: RegistryClientOptions) {
		if (!options?.url) {
			throw new Error("RegistryClient: URL is required")
		}
		this.directoryUrl = options.url
	}

	private getMockRegistry(): MockRegistry {
		const mockRegistry = MOCK_REGISTRIES[this.directoryUrl as keyof typeof MOCK_REGISTRIES]
		if (!mockRegistry) {
			throw new Error(`RegistryClient: Registry not found at ${this.directoryUrl}`)
		}
		return mockRegistry
	}

	public async connect(): Promise<RegistryDirectory> {
		return this.getMockRegistry().registry
	}

	public async listServers(): Promise<ServerDefinition[]> {
		const mockRegistry = this.getMockRegistry()
		return mockRegistry.servers.map((serverData: ServerData) =>
			new ServerDefinition(serverData)
		)
	}

	public async getServerDefinition(input: { id: string }): Promise<ServerDefinition> {
		if (!input?.id) {
			throw new Error("RegistryClient: Server ID is required")
		}

		const mockRegistry = this.getMockRegistry()
		const serverData = mockRegistry.servers.find(server => server.id === input.id)
		
		if (!serverData) {
			throw new Error(`RegistryClient: Server "${input.id}" not found in registry at ${this.directoryUrl}`)
		}

		return new ServerDefinition(serverData)
	}
}
