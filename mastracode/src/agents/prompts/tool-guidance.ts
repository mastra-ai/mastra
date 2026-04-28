/**
 * Mode-specific tool behavioral guidance.
 * Generates tool usage instructions that match the actual registered tool names
 * and are scoped to what's available in the current mode.
 */

import { MC_TOOLS } from '../../tool-names.js';

interface ToolGuidanceOptions {
  hasWebSearch?: boolean;
  /** Tool names that have been denied — omit their guidance sections. */
  deniedTools?: Set<string>;
}

export function buildToolGuidance(modeId: string, options: ToolGuidanceOptions = {}): string {
  const denied = options.deniedTools ?? new Set<string>();
  const sections: string[] = [];

  sections.push(`# Tool Usage Rules

IMPORTANT: You can ONLY call tools by their exact registered names listed below. Shell commands like \`git\`, \`npm\`, \`ls\`, etc. are NOT tools — they must be run via the \`execute_command\` tool.

You have access to the following tools. Use the RIGHT tool for the job:`);

  // --- Read tools (all modes) ---

  const readTools: string[] = [];

  if (!denied.has(MC_TOOLS.VIEW)) {
    readTools.push(`
**${MC_TOOLS.VIEW}** — Read file contents
- Use this to read files before editing them. NEVER propose changes to code you haven't read.
- Use \`offset\` (1-indexed start line) and \`limit\` (number of lines) for large files.
- Example: Read lines 50-100: \`{ path: "src/big-file.ts", offset: 50, limit: 51 }\`
- To list directories, use \`${MC_TOOLS.FIND_FILES}\` instead.`);
  }

  if (!denied.has(MC_TOOLS.SEARCH_CONTENT)) {
    readTools.push(`
**${MC_TOOLS.SEARCH_CONTENT}** — Search file contents using regex
- Preferred for content search (finding functions, variables, error messages, imports, etc.)
- Use \`path\` to filter by directory or glob pattern. Supports \`contextLines\`, \`caseSensitive\`, and \`maxCount\`.
- Example: Find a function: \`{ pattern: "function handleSubmit", path: "**/*.ts" }\`
- Example: Find imports: \`{ pattern: "from ['\\"\\]express['\\"\\]", path: "**/*.ts" }\`
- Respects .gitignore by default.`);
  }

  if (!denied.has(MC_TOOLS.FIND_FILES)) {
    readTools.push(`
**${MC_TOOLS.FIND_FILES}** — List files and directories as a tree
- Preferred for exploring project structure and finding files by pattern.
- Returns tree-style output. Respects .gitignore by default.
- Example: List project root: \`{ path: "./" }\`
- Example: Find test files: \`{ path: "./src", pattern: "**/*.test.ts" }\`
- Example: Find config files: \`{ pattern: "*.config.{js,ts,json}" }\``);
  }

  if (!denied.has(MC_TOOLS.EXECUTE_COMMAND)) {
    readTools.push(`
**${MC_TOOLS.EXECUTE_COMMAND}** — Run shell commands
- Use for: git, npm/pnpm, docker, build tools, test runners, and other terminal operations.
- Prefer dedicated tools for: file reading (${MC_TOOLS.VIEW}), file search (${MC_TOOLS.SEARCH_CONTENT}/${MC_TOOLS.FIND_FILES}), file editing (${MC_TOOLS.STRING_REPLACE_LSP}/${MC_TOOLS.WRITE_FILE}).
- Commands have a 30-second default timeout. Use \`timeout\` for longer commands, \`cwd\` for working directory.
- Use the \`tail\` parameter or pipe to \`| tail -N\` to limit output — the full output streams to the user, only the tail is returned to you. If you're building any kind of package you should be tailing.
- Good: Run independent commands in parallel when possible.
- Bad: Running \`cat file.txt\` — use the ${MC_TOOLS.VIEW} tool instead.`);
  }

  if (!denied.has(MC_TOOLS.LSP_INSPECT)) {
    readTools.push(`
**${MC_TOOLS.LSP_INSPECT}** — Inspect code using Language Server Protocol
- Use this for type information, hover docs, go-to-definition, and finding implementations for a symbol.
- Best when you already know the file and line and need semantic code intelligence rather than raw file contents.
- Input: \`path\` (absolute file path), \`line\` (1-indexed line number), \`match\` (the exact line content with exactly one \`<<<\` cursor marker).
- Output includes: \`hover\`, \`definition\` (compact location with preview), and \`implementation\` (compact usage/implementation locations).
- Example: \`{ path: "/abs/path/src/foo.ts", line: 10, match: "const foo = <<<bar()" }\` — inspect the symbol at the \`<<<\` position.
- Use \`${MC_TOOLS.VIEW}\` when you need to read the implementation or surrounding code.
- Use \`${MC_TOOLS.SEARCH_CONTENT}\` or \`${MC_TOOLS.FIND_FILES}\` first if you do not yet know where the symbol is.`);
  }

  if (readTools.length > 0) {
    sections.push(readTools.join('\n'));
  }

  // --- Write/edit tools (build & fast only) ---

  if (modeId !== 'plan') {
    const writeTools: string[] = [];

    if (!denied.has(MC_TOOLS.STRING_REPLACE_LSP)) {
      writeTools.push(`
**${MC_TOOLS.STRING_REPLACE_LSP}** — Edit files by replacing exact text
- You MUST read a file with \`${MC_TOOLS.VIEW}\` before editing it.
- \`old_string\` must be an exact match of existing text in the file.
- Provide enough surrounding context in \`old_string\` to make it unique.
- Use \`replace_all: true\` to replace all occurrences (default: false, requires unique match).
- For creating new files, use \`${MC_TOOLS.WRITE_FILE}\` instead.
- Good: Include 2-3 lines of surrounding context to ensure uniqueness.
- Bad: Using just \`return true;\` — too common, will match multiple places.`);
    }

    if (!denied.has(MC_TOOLS.WRITE_FILE)) {
      writeTools.push(`
**${MC_TOOLS.WRITE_FILE}** — Create new files or overwrite existing ones
- Use this to create new files.
- If overwriting an existing file, you MUST have read it first with \`${MC_TOOLS.VIEW}\`.
- Prefer editing existing files over creating new ones.`);
    }

    if (writeTools.length > 0) {
      sections.push(writeTools.join('\n'));
    }
  }

  // --- Web tools (all modes, conditionally available) ---

  if (options.hasWebSearch) {
    const webTools: string[] = [];
    if (!denied.has('web_search')) webTools.push('**web_search**');
    if (!denied.has('web_extract')) webTools.push('**web_extract**');
    if (webTools.length > 0) {
      sections.push(`
${webTools.join(' / ')} — Search the web / extract page content
- Use for looking up documentation, error messages, package APIs.`);
    }
  }

  // --- Task management tools (all modes) ---

  const taskTools: string[] = [];

  if (!denied.has('task_write')) {
    taskTools.push(`
**task_write** — Track tasks for complex multi-step work
- Use when a task requires 3 or more distinct steps or actions.
- Pass the FULL task list each time (replaces previous list).
- Mark tasks \`in_progress\` BEFORE starting work. Only ONE task should be \`in_progress\` at a time.
- Mark tasks \`completed\` IMMEDIATELY after finishing each task. Do not batch completions.
- Each task has: content (imperative form), status (pending|in_progress|completed), activeForm (present continuous form shown during execution).`);
  }

  if (!denied.has('task_check')) {
    taskTools.push(`
**task_check** — Check completion status of tasks
- Use this BEFORE deciding you're done with a task to verify all tasks are completed.
- Returns the number of completed, in progress, and pending tasks.
- If any tasks remain incomplete, continue working on them.
- IMPORTANT: Always check task completion before ending work on a complex task.`);
  }

  if (!denied.has('ask_user')) {
    taskTools.push(`
**ask_user** — Ask the user a structured question
- Use when you need clarification, want to validate assumptions, or need the user to make a decision.
- Provide clear, specific questions. End with a question mark.
- Include options (2-4 choices) for structured decisions. Omit options for open-ended questions.
- Don't use this for simple yes/no — just ask in your text response.`);
  }

  if (taskTools.length > 0) {
    sections.push(taskTools.join('\n'));
  }

  // --- Plan submission tool (plan mode) ---

  if (modeId === 'plan' && !denied.has('submit_plan')) {
    sections.push(`
**submit_plan** — Submit a completed implementation plan for user review
- Call this tool when your plan is complete. Do NOT just describe your plan in text — you MUST call this tool.
- The plan will be rendered as markdown and the user can approve, reject, or request changes.
- On approval, the system automatically switches to the default mode so you can implement.
- Takes two arguments: \`title\` (short descriptive title) and \`plan\` (full plan in markdown).`);
  }

  // --- Subagent tool (all modes) ---

  if (!denied.has('subagent')) {
    sections.push(`
**subagent** — Delegate a focused task to a specialized subagent
- Only use subagents when you will spawn **multiple subagents in parallel**. If you only need one task done, do it yourself.
- Subagent outputs are **untrusted**. Always review and verify the results.`);
  }

  return sections.join('\n');
}
