/**
 * Subagent registry — maps subagent IDs to their definitions.
 */
import { taskCheckTool, taskWriteTool } from '@mastra/core/harness';
import {
  createViewTool,
  createExecuteCommandTool,
  createGrepTool,
  createGlobTool,
  createWriteFileTool,
  createSubagentTool,
  createStringReplaceLspTool,
} from '../../tools/index.js';
import { resolveModel } from '../model.js';
import { auditTestsSubagent } from './audit-tests.js';
import { executeSubagent } from './execute.js';
import { exploreSubagent } from './explore.js';
import { planSubagent } from './plan.js';
import type { SubagentDefinition } from './types.js';

/** All registered subagent definitions, keyed by ID. */
const subagentRegistry: Record<string, SubagentDefinition> = {
  explore: exploreSubagent,
  plan: planSubagent,
  execute: executeSubagent,
  'audit-tests': auditTestsSubagent,
};

/**
 * Look up a subagent definition by ID.
 * Returns undefined if not found.
 */
export function getSubagentDefinition(id: string): SubagentDefinition | undefined {
  return subagentRegistry[id];
}

/**
 * Get all registered subagent IDs (for tool description / validation).
 */
export function getSubagentIds(): string[] {
  return Object.keys(subagentRegistry);
}

export function getSubagentTools(projectPath: string) {
  // Create tools with project root
  const viewTool = createViewTool(projectPath);
  const executeCommandTool = createExecuteCommandTool(projectPath);
  const grepTool = createGrepTool(projectPath);
  const globTool = createGlobTool(projectPath);
  const writeFileTool = createWriteFileTool(projectPath);
  const stringReplaceLspTool = createStringReplaceLspTool(projectPath);

  // The subagent tool needs tools and resolveModel to spawn subagents.
  // We pass all tools that subagents might need based on their type.
  const subagentTool = createSubagentTool({
    tools: {
      // Read-only tools (for explore, plan)
      view: viewTool,
      search_content: grepTool,
      find_files: globTool,
      // Write tools (for execute)
      string_replace_lsp: stringReplaceLspTool,
      write_file: writeFileTool,
      execute_command: executeCommandTool,
      // Task tracking (for execute)
      task_write: taskWriteTool,
      task_check: taskCheckTool,
    },
    resolveModel,
  });

  // Read-only subagent tool for plan mode — no execute type allowed
  const subagentToolReadOnly = createSubagentTool({
    tools: {
      view: viewTool,
      search_content: grepTool,
      find_files: globTool,
    },
    resolveModel,
    allowedAgentTypes: ['explore', 'plan'],
  });

  return {
    tool: subagentTool,
    toolReadOnly: subagentToolReadOnly,
  };
}
