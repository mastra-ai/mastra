"use strict";
// Run with: npx tsx src/examples/server/toolWithSampleServer.ts
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("../../server/mcp.js");
const stdio_js_1 = require("../../server/stdio.js");
const zod_1 = require("zod");
const mcpServer = new mcp_js_1.McpServer({
    name: 'tools-with-sample-server',
    version: '1.0.0'
});
// Tool that uses LLM sampling to summarize any text
mcpServer.registerTool('summarize', {
    description: 'Summarize any text using an LLM',
    inputSchema: {
        text: zod_1.z.string().describe('Text to summarize')
    }
}, async ({ text }) => {
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
    return {
        content: [
            {
                type: 'text',
                text: response.content.type === 'text' ? response.content.text : 'Unable to generate summary'
            }
        ]
    };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await mcpServer.connect(transport);
    console.log('MCP server is running...');
}
main().catch(error => {
    console.error('Server error:', error);
    process.exit(1);
});
//# sourceMappingURL=toolWithSampleServer.js.map