# MCP TypeScript SDK ![NPM Version](https://img.shields.io/npm/v/%40modelcontextprotocol%2Fsdk) ![MIT licensed](https://img.shields.io/npm/l/%40modelcontextprotocol%2Fsdk)

<details>
<summary>Table of Contents</summary>

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
    - [Server](#server)
    - [Tools](#tools)
    - [Resources](#resources)
    - [Prompts](#prompts)
    - [Completions](#completions)
    - [Display Names and Metadata](#display-names-and-metadata)
    - [Sampling](#sampling)
- [Running Your Server](#running-your-server)
    - [Streamable HTTP](#streamable-http)
    - [stdio](#stdio)
    - [Testing and Debugging](#testing-and-debugging)
- [Examples](#examples)
    - [Echo Server](#echo-server)
    - [SQLite Explorer](#sqlite-explorer)
- [Advanced Usage](#advanced-usage)
    - [Dynamic Servers](#dynamic-servers)
    - [Improving Network Efficiency with Notification Debouncing](#improving-network-efficiency-with-notification-debouncing)
    - [Low-Level Server](#low-level-server)
    - [Eliciting User Input](#eliciting-user-input)
    - [Writing MCP Clients](#writing-mcp-clients)
    - [Proxy Authorization Requests Upstream](#proxy-authorization-requests-upstream)
    - [Backwards Compatibility](#backwards-compatibility)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

</details>

## Overview

The Model Context Protocol allows applications to provide context for LLMs in a standardized way, separating the concerns of providing context from the actual LLM interaction. This TypeScript SDK implements
[the full MCP specification](https://modelcontextprotocol.io/specification/latest), making it easy to:

- Create MCP servers that expose resources, prompts and tools
- Build MCP clients that can connect to any MCP server
- Use standard transports like stdio and Streamable HTTP

## Installation

```bash
npm install @modelcontextprotocol/sdk
```

## Quick Start

Let's create a simple MCP server that exposes a calculator tool and some data. Save the following as `server.ts`:

```typescript
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

// Create an MCP server
const server = new McpServer({
    name: 'demo-server',
    version: '1.0.0'
});

// Add an addition tool
server.registerTool(
    'add',
    {
        title: 'Addition Tool',
        description: 'Add two numbers',
        inputSchema: { a: z.number(), b: z.number() },
        outputSchema: { result: z.number() }
    },
    async ({ a, b }) => {
        const output = { result: a + b };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

// Add a dynamic greeting resource
server.registerResource(
    'greeting',
    new ResourceTemplate('greeting://{name}', { list: undefined }),
    {
        title: 'Greeting Resource', // Display name for UI
        description: 'Dynamic greeting generator'
    },
    async (uri, { name }) => ({
        contents: [
            {
                uri: uri.href,
                text: `Hello, ${name}!`
            }
        ]
    })
);

// Set up Express and HTTP transport
const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});
```

Install the deps with `npm install @modelcontextprotocol/sdk express zod@3`, and run with `npx -y tsx server.ts`.

You can connect to it using any MCP client that supports streamable http, such as:

- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector): `npx @modelcontextprotocol/inspector` and connect to the streamable HTTP URL `http://localhost:3000/mcp`
- [Claude Code](https://docs.claude.com/en/docs/claude-code/mcp): `claude mcp add --transport http my-server http://localhost:3000/mcp`
- [VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers): `code --add-mcp "{\"name\":\"my-server\",\"type\":\"http\",\"url\":\"http://localhost:3000/mcp\"}"`
- [Cursor](https://cursor.com/docs/context/mcp): Click [this deeplink](cursor://anysphere.cursor-deeplink/mcp/install?name=my-server&config=eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAvbWNwIn0%3D)

Then try asking your agent to add two numbers using its new tool!

## Core Concepts

### Server

The McpServer is your core interface to the MCP protocol. It handles connection management, protocol compliance, and message routing:

```typescript
const server = new McpServer({
    name: 'my-app',
    version: '1.0.0'
});
```

### Tools

[Tools](https://modelcontextprotocol.io/specification/latest/server/tools) let LLMs take actions through your server. Tools can perform computation, fetch data and have side effects. Tools should be designed to be model-controlled - i.e. AI models will decide which tools to call,
and the arguments.

```typescript
// Simple tool with parameters
server.registerTool(
    'calculate-bmi',
    {
        title: 'BMI Calculator',
        description: 'Calculate Body Mass Index',
        inputSchema: {
            weightKg: z.number(),
            heightM: z.number()
        },
        outputSchema: { bmi: z.number() }
    },
    async ({ weightKg, heightM }) => {
        const output = { bmi: weightKg / (heightM * heightM) };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(output)
                }
            ],
            structuredContent: output
        };
    }
);

// Async tool with external API call
server.registerTool(
    'fetch-weather',
    {
        title: 'Weather Fetcher',
        description: 'Get weather data for a city',
        inputSchema: { city: z.string() },
        outputSchema: { temperature: z.number(), conditions: z.string() }
    },
    async ({ city }) => {
        const response = await fetch(`https://api.weather.com/${city}`);
        const data = await response.json();
        const output = { temperature: data.temp, conditions: data.conditions };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

// Tool that returns ResourceLinks
server.registerTool(
    'list-files',
    {
        title: 'List Files',
        description: 'List project files',
        inputSchema: { pattern: z.string() },
        outputSchema: {
            count: z.number(),
            files: z.array(z.object({ name: z.string(), uri: z.string() }))
        }
    },
    async ({ pattern }) => {
        const output = {
            count: 2,
            files: [
                { name: 'README.md', uri: 'file:///project/README.md' },
                { name: 'index.ts', uri: 'file:///project/src/index.ts' }
            ]
        };
        return {
            content: [
                { type: 'text', text: JSON.stringify(output) },
                // ResourceLinks let tools return references without file content
                {
                    type: 'resource_link',
                    uri: 'file:///project/README.md',
                    name: 'README.md',
                    mimeType: 'text/markdown',
                    description: 'A README file'
                },
                {
                    type: 'resource_link',
                    uri: 'file:///project/src/index.ts',
                    name: 'index.ts',
                    mimeType: 'text/typescript',
                    description: 'An index file'
                }
            ],
            structuredContent: output
        };
    }
);
```

#### ResourceLinks

Tools can return `ResourceLink` objects to reference resources without embedding their full content. This can be helpful for performance when dealing with large files or many resources - clients can then selectively read only the resources they need using the provided URIs.

### Resources

[Resources](https://modelcontextprotocol.io/specification/latest/server/resources) can also expose data to LLMs, but unlike tools shouldn't perform significant computation or have side effects.

Resources are designed to be used in an application-driven way, meaning MCP client applications can decide how to expose them. For example, a client could expose a resource picker to the human, or could expose them to the model directly.

```typescript
// Static resource
server.registerResource(
    'config',
    'config://app',
    {
        title: 'Application Config',
        description: 'Application configuration data',
        mimeType: 'text/plain'
    },
    async uri => ({
        contents: [
            {
                uri: uri.href,
                text: 'App configuration here'
            }
        ]
    })
);

// Dynamic resource with parameters
server.registerResource(
    'user-profile',
    new ResourceTemplate('users://{userId}/profile', { list: undefined }),
    {
        title: 'User Profile',
        description: 'User profile information'
    },
    async (uri, { userId }) => ({
        contents: [
            {
                uri: uri.href,
                text: `Profile data for user ${userId}`
            }
        ]
    })
);

// Resource with context-aware completion
server.registerResource(
    'repository',
    new ResourceTemplate('github://repos/{owner}/{repo}', {
        list: undefined,
        complete: {
            // Provide intelligent completions based on previously resolved parameters
            repo: (value, context) => {
                if (context?.arguments?.['owner'] === 'org1') {
                    return ['project1', 'project2', 'project3'].filter(r => r.startsWith(value));
                }
                return ['default-repo'].filter(r => r.startsWith(value));
            }
        }
    }),
    {
        title: 'GitHub Repository',
        description: 'Repository information'
    },
    async (uri, { owner, repo }) => ({
        contents: [
            {
                uri: uri.href,
                text: `Repository: ${owner}/${repo}`
            }
        ]
    })
);
```

### Prompts

[Prompts](https://modelcontextprotocol.io/specification/latest/server/prompts) are reusable templates that help humans prompt models to interact with your server. They're designed to be user-driven, and might appear as slash commands in a chat interface.

```typescript
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';

server.registerPrompt(
    'review-code',
    {
        title: 'Code Review',
        description: 'Review code for best practices and potential issues',
        argsSchema: { code: z.string() }
    },
    ({ code }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Please review this code:\n\n${code}`
                }
            }
        ]
    })
);

// Prompt with context-aware completion
server.registerPrompt(
    'team-greeting',
    {
        title: 'Team Greeting',
        description: 'Generate a greeting for team members',
        argsSchema: {
            department: completable(z.string(), value => {
                // Department suggestions
                return ['engineering', 'sales', 'marketing', 'support'].filter(d => d.startsWith(value));
            }),
            name: completable(z.string(), (value, context) => {
                // Name suggestions based on selected department
                const department = context?.arguments?.['department'];
                if (department === 'engineering') {
                    return ['Alice', 'Bob', 'Charlie'].filter(n => n.startsWith(value));
                } else if (department === 'sales') {
                    return ['David', 'Eve', 'Frank'].filter(n => n.startsWith(value));
                } else if (department === 'marketing') {
                    return ['Grace', 'Henry', 'Iris'].filter(n => n.startsWith(value));
                }
                return ['Guest'].filter(n => n.startsWith(value));
            })
        }
    },
    ({ department, name }) => ({
        messages: [
            {
                role: 'assistant',
                content: {
                    type: 'text',
                    text: `Hello ${name}, welcome to the ${department} team!`
                }
            }
        ]
    })
);
```

### Completions

MCP supports argument completions to help users fill in prompt arguments and resource template parameters. See the examples above for [resource completions](#resources) and [prompt completions](#prompts).

#### Client Usage

```typescript
// Request completions for any argument
const result = await client.complete({
    ref: {
        type: 'ref/prompt', // or "ref/resource"
        name: 'example' // or uri: "template://..."
    },
    argument: {
        name: 'argumentName',
        value: 'partial' // What the user has typed so far
    },
    context: {
        // Optional: Include previously resolved arguments
        arguments: {
            previousArg: 'value'
        }
    }
});
```

### Display Names and Metadata

All resources, tools, and prompts support an optional `title` field for better UI presentation. The `title` is used as a display name (e.g. 'Create a new issue'), while `name` remains the unique identifier (e.g. `create_issue`).

**Note:** The `register*` methods (`registerTool`, `registerPrompt`, `registerResource`) are the recommended approach for new code. The older methods (`tool`, `prompt`, `resource`) remain available for backwards compatibility.

#### Title Precedence for Tools

For tools specifically, there are two ways to specify a title:

- `title` field in the tool configuration
- `annotations.title` field (when using the older `tool()` method with annotations)

The precedence order is: `title` → `annotations.title` → `name`

```typescript
// Using registerTool (recommended)
server.registerTool(
    'my_tool',
    {
        title: 'My Tool', // This title takes precedence
        annotations: {
            title: 'Annotation Title' // This is ignored if title is set
        }
    },
    handler
);

// Using tool with annotations (older API)
server.tool(
    'my_tool',
    'description',
    {
        title: 'Annotation Title' // This is used as title
    },
    handler
);
```

When building clients, use the provided utility to get the appropriate display name:

```typescript
import { getDisplayName } from '@modelcontextprotocol/sdk/shared/metadataUtils.js';

// Automatically handles the precedence: title → annotations.title → name
const displayName = getDisplayName(tool);
```

### Sampling

MCP servers can request LLM completions from connected clients that support sampling.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

const mcpServer = new McpServer({
    name: 'tools-with-sample-server',
    version: '1.0.0'
});

// Tool that uses LLM sampling to summarize any text
mcpServer.registerTool(
    'summarize',
    {
        title: 'Text Summarizer',
        description: 'Summarize any text using an LLM',
        inputSchema: {
            text: z.string().describe('Text to summarize')
        },
        outputSchema: { summary: z.string() }
    },
    async ({ text }) => {
        // Call the LLM through MCP sampling
        const response = await mcpServer.server.createMessage({
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Please summarize the following text concisely:\n\n${text}`
                    }
                }
            ],
            maxTokens: 500
        });

        const summary = response.content.type === 'text' ? response.content.text : 'Unable to generate summary';
        const output = { summary };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});
```

## Running Your Server

MCP servers in TypeScript need to be connected to a transport to communicate with clients. How you start the server depends on the choice of transport:

### Streamable HTTP

For remote servers, use the Streamable HTTP transport.

#### Without Session Management (Recommended)

For most use cases where session management isn't needed:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Create the MCP server once (can be reused across requests)
const server = new McpServer({
    name: 'example-server',
    version: '1.0.0'
});

// Set up your tools, resources, and prompts
server.registerTool(
    'echo',
    {
        title: 'Echo Tool',
        description: 'Echoes back the provided message',
        inputSchema: { message: z.string() },
        outputSchema: { echo: z.string() }
    },
    async ({ message }) => {
        const output = { echo: `Tool echo: ${message}` };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

app.post('/mcp', async (req, res) => {
    // In stateless mode, create a new transport for each request to prevent
    // request ID collisions. Different clients may use the same JSON-RPC request IDs,
    // which would cause responses to be routed to the wrong HTTP connections if
    // the transport state is shared.

    try {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        });

        res.on('close', () => {
            transport.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error'
                },
                id: null
            });
        }
    }
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});
```

#### With Session Management

In some cases, servers need stateful sessions. This can be achieved by [session management](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#session-management) in the MCP protocol.

```typescript
import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: sessionId => {
                // Store the transport by session ID
                transports[sessionId] = transport;
            }
            // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
            // locally, make sure to set:
            // enableDnsRebindingProtection: true,
            // allowedHosts: ['127.0.0.1'],
        });

        // Clean up transport when closed
        transport.onclose = () => {
            if (transport.sessionId) {
                delete transports[transport.sessionId];
            }
        };
        const server = new McpServer({
            name: 'example-server',
            version: '1.0.0'
        });

        // ... set up server resources, tools, and prompts ...

        // Connect to the MCP server
        await server.connect(transport);
    } else {
        // Invalid request
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided'
            },
            id: null
        });
        return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

app.listen(3000);
```

#### CORS Configuration for Browser-Based Clients

If you'd like your server to be accessible by browser-based MCP clients, you'll need to configure CORS headers. The `Mcp-Session-Id` header must be exposed for browser clients to access it:

```typescript
import cors from 'cors';

// Add CORS middleware before your MCP routes
app.use(
    cors({
        origin: '*', // Configure appropriately for production, for example:
        // origin: ['https://your-remote-domain.com', 'https://your-other-remote-domain.com'],
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: ['Content-Type', 'mcp-session-id']
    })
);
```

This configuration is necessary because:

- The MCP streamable HTTP transport uses the `Mcp-Session-Id` header for session management
- Browsers restrict access to response headers unless explicitly exposed via CORS
- Without this configuration, browser-based clients won't be able to read the session ID from initialization responses

#### DNS Rebinding Protection

The Streamable HTTP transport includes DNS rebinding protection to prevent security vulnerabilities. By default, this protection is **disabled** for backwards compatibility.

**Important**: If you are running this server locally, enable DNS rebinding protection:

```typescript
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  enableDnsRebindingProtection: true,

  allowedHosts: ['127.0.0.1', ...],
  allowedOrigins: ['https://yourdomain.com', 'https://www.yourdomain.com']
});
```

### stdio

For local integrations spawned by another process, you can use the stdio transport:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
    name: 'example-server',
    version: '1.0.0'
});

// ... set up server resources, tools, and prompts ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Testing and Debugging

To test your server, you can use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector). See its README for more information.

## Examples

### Echo Server

A simple server demonstrating resources, tools, and prompts:

```typescript
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
    name: 'echo-server',
    version: '1.0.0'
});

server.registerTool(
    'echo',
    {
        title: 'Echo Tool',
        description: 'Echoes back the provided message',
        inputSchema: { message: z.string() },
        outputSchema: { echo: z.string() }
    },
    async ({ message }) => {
        const output = { echo: `Tool echo: ${message}` };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

server.registerResource(
    'echo',
    new ResourceTemplate('echo://{message}', { list: undefined }),
    {
        title: 'Echo Resource',
        description: 'Echoes back messages as resources'
    },
    async (uri, { message }) => ({
        contents: [
            {
                uri: uri.href,
                text: `Resource echo: ${message}`
            }
        ]
    })
);

server.registerPrompt(
    'echo',
    {
        title: 'Echo Prompt',
        description: 'Creates a prompt to process a message',
        argsSchema: { message: z.string() }
    },
    ({ message }) => ({
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Please process this message: ${message}`
                }
            }
        ]
    })
);
```

### SQLite Explorer

A more complex example showing database integration:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { z } from 'zod';

const server = new McpServer({
    name: 'sqlite-explorer',
    version: '1.0.0'
});

// Helper to create DB connection
const getDb = () => {
    const db = new sqlite3.Database('database.db');
    return {
        all: promisify<string, any[]>(db.all.bind(db)),
        close: promisify(db.close.bind(db))
    };
};

server.registerResource(
    'schema',
    'schema://main',
    {
        title: 'Database Schema',
        description: 'SQLite database schema',
        mimeType: 'text/plain'
    },
    async uri => {
        const db = getDb();
        try {
            const tables = await db.all("SELECT sql FROM sqlite_master WHERE type='table'");
            return {
                contents: [
                    {
                        uri: uri.href,
                        text: tables.map((t: { sql: string }) => t.sql).join('\n')
                    }
                ]
            };
        } finally {
            await db.close();
        }
    }
);

server.registerTool(
    'query',
    {
        title: 'SQL Query',
        description: 'Execute SQL queries on the database',
        inputSchema: { sql: z.string() },
        outputSchema: {
            rows: z.array(z.record(z.any())),
            rowCount: z.number()
        }
    },
    async ({ sql }) => {
        const db = getDb();
        try {
            const results = await db.all(sql);
            const output = { rows: results, rowCount: results.length };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(output, null, 2)
                    }
                ],
                structuredContent: output
            };
        } catch (err: unknown) {
            const error = err as Error;
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error.message}`
                    }
                ],
                isError: true
            };
        } finally {
            await db.close();
        }
    }
);
```

## Advanced Usage

### Dynamic Servers

If you want to offer an initial set of tools/prompts/resources, but later add additional ones based on user action or external state change, you can add/update/remove them _after_ the Server is connected. This will automatically emit the corresponding `listChanged` notifications:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

const server = new McpServer({
    name: 'Dynamic Example',
    version: '1.0.0'
});

const listMessageTool = server.registerTool(
    'listMessages',
    {
        title: 'List Messages',
        description: 'List messages in a channel',
        inputSchema: { channel: z.string() },
        outputSchema: { messages: z.array(z.string()) }
    },
    async ({ channel }) => {
        const messages = await listMessages(channel);
        const output = { messages };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

const putMessageTool = server.registerTool(
    'putMessage',
    {
        title: 'Put Message',
        description: 'Send a message to a channel',
        inputSchema: { channel: z.string(), message: z.string() },
        outputSchema: { success: z.boolean() }
    },
    async ({ channel, message }) => {
        await putMessage(channel, message);
        const output = { success: true };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);
// Until we upgrade auth, `putMessage` is disabled (won't show up in listTools)
putMessageTool.disable();

const upgradeAuthTool = server.registerTool(
    'upgradeAuth',
    {
        title: 'Upgrade Authorization',
        description: 'Upgrade user authorization level',
        inputSchema: { permission: z.enum(['write', 'admin']) },
        outputSchema: {
            success: z.boolean(),
            newPermission: z.string()
        }
    },
    // Any mutations here will automatically emit `listChanged` notifications
    async ({ permission }) => {
        const { ok, err, previous } = await upgradeAuthAndStoreToken(permission);
        if (!ok) {
            return {
                content: [{ type: 'text', text: `Error: ${err}` }],
                isError: true
            };
        }

        // If we previously had read-only access, 'putMessage' is now available
        if (previous === 'read') {
            putMessageTool.enable();
        }

        if (permission === 'write') {
            // If we've just upgraded to 'write' permissions, we can still call 'upgradeAuth'
            // but can only upgrade to 'admin'.
            upgradeAuthTool.update({
                paramsSchema: { permission: z.enum(['admin']) } // change validation rules
            });
        } else {
            // If we're now an admin, we no longer have anywhere to upgrade to, so fully remove that tool
            upgradeAuthTool.remove();
        }

        const output = { success: true, newPermission: permission };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

// Connect with HTTP transport
const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`MCP Server running on http://localhost:${port}/mcp`);
});
```

### Improving Network Efficiency with Notification Debouncing

When performing bulk updates that trigger notifications (e.g., enabling or disabling multiple tools in a loop), the SDK can send a large number of messages in a short period. To improve performance and reduce network traffic, you can enable notification debouncing.

This feature coalesces multiple, rapid calls for the same notification type into a single message. For example, if you disable five tools in a row, only one `notifications/tools/list_changed` message will be sent instead of five.

> [!IMPORTANT] This feature is designed for "simple" notifications that do not carry unique data in their parameters. To prevent silent data loss, debouncing is **automatically bypassed** for any notification that contains a `params` object or a `relatedRequestId`. Such
> notifications will always be sent immediately.

This is an opt-in feature configured during server initialization.

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer(
  {
    name: "efficient-server",
    version: "1.0.0"
  },
  {
    // Enable notification debouncing for specific methods
    debouncedNotificationMethods: [
      'notifications/tools/list_changed',
      'notifications/resources/list_changed',
      'notifications/prompts/list_changed'
    ]
  }
);

// Now, any rapid changes to tools, resources, or prompts will result
// in a single, consolidated notification for each type.
server.registerTool("tool1", ...).disable();
server.registerTool("tool2", ...).disable();
server.registerTool("tool3", ...).disable();
// Only one 'notifications/tools/list_changed' is sent.
```

### Low-Level Server

For more control, you can use the low-level Server class directly:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
    {
        name: 'example-server',
        version: '1.0.0'
    },
    {
        capabilities: {
            prompts: {}
        }
    }
);

server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: 'example-prompt',
                description: 'An example prompt template',
                arguments: [
                    {
                        name: 'arg1',
                        description: 'Example argument',
                        required: true
                    }
                ]
            }
        ]
    };
});

server.setRequestHandler(GetPromptRequestSchema, async request => {
    if (request.params.name !== 'example-prompt') {
        throw new Error('Unknown prompt');
    }
    return {
        description: 'Example prompt',
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'Example prompt text'
                }
            }
        ]
    };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Eliciting User Input

MCP servers can request additional information from users through the elicitation feature. This is useful for interactive workflows where the server needs user input or confirmation:

```typescript
// Server-side: Restaurant booking tool that asks for alternatives
server.registerTool(
    'book-restaurant',
    {
        title: 'Book Restaurant',
        description: 'Book a table at a restaurant',
        inputSchema: {
            restaurant: z.string(),
            date: z.string(),
            partySize: z.number()
        },
        outputSchema: {
            success: z.boolean(),
            booking: z
                .object({
                    restaurant: z.string(),
                    date: z.string(),
                    partySize: z.number()
                })
                .optional(),
            alternatives: z.array(z.string()).optional()
        }
    },
    async ({ restaurant, date, partySize }) => {
        // Check availability
        const available = await checkAvailability(restaurant, date, partySize);

        if (!available) {
            // Ask user if they want to try alternative dates
            const result = await server.server.elicitInput({
                message: `No tables available at ${restaurant} on ${date}. Would you like to check alternative dates?`,
                requestedSchema: {
                    type: 'object',
                    properties: {
                        checkAlternatives: {
                            type: 'boolean',
                            title: 'Check alternative dates',
                            description: 'Would you like me to check other dates?'
                        },
                        flexibleDates: {
                            type: 'string',
                            title: 'Date flexibility',
                            description: 'How flexible are your dates?',
                            enum: ['next_day', 'same_week', 'next_week'],
                            enumNames: ['Next day', 'Same week', 'Next week']
                        }
                    },
                    required: ['checkAlternatives']
                }
            });

            if (result.action === 'accept' && result.content?.checkAlternatives) {
                const alternatives = await findAlternatives(restaurant, date, partySize, result.content.flexibleDates as string);
                const output = { success: false, alternatives };
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(output)
                        }
                    ],
                    structuredContent: output
                };
            }

            const output = { success: false };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(output)
                    }
                ],
                structuredContent: output
            };
        }

        // Book the table
        await makeBooking(restaurant, date, partySize);
        const output = {
            success: true,
            booking: { restaurant, date, partySize }
        };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(output)
                }
            ],
            structuredContent: output
        };
    }
);
```

Client-side: Handle elicitation requests

```typescript
// This is a placeholder - implement based on your UI framework
async function getInputFromUser(
    message: string,
    schema: any
): Promise<{
    action: 'accept' | 'decline' | 'cancel';
    data?: Record<string, any>;
}> {
    // This should be implemented depending on the app
    throw new Error('getInputFromUser must be implemented for your platform');
}

client.setRequestHandler(ElicitRequestSchema, async request => {
    const userResponse = await getInputFromUser(request.params.message, request.params.requestedSchema);

    return {
        action: userResponse.action,
        content: userResponse.action === 'accept' ? userResponse.data : undefined
    };
});
```

**Note**: Elicitation requires client support. Clients must declare the `elicitation` capability during initialization.

### Writing MCP Clients

The SDK provides a high-level client interface:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
    command: 'node',
    args: ['server.js']
});

const client = new Client({
    name: 'example-client',
    version: '1.0.0'
});

await client.connect(transport);

// List prompts
const prompts = await client.listPrompts();

// Get a prompt
const prompt = await client.getPrompt({
    name: 'example-prompt',
    arguments: {
        arg1: 'value'
    }
});

// List resources
const resources = await client.listResources();

// Read a resource
const resource = await client.readResource({
    uri: 'file:///example.txt'
});

// Call a tool
const result = await client.callTool({
    name: 'example-tool',
    arguments: {
        arg1: 'value'
    }
});
```

### Proxy Authorization Requests Upstream

You can proxy OAuth requests to an external authorization provider:

```typescript
import express from 'express';
import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';

const app = express();

const proxyProvider = new ProxyOAuthServerProvider({
    endpoints: {
        authorizationUrl: 'https://auth.external.com/oauth2/v1/authorize',
        tokenUrl: 'https://auth.external.com/oauth2/v1/token',
        revocationUrl: 'https://auth.external.com/oauth2/v1/revoke'
    },
    verifyAccessToken: async token => {
        return {
            token,
            clientId: '123',
            scopes: ['openid', 'email', 'profile']
        };
    },
    getClient: async client_id => {
        return {
            client_id,
            redirect_uris: ['http://localhost:3000/callback']
        };
    }
});

app.use(
    mcpAuthRouter({
        provider: proxyProvider,
        issuerUrl: new URL('http://auth.external.com'),
        baseUrl: new URL('http://mcp.example.com'),
        serviceDocumentationUrl: new URL('https://docs.example.com/')
    })
);
```

This setup allows you to:

- Forward OAuth requests to an external provider
- Add custom token validation logic
- Manage client registrations
- Provide custom documentation URLs
- Maintain control over the OAuth flow while delegating to an external provider

### Backwards Compatibility

Clients and servers with StreamableHttp transport can maintain [backwards compatibility](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#backwards-compatibility) with the deprecated HTTP+SSE transport (from protocol version 2024-11-05) as follows

#### Client-Side Compatibility

For clients that need to work with both Streamable HTTP and older SSE servers:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
let client: Client | undefined = undefined;
const baseUrl = new URL(url);
try {
    client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0'
    });
    const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
    await client.connect(transport);
    console.log('Connected using Streamable HTTP transport');
} catch (error) {
    // If that fails with a 4xx error, try the older SSE transport
    console.log('Streamable HTTP connection failed, falling back to SSE transport');
    client = new Client({
        name: 'sse-client',
        version: '1.0.0'
    });
    const sseTransport = new SSEClientTransport(baseUrl);
    await client.connect(sseTransport);
    console.log('Connected using SSE transport');
}
```

#### Server-Side Compatibility

For servers that need to support both Streamable HTTP and older clients:

```typescript
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const server = new McpServer({
    name: 'backwards-compatible-server',
    version: '1.0.0'
});

// ... set up server resources, tools, and prompts ...

const app = express();
app.use(express.json());

// Store transports for each session type
const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>
};

// Modern Streamable HTTP endpoint
app.all('/mcp', async (req, res) => {
    // Handle Streamable HTTP transport for modern clients
    // Implementation as shown in the "With Session Management" example
    // ...
});

// Legacy SSE endpoint for older clients
app.get('/sse', async (req, res) => {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;

    res.on('close', () => {
        delete transports.sse[transport.sessionId];
    });

    await server.connect(transport);
});

// Legacy message endpoint for older clients
app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res, req.body);
    } else {
        res.status(400).send('No transport found for sessionId');
    }
});

app.listen(3000);
```

**Note**: The SSE transport is now deprecated in favor of Streamable HTTP. New implementations should use Streamable HTTP, and existing SSE implementations should plan to migrate.

## Documentation

- [Model Context Protocol documentation](https://modelcontextprotocol.io)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Example Servers](https://github.com/modelcontextprotocol/servers)

## Contributing

Issues and pull requests are welcome on GitHub at <https://github.com/modelcontextprotocol/typescript-sdk>.

## License

This project is licensed under the MIT License—see the [LICENSE](LICENSE) file for details.
