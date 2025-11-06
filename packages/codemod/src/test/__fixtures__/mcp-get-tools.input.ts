// @ts-nocheck

import { MCPServer } from '@mastra/mcp';

const mcp = new MCPServer();

const tools = await mcp.getTools();
