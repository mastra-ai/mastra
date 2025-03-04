/**
 * Example of discovering MCP servers:
 *
 * 1. Connects to OpenTools registry
 * 2. Lists all available servers
 * 3. Gets details about specific servers
 */

import { RegistryClient } from "@mcp/registry"

// Connect to OpenTools registry
const registry = new RegistryClient({
	url: "https://opentools.com/.well-known/mcp.json",
})

// Connect to the registry
const directory = await registry.connect()
console.log("Connected to registry:", directory.name)

// List all available servers
const allServers = await registry.listServers()

console.log("\nAvailable servers:")

allServers.forEach((server) => {
	console.log(`- ${server.name} (${server.id}): ${server.description}`)
})

// Get details about a specific server
const stripeServer = await registry.getServerDefinition({ id: "stripe" })
console.log("\nStripe server details:", {
	name: stripeServer.name,
	version: stripeServer.version,
	publisher: stripeServer.publisher,
	config: stripeServer.schemas,
})
