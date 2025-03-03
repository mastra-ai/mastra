import { describe, it, expect } from "vitest"
import { ServerDefinition } from "../src/server.js"

describe("ServerDefinition", () => {
	const minimalServer = {
		id: "test-server",
		name: "Test Server",
		description: "A test server",
		version: "1.0.0",
		publisher: {
			id: "test",
			name: "Test Publisher",
		},
		runtime: "node",
	}

	describe("constructor", () => {
		it("should create server with minimal required fields", () => {
			const server = new ServerDefinition(minimalServer)
			expect(server.id).toBe("test-server")
			expect(server.name).toBe("Test Server")
		})

		it("should throw if required fields are missing", () => {
			expect(
				() =>
					new ServerDefinition({
						...minimalServer,
						id: undefined,
					} as any),
			).toThrow("Server ID is required")
		})
	})

	describe("parseConfig", () => {
		it("should validate command exists in config", () => {
			const server = new ServerDefinition({
				...minimalServer,
				schemas: [
					{
						command: "test-cmd",
						args: ["--test"],
					},
				],
			})

			const result = server.parseConfig({
				command: "test-cmd",
			})
			expect(result).toEqual({ command: "test-cmd" })

			expect(() =>
				server.parseConfig({
					command: "invalid-cmd",
				}),
			).toThrow('Command "invalid-cmd" not found in server configuration')
		})

		it("should validate required env vars", () => {
			const server = new ServerDefinition({
				...minimalServer,
				schemas: [
					{
						command: "test-cmd",
						env: {
							TEST_KEY: { description: "Test key", required: true },
						},
					},
				],
			})

			const result = server.parseConfig({
				command: "test-cmd",
				env: { TEST_KEY: "value" },
			})
			expect(result).toEqual({
				command: "test-cmd",
				env: { TEST_KEY: "value" },
			})

			expect(() =>
				server.parseConfig({
					command: "test-cmd",
				}),
			).toThrow("Missing required environment variables: TEST_KEY")
		})

		it("should validate runtime args multiplicity", () => {
			const server = new ServerDefinition({
				...minimalServer,
				schemas: [
					{
						command: "test-cmd",
						runtimeArgs: {
							description: "Test args",
							multiple: false,
						},
					},
				],
			})

			// Single arg should be valid
			const result = server.parseConfig({
				command: "test-cmd",
				runtimeArgs: ["arg1"],
			})
			expect(result).toEqual({
				command: "test-cmd",
				runtimeArgs: ["arg1"],
			})

			// Multiple args should be invalid
			expect(() =>
				server.parseConfig({
					command: "test-cmd",
					runtimeArgs: ["arg1", "arg2"],
				}),
			).toThrow("Multiple runtime arguments provided but not supported")
		})
	})

	describe("toJSON/serialization", () => {
		it("should serialize and deserialize server definition", () => {
			const original = new ServerDefinition({
				...minimalServer,
				schemas: [
					{
						command: "test-cmd",
						args: ["--test"],
						env: {
							TEST_KEY: { description: "Test key" },
						},
					},
				],
				capabilities: {
					tools: true,
					resources: true,
				},
			})

			const json = original.toJSON()
			const restored = new ServerDefinition(json)

			expect(restored).toBeInstanceOf(ServerDefinition)
			expect(restored.id).toBe(original.id)
			expect(restored.config).toEqual(original.config)
			expect(restored.capabilities).toEqual({ tools: true, resources: true })
		})
	})

	describe("capabilities", () => {
		it("should handle capabilities object", () => {
			const server = new ServerDefinition({
				...minimalServer,
				capabilities: {
					tools: true,
					resources: true,
					prompts: true,
				},
			})
			expect(server.capabilities).toEqual({
				tools: true,
				resources: true,
				prompts: true,
			})
		})

		it("should handle partial capabilities", () => {
			const server = new ServerDefinition({
				...minimalServer,
				capabilities: {
					tools: true,
				},
			})
			expect(server.capabilities).toEqual({ tools: true })
		})

		it("should handle undefined capabilities", () => {
			const server = new ServerDefinition(minimalServer)
			expect(server.capabilities).toBeUndefined()
		})
	})
})
