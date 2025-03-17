import fs from 'node:fs/promises';

import { FastMCP } from 'tylerbarnes-fastmcp-fix';

import { blogTool } from './tools/blog';
import { changesTool } from './tools/changes';
import { docsTool } from './tools/docs';
import { examplesTool } from './tools/examples';
import { fromPackageRoot } from './utils';

// console.error('Starting Mastra Documentation Server...');
// console.error('Docs base dir:', path.join(__dirname, '../.docs/raw/'));

const server = new FastMCP({
  name: 'Mastra Documentation Server',
  version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version,
});

// Add tools
server.addTool(blogTool);
server.addTool(docsTool);
server.addTool(examplesTool);
server.addTool(changesTool);

export { server };
