"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_crypto_1 = require("node:crypto");
const mcp_js_1 = require("../../server/mcp.js");
const streamableHttp_js_1 = require("../../server/streamableHttp.js");
const zod_1 = require("zod");
const types_js_1 = require("../../types.js");
const cors_1 = __importDefault(require("cors"));
// Create an MCP server with implementation details
const getServer = () => {
    const server = new mcp_js_1.McpServer({
        name: 'json-response-streamable-http-server',
        version: '1.0.0'
    }, {
        capabilities: {
            logging: {}
        }
    });
    // Register a simple tool that returns a greeting
    server.tool('greet', 'A simple greeting tool', {
        name: zod_1.z.string().describe('Name to greet')
    }, async ({ name }) => {
        return {
            content: [
                {
                    type: 'text',
                    text: `Hello, ${name}!`
                }
            ]
        };
    });
    // Register a tool that sends multiple greetings with notifications
    server.tool('multi-greet', 'A tool that sends different greetings with delays between them', {
        name: zod_1.z.string().describe('Name to greet')
    }, async ({ name }, extra) => {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        await server.sendLoggingMessage({
            level: 'debug',
            data: `Starting multi-greet for ${name}`
        }, extra.sessionId);
        await sleep(1000); // Wait 1 second before first greeting
        await server.sendLoggingMessage({
            level: 'info',
            data: `Sending first greeting to ${name}`
        }, extra.sessionId);
        await sleep(1000); // Wait another second before second greeting
        await server.sendLoggingMessage({
            level: 'info',
            data: `Sending second greeting to ${name}`
        }, extra.sessionId);
        return {
            content: [
                {
                    type: 'text',
                    text: `Good morning, ${name}!`
                }
            ]
        };
    });
    return server;
};
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Configure CORS to expose Mcp-Session-Id header for browser-based clients
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins - adjust as needed for production
    exposedHeaders: ['Mcp-Session-Id']
}));
// Map to store transports by session ID
const transports = {};
app.post('/mcp', async (req, res) => {
    console.log('Received MCP request:', req.body);
    try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'];
        let transport;
        if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            transport = transports[sessionId];
        }
        else if (!sessionId && (0, types_js_1.isInitializeRequest)(req.body)) {
            // New initialization request - use JSON response mode
            transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
                sessionIdGenerator: () => (0, node_crypto_1.randomUUID)(),
                enableJsonResponse: true, // Enable JSON response mode
                onsessioninitialized: sessionId => {
                    // Store the transport by session ID when session is initialized
                    // This avoids race conditions where requests might come in before the session is stored
                    console.log(`Session initialized with ID: ${sessionId}`);
                    transports[sessionId] = transport;
                }
            });
            // Connect the transport to the MCP server BEFORE handling the request
            const server = getServer();
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            return; // Already handled
        }
        else {
            // Invalid request - no session ID or not initialization request
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
        // Handle the request with existing transport - no need to reconnect
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
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
// Handle GET requests for SSE streams according to spec
app.get('/mcp', async (req, res) => {
    // Since this is a very simple example, we don't support GET requests for this server
    // The spec requires returning 405 Method Not Allowed in this case
    res.status(405).set('Allow', 'POST').send('Method Not Allowed');
});
// Start the server
const PORT = 3000;
app.listen(PORT, error => {
    if (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
    console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});
// Handle server shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    process.exit(0);
});
//# sourceMappingURL=jsonResponseStreamableHttp.js.map