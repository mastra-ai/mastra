/**
 * Example of MCP Configuration validation failures:
 *
 * Tests various validation scenarios for server configuration including:
 * - Command validation
 * - Runtime arguments validation
 * - Environment variables validation
 * - Type checking
 * - Default values
 */

import { RegistryClient } from "@mcp/registry/dist/registry.js"
import { McpConfiguration } from "@mastra/mcp-configuration/dist/index.js"

const registry = new RegistryClient({
	url: `https://opentools.com/.well-known/mcp`,
})

const server = await registry.getServerDefinition({
	id: "git-ref",
})

const configuration = new McpConfiguration({
	id: "validation-example",
	registry,
})

// Type for expected config shape
type ConfigTest = {
	command: string
	args?: string[]
	runtimeArgs?: string[]
	env?: Record<string, string>
}

async function testValidation(
	name: string,
	config: Partial<ConfigTest> & { command?: string },
) {
	try {
		await configuration.add({
			server,
			config: config as any,
		})
		console.error(`❌ ${name} should have failed but passed`)
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error)
		console.log(`✅ ${name} failed as expected:`, message)
	}
}

// Basic command validation
await testValidation("Invalid command", {
	command: "invalid-command",
	runtimeArgs: ["/path/1"],
})

// Runtime args validation
await testValidation("Multiple runtime args", {
	command: "uvx",
	runtimeArgs: ["/path/1", "/path/2"],
})

await testValidation("Runtime args without command args", {
	command: "uvx",
	args: [],
	runtimeArgs: ["/path/1"],
})

// Environment variables validation
await testValidation("Invalid env var", {
	command: "uvx",
	runtimeArgs: ["/path/1"],
	env: {
		INVALID_ENV: "value",
	},
})

// Command validation
await testValidation("Empty command", {
	command: "",
	runtimeArgs: ["/path/1"],
})

// Missing command
await testValidation("Missing command", {
	command: "",
	runtimeArgs: ["/path/1"],
})

// Type validation
await testValidation("Invalid runtime args type", {
	command: "uvx",
	runtimeArgs: "not-an-array" as any,
})

await testValidation("Invalid env var type", {
	command: "uvx",
	runtimeArgs: ["/path/1"],
	env: "not-an-object" as any,
})

await testValidation("Invalid args type", {
	command: "uvx",
	args: "not-an-array" as any,
	runtimeArgs: ["/path/1"],
})

// Default values
await testValidation("Override default runtime args", {
	command: "uvx",
	runtimeArgs: ["/different/path"],
})

// Combined validation
await testValidation("Multiple validation failures", {
	command: "uvx",
	args: "invalid" as any,
	runtimeArgs: ["/path/1", "/path/2"],
	env: {
		INVALID_ENV: "value",
	},
})
