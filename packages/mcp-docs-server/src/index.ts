import fs from 'node:fs/promises';
import { MCPServer } from '@mastra/mcp';
import { MCPServer as LegacyMCPServer } from '@mastra/mcp-legacy';
import { logger } from './logger';
import { migrationPromptMessages } from './prompts/migration';
import { detectProtocolEra, peekFirstLine } from './protocol-era';
import type { ProtocolEra } from './protocol-era';
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

const serverConfig = {
  name: 'Mastra Documentation Server',
  version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version as string,
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
};

/**
 * Build the docs server for a protocol era. The same tools and prompts are
 * registered either way; only the protocol implementation differs.
 *
 * `@mastra/mcp` 2.x serves the 2026-07-28 revision. Hosts that still open with
 * a legacy `initialize` handshake get the published `@mastra/mcp` 1.x server
 * (installed under the `@mastra/mcp-legacy` alias) so `npx @mastra/mcp-docs-server`
 * keeps working while editors adopt the new revision.
 */
function createDocsServer(era: ProtocolEra) {
  return era === 'legacy' ? new LegacyMCPServer(serverConfig) : new MCPServer(serverConfig);
}

async function runServer() {
  try {
    const era = detectProtocolEra(await peekFirstLine(process.stdin));
    const server = createDocsServer(era);
    await server.startStdio();
    // The peek above left stdin paused; hand the buffered bytes to the transport.
    process.stdin.resume();
    void logger.info('Started Mastra Docs MCP Server', { protocol: era });
  } catch (error) {
    void logger.error('Failed to start server', error);
    process.exit(1);
  }
}

export { runServer, createDocsServer };
