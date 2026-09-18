import { MCPServer } from '@mastra/mcp';
import { calculatorTool } from '@/tools/calculator-tool';

export const calculatorMcpServer = new MCPServer({
  id: 'calculator',
  name: 'Calculator',
  version: '1.0.0',
  tools: { calculatorTool },
});
