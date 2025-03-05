/**
 * Example of configuring MCP servers:
 *
 * 1. Creates a configuration manager
 * 2. Adds a server configuration
 * 3. Lists configured servers
 * 4. Updates configuration
 * 5. Removes configuration
 */

import { RegistryClient } from "@mcp/registry"
import { McpConfiguration } from "@mastra/mcp-configuration"

// Create registry client
const registry = new RegistryClient({
	url: "https://opentools.com/.well-known/mcp.json",
})

// Create configuration manager
const config = new McpConfiguration({
	id: "example-config",
	registry,
})

// Get the Stripe server definition
const stripeServer = await registry.getServerDefinition({ id: "stripe" })

// Add configuration for Stripe server
const stripeConfig = await config.add({
	server: stripeServer,
	config: {
		command: "npx",
		args: ["-y", "@stripe/mcp", "--tools=all"],
		env: {
			STRIPE_API_KEY: "sk_test_example",
		},
	},
})
console.log("Added Stripe configuration:", stripeConfig)

// List all configured servers
const configuredServers = await config.list()
console.log("\nConfigured servers:", configuredServers)

// Update configuration
const updatedConfig = await config.edit({
	server: { id: "stripe" },
	config: {
		command: "npx",
		args: ["-y", "@stripe/mcp", "--tools=all"],
		env: {
			STRIPE_API_KEY: "sk_test_updated",
		},
	},
})
console.log("\nUpdated configuration:", updatedConfig)

// Remove configuration
const removedConfig = await config.remove("stripe")
console.log("\nRemoved configuration:", removedConfig)
