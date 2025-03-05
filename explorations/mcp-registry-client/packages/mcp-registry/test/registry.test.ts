import { describe, it, expect, beforeEach } from "vitest"
import { RegistryClient } from "../src/registry.js"
import { MOCK_REGISTRIES } from "../src/mock-servers.js"

describe("RegistryClient", () => {
	let registry: RegistryClient
	const mockUrl = "https://opentools.com/.well-known/mcp.json"

	beforeEach(() => {
		registry = new RegistryClient({
			url: mockUrl,
		})
	})

	describe("constructor", () => {
		it("should throw if no options provided", () => {
			// @ts-expect-error Testing invalid input
			expect(() => new RegistryClient()).toThrow(
				"RegistryClient: URL is required",
			)
		})

		it("should throw if no URL is provided", () => {
			// @ts-expect-error Testing invalid input
			expect(() => new RegistryClient({})).toThrow(
				"RegistryClient: URL is required",
			)
		})

		it("should throw if URL is empty", () => {
			expect(() => new RegistryClient({ url: "" })).toThrow(
				"RegistryClient: URL is required",
			)
		})
	})

	describe("connect", () => {
		it("should connect to mock registry", async () => {
			const directory = await registry.connect()
			expect(directory).toBeDefined()
			expect(directory.name).toBe("OpenTools Registry")
			expect(directory.description).toBe(
				"Discover and use MCP servers for your AI applications",
			)
			expect(directory.homepage).toBe("https://opentools.com")
		})

		it("should throw for unknown registry URL", async () => {
			const client = new RegistryClient({ url: "https://unknown.com" })
			await expect(client.connect()).rejects.toThrow(
				"RegistryClient: Registry not found at https://unknown.com",
			)
		})
	})

	describe("listServers", () => {
		it("should return mock servers list", async () => {
			const servers = await registry.listServers()
			expect(servers).toHaveLength(MOCK_REGISTRIES[mockUrl].servers.length)

			// Check first server
			const stripe = servers.find((s) => s.id === "stripe")
			expect(stripe).toBeDefined()
			expect(stripe?.name).toBe("Stripe")
			expect(stripe?.capabilities?.tools).toBe(true)
		})
	})

	describe("getServerDefinition", () => {
		it("should throw if no input provided", async () => {
			// @ts-expect-error Testing invalid input
			await expect(registry.getServerDefinition()).rejects.toThrow(
				"RegistryClient: Server ID is required",
			)
		})

		it("should throw if no server ID is provided", async () => {
			await expect(registry.getServerDefinition({ id: "" })).rejects.toThrow(
				"RegistryClient: Server ID is required",
			)
		})

		it("should return server by ID", async () => {
			const server = await registry.getServerDefinition({ id: "stripe" })
			expect(server).toBeDefined()
			expect(server.id).toBe("stripe")
			expect(server.name).toBe("Stripe")
		})

		it("should throw for unknown server ID", async () => {
			await expect(
				registry.getServerDefinition({ id: "unknown" }),
			).rejects.toThrow(
				'RegistryClient: Server "unknown" not found in registry at',
			)
		})

		it("should validate server configuration", async () => {
			const server = await registry.getServerDefinition({ id: "stripe" })
			const result = server.parseConfig({
				command: "npx",
				env: { STRIPE_API_KEY: "test_key" },
			})
			expect(result).toEqual({
				command: "npx",
				env: { STRIPE_API_KEY: "test_key" },
			})
		})

		it("should reject invalid server configuration", async () => {
			const server = await registry.getServerDefinition({ id: "stripe" })
			expect(() =>
				server.parseConfig({
					command: "invalid-command",
					env: { INVALID_KEY: "test" },
				}),
			).toThrow('Command "invalid-command" not found in server configuration')
		})
	})
})
