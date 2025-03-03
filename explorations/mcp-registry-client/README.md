# MCP Configuration Client

This POC exploration is based around asking the question: "As an agentic framework, how can we programatically interact with MCP tool servers in a way that will simplify using MCP for our users".
This project provides tools for discovering, configuring, and managing MCP servers as an MCP client.

## Proposal 1: RegistryClient

Following the discussions in the MCP github around an [official registry](https://github.com/orgs/modelcontextprotocol/discussions/159) and the [`.well-known/mcp.json` directory](https://github.com/orgs/modelcontextprotocol/discussions/84) we prototyped what a registry client might look like.

```ts
import { RegistryClient } from "@mcp/registry"

const registry = new RegistryClient({
	url: "https://example-tools.com/.well-known/mcp.json",
})
```

This client is able to access info about the registry (name, url, etc) as well as list, search, and access servers by ID.

```ts
const directory = await registry.connect()
console.log("Connected to registry:", directory.name, directory.homepage)

const allServers = await registry.listServers()
console.log("\nAvailable servers:")

allServers.forEach((server) => {
	console.log(`- ${server.name} (${server.id}): ${server.description}`)
})

const stripeServer = await registry.getServerDefinition({ id: "stripe" })
```

When a server definition is queried, the returned definition (instance of `ServerDefinition`) contains a schema that can be used to build UIs around (see ./examples/tui/ for a TUI example)

```ts
const userInput = await buildServerUI(stripeServer.schema)
```

User input can then be validated through the server definition to ensure there aren't any problems before the configuration is either persisted somewhere or used directly to start an MCPClient instance.

```ts
const validConfig = stripeServer.parseConfig(userInput) // will throw if config is not valid
```

## Proposal 2: ServerDefinition class

In this scenario the MCP server registry and the registry client would use the same class `ServerDefinition` for introspection, validation and serializing/deserializing definitions.

```ts
const server = new ServerDefinition({
	name,
	schema,
	...etc,
})

const json = server.toJSON()
// ...
const clientServer = new ServerDefinition(json)
```

It's our opinion that APIs like this (doesn't have to be these exact ones!) should be part of the MCP spec.
These two primitives could be used to build registry UIs, configuration UIs, CLIs, framework abstractions, verdaccio-like servers, etc.

## How we would use this downstream in a framework - Mastra for example :)

Now that we have an official registry client and server definition, abstractions can be built to extend them in framework or userland specific ways.

For example an `MCPConfiguration` class which takes a registry and can use it to validate and persist configurations in a storage adapter.

```ts
import { RegistryClient } from "@mcp/registry"
import { McpConfiguration } from "@mastra/mcp"

const registry = new RegistryClient({
	url: "https://example-tools.com/.well-known/mcp.json",
})

const configuration = new McpConfiguration({
	id: "validation-example", // user or app id for persisting configs
	registry,
})
```

This class could then take static configurations:

```ts
const configuration = new McpConfiguration({
	id: "validation-example",
	registry,
	servers: {
		serverName: {
			...someConfig,
		},
		otherServer: {
			...moreConfig,
		},
	},
})
```

Or dynamically receive and validate configs:

```ts
const configuration = new McpConfiguration({
	id: "validation-example",
	registry,
	storage: new StorageAdapter(),
})

const server = await registry.getServerDefinition({
	id: "git-ref",
})

const userInput = await buildServerUI(server.schema)

await configuration.add({
	server,
	config: userInput,
})
```

In both cases the configuration class would do validation on any input configs against the server schemas.

Note: We will probably build a kind of [gql.tada](https://gql-tada.0no.co)-like experience where the TS types show available servers so that users IDE's can help with discovery, validation, and configuration as code is being written.

The configs could then be hydrated into MCP client tools and passed to an llm or agent.

```ts
const toolsets = await configuration.getConnectedTools()

const res = await agent.generate(prompt, {
	toolsets,
})
```

For this example I broke out the registry, server definitions, and configuration, but when we actually ship this API at Mastra (or an equivalent API), it will be more concise and just involve configuration and a registry endpoint. The registry and server definition classes would be internal for us.

```ts
const mcp = new MCPConfiguration({
	registry: "https://mcp.run/.well-known/mcp.json",
	servers: {
		...serverConfigs,
	},
})
```

### 1. Basic Usage Examples

In `./examples/basic-usage/*` there are four examples related to discovery, configuration, validation, and usage. Run any of these in the root of this exploration code (same dir as this readme):

```bash
pnpm ex:discovery
pnpm ex:config
pnpm ex:validate
pnpm ex:tool-use
```

Note: for running the tool-use example you must have an `OPENAI_API_KEY` env var set.

### 2. Terminal User Interface (TUI)

There's also an interactive terminal UI in `./examples/tui/` which you can run using `pnpm ex:tui`. When running the TUI you can discover, configure, and persist server configurations. After that running `pnpm ex:tool-use` again will use the MCP servers that were configured via the TUI.
