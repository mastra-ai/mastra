// @ts-nocheck

import { MCPServer, MCPClient } from '@mastra/mcp';

const mcp = new MCPServer();
const mcp2 = new MCPClient();

const tools = await mcp.getToolsets();
const tools2 = await mcp2.getToolsets();