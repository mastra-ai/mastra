import { FastMCP } from 'tylerbarnes-fastmcp-fix';
import { blogTool } from './tools/blog';
import { changesTool } from './tools/changes';
import { docsTool } from './tools/docs';
import { examplesTool } from './tools/examples';

// console.error('Starting Mastra Documentation Server...');
// console.error('Docs base dir:', path.join(__dirname, '../.docs/raw/'));

const server = new FastMCP({
  name: 'Mastra Documentation Server',
  version: '0.0.1',
});

// Add tools
server.addTool(blogTool);
server.addTool(docsTool);
server.addTool(examplesTool);
server.addTool(changesTool);

export { server };
