import fs from 'node:fs/promises';
import { MCPServer } from '@mastra/mcp';
import { logger, createLogger } from './logger';
import { migrationPromptMessages } from './prompts/migration';
import {
  startMastraCourse,
  getMastraCourseStatus,
  startMastraCourseLesson,
  nextMastraCourseStep,
  clearMastraCourseHistory,
} from './tools/course';
import { docsTool } from './tools/docs';
import { embeddedDocsTools } from './tools/embedded-docs';
import { migrationTool } from './tools/migration';
import { fromPackageRoot } from './utils';

let server: MCPServer;

server = new MCPServer({
  name: 'Mastra Documentation Server',
  version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version,
  tools: {
    mastraDocs: docsTool,
    mastraMigration: migrationTool,
    startMastraCourse,
    getMastraCourseStatus,
    startMastraCourseLesson,
    nextMastraCourseStep,
    clearMastraCourseHistory,
    // Embedded docs tools for reading docs from installed packages
    ...embeddedDocsTools,
  },
  prompts: migrationPromptMessages,
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
