import fs from 'node:fs/promises';

import { FastMCP } from 'tylerbarnes-fastmcp-fix';

import { blogTool } from './tools/blog.js';
import { changesTool } from './tools/changes.js';
import { docsTool } from './tools/docs.js';
import { examplesTool } from './tools/examples.js';
import { fromPackageRoot } from './utils.js';

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
