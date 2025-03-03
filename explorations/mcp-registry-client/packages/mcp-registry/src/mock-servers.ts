import { ServerData } from "./server.js"

// Define types based on the mock data structure
export type MockRegistry = {
	readonly registry: {
		readonly name: string
		readonly description: string
		readonly homepage: string
	}
	readonly servers: readonly ServerData[]
}

// Infer the type from the mock data
export const MOCK_REGISTRIES = {
	"https://opentools.com/.well-known/mcp": {
		registry: {
			name: "OpenTools Registry",
			description: "Discover and use MCP servers for your AI applications",
			homepage: "https://opentools.com",
		},
		servers: [
			{
				id: "stripe",
				name: "Stripe",
				description:
					"Interact with the Stripe API. This server supports various tools to interact with different Stripe services.",
				version: "1.0.0",
				publisher: {
					id: "stripe",
					name: "Stripe, Inc.",
					url: "https://github.com/stripe",
				},
				isOfficial: true,
				sourceUrl:
					"https://github.com/stripe/agent-toolkit/tree/main/modelcontextprotocol",
				distribution: { type: "npm", package: "@stripe/mcp" },
				license: "MIT",
				runtime: "node",
				config: [
					{
						command: "npx",
						args: ["-y", "@stripe/mcp", "--tools=all"],
						env: {
							STRIPE_API_KEY: {
								description: "Your Stripe API key.",
								required: true,
							},
						},
					},
				],
				downloads: 176,
				createdAt: "2024-11-11T17:13:41Z",
				capabilities: {
					tools: true,
				},
				transport: {
					type: "stdio",
					stateful: false,
				},
			},
			{
				id: "firecrawl",
				name: "Firecrawl",
				description:
					"A Model Context Protocol (MCP) server implementation that integrates with Firecrawl for web scraping capabilities.",
				version: "1.0.0",
				publisher: {
					id: "mendableai",
					name: "SideGuide Technologies Inc.",
					url: "https://github.com/mendableai",
				},
				isOfficial: true,
				sourceUrl: "https://github.com/mendableai/firecrawl-mcp-server",
				distribution: { type: "npm", package: "firecrawl-mcp" },
				license: "MIT",
				runtime: "node",
				config: [
					{
						command: "npx",
						args: ["-y", "firecrawl-mcp"],
						env: {
							FIRECRAWL_API_KEY: { description: "Your Firecrawl API key." },
						},
					},
				],
				downloads: 0,
				createdAt: "2024-12-06T07:50:27Z",
				capabilities: {
					tools: true,
				},
				transport: {
					type: "stdio",
					stateful: false,
				},
			},
			{
				id: "brave-search-ref",
				name: "Brave Search",
				description:
					"Web and local search using Brave's Search API. A Model Context Protocol reference server.",
				version: "1.0.0",
				publisher: {
					id: "modelcontextprotocol",
					name: "Anthropic, PBC",
					url: "https://modelcontextprotocol.io/",
				},
				isOfficial: false,
				sourceUrl:
					"https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
				distribution: {
					type: "npm",
					package: "@modelcontextprotocol/server-brave-search",
				},
				license: "MIT",
				runtime: "node",
				config: [
					{
						command: "docker",
						args: ["run", "-i", "--rm", "-e", "BRAVE_API_KEY"],
						runtimeArgs: {
							description: "Docker image for MCP Brave Search server",
							default: ["mcp/brave-search"],
							multiple: false,
						},
						env: {
							BRAVE_API_KEY: { description: "Your Brave Search API key." },
						},
					},
					{
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-brave-search"],
						env: {
							BRAVE_API_KEY: { description: "Your Brave Search API key." },
						},
					},
				],
				downloads: 30291,
				createdAt: "2024-11-19T01:10:17Z",
				capabilities: {
					tools: true,
				},
				transport: {
					type: "stdio",
					stateful: false,
				},
			},
			{
				id: "browserbase",
				name: "Browserbase",
				description:
					"Automate browser interactions in the cloud (e.g. web navigation, data extraction, form filling, and more)",
				version: "1.0.0",
				publisher: {
					id: "browserbase",
					name: "Browserbase Inc.",
					url: "https://www.browserbase.com/",
				},
				isOfficial: true,
				sourceUrl:
					"https://github.com/browserbase/mcp-server-browserbase/tree/main/browserbase",
				distribution: {
					type: "npm",
					package: "@browserbasehq/mcp-browserbase",
				},
				license: "MIT",
				runtime: "node",
				config: [
					{
						command: "npx",
						args: ["-y", "@browserbasehq/mcp-browserbase"],
						env: {
							BROWSERBASE_API_KEY: {
								description:
									"Your Browserbase API key. Find it at: https://www.browserbase.com/settings",
							},
							BROWSERBASE_PROJECT_ID: {
								description:
									"Your Browserbase project ID. Find it at: https://www.browserbase.com/settings",
							},
						},
					},
				],
				downloads: 144,
				createdAt: "2024-12-05T19:20:40Z",
				capabilities: {
					tools: true,
				},
				transport: {
					type: "stdio",
					stateful: true,
				},
			},
			{
				id: "filesystem-ref",
				name: "Filesystem Reference",
				description: "Reference implementation of a filesystem MCP server",
				version: "1.0.0",
				publisher: {
					id: "modelcontextprotocol",
					name: "Anthropic, PBC",
					url: "https://modelcontextprotocol.io/",
				},
				isOfficial: false,
				sourceUrl:
					"https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
				distribution: {
					type: "npm",
					package: "@modelcontextprotocol/server-filesystem",
				},
				license: "MIT",
				runtime: "node",
				config: [
					{
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-filesystem"],
						runtimeArgs: {
							description: "Path to directory to serve",
							multiple: true,
						},
					},
				],
				downloads: 687,
				createdAt: "2024-11-19T01:10:17Z",
				capabilities: {
					resources: true,
					tools: true,
				},
				transport: {
					type: "stdio",
					stateful: false,
				},
			},
			{
				id: "fetch-ref",
				name: "Fetch",
				description:
					"Web content fetching and conversion for efficient LLM usage. A Model Context Protocol reference server.",
				version: "1.0.0",
				publisher: {
					id: "modelcontextprotocol",
					name: "Anthropic, PBC",
					url: "https://modelcontextprotocol.io/",
				},
				isOfficial: false,
				sourceUrl:
					"https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
				distribution: { type: "pip", package: "mcp-server-fetch" },
				license: "MIT",
				runtime: "python",
				config: [
					{ command: "uvx", args: ["mcp-server-fetch"], env: {} },
					{
						command: "docker",
						args: ["run", "-i", "--rm"],
						runtimeArgs: {
							description: "Docker image for MCP fetch server",
							default: ["mcp/fetch"],
							multiple: false,
						},
						env: {},
					},
					{ command: "python", args: ["-m", "mcp_server_fetch"], env: {} },
				],
				downloads: 15979,
				createdAt: "2024-11-19T01:10:17Z",
				capabilities: {
					tools: true,
				},
				transport: {
					type: "stdio",
					stateful: false,
				},
			},
			{
				id: "git-ref",
				name: "Git Reference",
				description: "Reference implementation of a git MCP server",
				version: "1.0.0",
				publisher: {
					id: "modelcontextprotocol",
					name: "Anthropic, PBC",
					url: "https://modelcontextprotocol.io/",
				},
				isOfficial: false,
				sourceUrl:
					"https://github.com/modelcontextprotocol/servers/tree/main/src/git",
				distribution: {
					type: "npm",
					package: "@modelcontextprotocol/server-git",
				},
				license: "MIT",
				runtime: "node",
				config: [
					{
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-git"],
						runtimeArgs: {
							description: "Path to git repository",
							multiple: false,
						},
					},
				],
				downloads: 432,
				createdAt: "2024-11-19T01:10:17Z",
				capabilities: {
					tools: true,
				},
				transport: {
					type: "stdio",
					stateful: false,
				},
			},
			{
				id: "everything-ref",
				name: "Everything Reference",
				description:
					"This MCP server attempts to exercise all the features of the MCP protocol. It is not intended to be a useful server, but rather a test server for builders of MCP clients.",
				version: "1.0.0",
				publisher: {
					id: "modelcontextprotocol",
					name: "Anthropic, PBC",
					url: "https://modelcontextprotocol.io/",
				},
				isOfficial: false,
				sourceUrl:
					"https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
				distribution: {
					type: "npm",
					package: "@modelcontextprotocol/server-everything",
				},
				license: "MIT",
				runtime: "node",
				config: [
					{
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-everything"],
						runtimeArgs: {
							description: "Test data directory",
							multiple: false,
						},
					},
				],
				downloads: 1023,
				createdAt: "2024-11-19T01:10:17Z",
				capabilities: {
					resources: true,
					tools: true,
					prompts: true,
				},
				transport: {
					type: "stdio",
					stateful: true,
				},
			},
		],
	},
} as const

// Infer the type from the constant
export type MockRegistries = typeof MOCK_REGISTRIES
