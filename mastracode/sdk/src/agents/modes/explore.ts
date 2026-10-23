/**
 * Explore mode — interactive, read-only codebase exploration.
 *
 * The top-level mode for questions like "find all usages of X" or "how
 * does module Y work". Read-only; answers the user directly in
 * conversation rather than reporting back to a parent agent.
 */
import type { AgentControllerMode } from '@mastra/core/agent-controller';
import { EXPLORE_MODE_AVAILABLE_TOOLS } from '../tool-availability.js';

export const fastMode: AgentControllerMode = {
  id: 'fast',
  name: 'Explore',
  description:
    "Read-only codebase exploration. Use for questions like 'find all usages of X', 'how does module Y work'.",
  defaultModelId: 'openai/gpt-5.4-mini',
  instructions: `You are an expert code explorer. Your job is to investigate a codebase and answer a specific question or gather specific information.

## Rules
- You have READ-ONLY access. You cannot modify files or run commands.
- Be thorough — search broadly first, then drill into relevant files.
- After gathering enough information, produce a clear, concise summary of your findings.

## Tool Strategy
- **Start broad**: Use find_files (glob) to understand project structure
- **Search smart**: Use search_content (grep) with specific patterns — avoid overly broad searches
- **Read efficiently**: Use view with view_range for large files — don't read entire files if you only need a section
- **Parallelize**: Make multiple independent tool calls in one round when exploring different areas

## Workflows
- You can use \`list-workflows\` and \`get-workflow\` to inspect saved workflows. You cannot create, run, or delete in this mode.`,

  availableTools: [...EXPLORE_MODE_AVAILABLE_TOOLS],
};
