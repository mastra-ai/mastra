import fs from 'node:fs/promises';
import { MCPServer } from '@mastra/mcp';

import { logger, createLogger } from './logger';
import { prepare } from './prepare-docs/prepare';
import { blogTool } from './tools/blog';
import { changesTool } from './tools/changes';
import {
  startMastraCourse,
  getMastraCourseStatus,
  startMastraCourseLesson,
  nextMastraCourseStep,
  clearMastraCourseHistory,
} from './tools/course';
import { docsTool } from './tools/docs';
import { examplesTool } from './tools/examples';
import { fromPackageRoot } from './utils';

let server: MCPServer;

if (process.env.REBUILD_DOCS_ON_START === 'true') {
  void logger.info('Rebuilding docs on start');
  try {
    await prepare();
    void logger.info('Docs rebuilt successfully');
  } catch (error) {
    void logger.error('Failed to rebuild docs', error);
  }
}

server = new MCPServer({
  name: 'Mastra Documentation Server',
  version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version,
  tools: {
    mastraBlog: blogTool,
    mastraDocs: docsTool,
    mastraExamples: examplesTool,
    mastraChanges: changesTool,
    startMastraCourse,
    getMastraCourseStatus,
    startMastraCourseLesson,
    nextMastraCourseStep,
    clearMastraCourseHistory,
  },
});

// Update logger with server instance
Object.assign(logger, createLogger(server));

async function runServer() {
  try {
    await server.startStdio();
    void logger.info('Started Mastra Docs MCP Server');
  } catch (error) {
    void logger.error('Failed to start server', error);
    process.exit(1);
  }
}

export { runServer, server };
