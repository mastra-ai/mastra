"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.WebSocket = ws_1.default;
const express_1 = __importDefault(require("express"));
const index_js_1 = require("./client/index.js");
const sse_js_1 = require("./client/sse.js");
const stdio_js_1 = require("./client/stdio.js");
const websocket_js_1 = require("./client/websocket.js");
const index_js_2 = require("./server/index.js");
const sse_js_2 = require("./server/sse.js");
const stdio_js_2 = require("./server/stdio.js");
const types_js_1 = require("./types.js");
async function runClient(url_or_command, args) {
    const client = new index_js_1.Client({
        name: 'mcp-typescript test client',
        version: '0.1.0'
    }, {
        capabilities: {
            sampling: {}
        }
    });
    let clientTransport;
    let url = undefined;
    try {
        url = new URL(url_or_command);
    }
    catch (_a) {
        // Ignore
    }
    if ((url === null || url === void 0 ? void 0 : url.protocol) === 'http:' || (url === null || url === void 0 ? void 0 : url.protocol) === 'https:') {
        clientTransport = new sse_js_1.SSEClientTransport(new URL(url_or_command));
    }
    else if ((url === null || url === void 0 ? void 0 : url.protocol) === 'ws:' || (url === null || url === void 0 ? void 0 : url.protocol) === 'wss:') {
        clientTransport = new websocket_js_1.WebSocketClientTransport(new URL(url_or_command));
    }
    else {
        clientTransport = new stdio_js_1.StdioClientTransport({
            command: url_or_command,
            args
        });
    }
    console.log('Connected to server.');
    await client.connect(clientTransport);
    console.log('Initialized.');
    await client.request({ method: 'resources/list' }, types_js_1.ListResourcesResultSchema);
    await client.close();
    console.log('Closed.');
}
async function runServer(port) {
    if (port !== null) {
        const app = (0, express_1.default)();
        let servers = [];
        app.get('/sse', async (req, res) => {
            console.log('Got new SSE connection');
            const transport = new sse_js_2.SSEServerTransport('/message', res);
            const server = new index_js_2.Server({
                name: 'mcp-typescript test server',
                version: '0.1.0'
            }, {
                capabilities: {}
            });
            servers.push(server);
            server.onclose = () => {
                console.log('SSE connection closed');
                servers = servers.filter(s => s !== server);
            };
            await server.connect(transport);
        });
        app.post('/message', async (req, res) => {
            console.log('Received message');
            const sessionId = req.query.sessionId;
            const transport = servers.map(s => s.transport).find(t => t.sessionId === sessionId);
            if (!transport) {
                res.status(404).send('Session not found');
                return;
            }
            await transport.handlePostMessage(req, res);
        });
        app.listen(port, error => {
            if (error) {
                console.error('Failed to start server:', error);
                process.exit(1);
            }
            console.log(`Server running on http://localhost:${port}/sse`);
        });
    }
    else {
        const server = new index_js_2.Server({
            name: 'mcp-typescript test server',
            version: '0.1.0'
        }, {
            capabilities: {
                prompts: {},
                resources: {},
                tools: {},
                logging: {}
            }
        });
        const transport = new stdio_js_2.StdioServerTransport();
        await server.connect(transport);
        console.log('Server running on stdio');
    }
}
const args = process.argv.slice(2);
const command = args[0];
switch (command) {
    case 'client':
        if (args.length < 2) {
            console.error('Usage: client <server_url_or_command> [args...]');
            process.exit(1);
        }
        runClient(args[1], args.slice(2)).catch(error => {
            console.error(error);
            process.exit(1);
        });
        break;
    case 'server': {
        const port = args[1] ? parseInt(args[1]) : null;
        runServer(port).catch(error => {
            console.error(error);
            process.exit(1);
        });
        break;
    }
    default:
        console.error('Unrecognized command:', command);
}
//# sourceMappingURL=cli.js.map