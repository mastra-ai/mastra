/**
 * Dedicated Mastra instance for the workflow-builder CLI demo.
 *
 * Kept separate from the heavy main `examples/agent/src/mastra/index.ts`
 * (auth, observability, MCP, etc.) so the demo boots fast.
 *
 * Registers exactly what the CLI demo needs:
 *  - the workflow-builder-agent (plus its 3 tools)
 *  - the weather-reporter agent + get-weather tool, so the builder has
 *    something real to compose with
 *  - LibSQL storage backed by a temp file (the CLI passes the path in)
 */
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { workflowBuilderAgent } from './agents/workflow-builder-agent';
import { weatherTool } from './tools/weather-tool';
import {
  listAvailableAgentsTool,
  listAvailableToolsTool,
  saveWorkflowTool,
} from './tools/workflow-builder-tools';
import { weatherReporterAgent } from './workflows/weather-report-workflow';

export interface BuildWorkflowBuilderMastraOptions {
  /** libsql file URL — e.g. `file:./wb-demo.db` */
  storageUrl: string;
  /** HTTP port the in-process server will bind to. */
  port: number;
}

export function buildWorkflowBuilderMastra({ storageUrl, port }: BuildWorkflowBuilderMastraOptions): Mastra {
  return new Mastra({
    logger: false,
    server: { port },
    storage: new LibSQLStore({ id: 'workflow-builder-demo', url: storageUrl }),
    agents: {
      'workflow-builder-agent': workflowBuilderAgent,
      'weather-reporter': weatherReporterAgent,
    },
    tools: {
      // Composable building blocks for the demo workflows.
      'get-weather': weatherTool,
      // Workflow-builder server-side tools (these power the chat).
      'list-available-agents': listAvailableAgentsTool,
      'list-available-tools': listAvailableToolsTool,
      'save-workflow': saveWorkflowTool,
    } as any,
  });
}
