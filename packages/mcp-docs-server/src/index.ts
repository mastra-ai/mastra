import fs from 'node:fs/promises';

import { FastMCP } from 'tylerbarnes-fastmcp-fix';

import { prepare } from './prepare-docs/prepare.js';
import { blogTool } from './tools/blog.js';
import { changesTool } from './tools/changes.js';
import { docsTool } from './tools/docs.js';
import { examplesTool } from './tools/examples.js';
import { fromPackageRoot } from './utils.js';

if (process.env.REBUILD_DOCS_ON_START === 'true') {
  await prepare();
}

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
