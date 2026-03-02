/**
 * Mode-specific tool behavioral guidance.
 * Generates tool usage instructions that match the actual registered tool names
 * and are scoped to what's available in the current mode.
 */

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

  if (!denied.has('view')) {
    readTools.push(`
**view** — Read file contents or list directories
- Use this to read files before editing them. NEVER propose changes to code you haven't read.
- Use \`view_range\` for large files to read specific sections.
- For directory listings, this shows 2 levels deep.
- Example: To check lines 50-100 of a large file: \`view("src/big-file.ts", { view_range: [50, 100] })\``);
  }

  if (!denied.has('search_content')) {
    readTools.push(`
**search_content** — Search file contents using regex
- Use this for ALL content search (finding functions, variables, error messages, imports, etc.)
- NEVER use \`execute_command\` with grep, rg, or ag. Always use the search_content tool.
- Supports regex patterns, file type filtering, and context lines.
- Example: Find where a function is defined: \`search_content("function handleSubmit", { glob: "**/*.ts" })\`
- Example: Find all imports of a module: \`search_content("from ['\\"\\]express['\\"\\]", { glob: "**/*.ts" })\``);
  }

  if (!denied.has('find_files')) {
    readTools.push(`
**find_files** — Find files by name pattern
- Use this to find files matching a pattern (e.g., "**/*.ts", "src/**/test*").
- NEVER use \`execute_command\` with find or ls for file search. Always use find_files.
- Respects .gitignore automatically.
- Example: Find all test files: \`find_files("**/*.test.ts")\`
- Example: Find config files: \`find_files("**/config.{js,ts,json}")\``);
  }

  if (!denied.has('execute_command')) {
    readTools.push(`
**execute_command** — Run shell commands
- Use for: git, npm/pnpm, docker, build tools, test runners, and other terminal operations.
- Do NOT use for: file reading (use view), file search (use search_content/find_files), file editing (use string_replace_lsp/write_file).
- Commands have a 30-second default timeout. Use the \`timeout\` parameter for longer-running commands.
- Pipe to \`| tail -N\` for commands with long output — the full output streams to the user, only the last N lines are returned to you. If you're building any kind of package you should be tailing.
- Good: Run independent commands in parallel when possible.
- Bad: Running \`cat file.txt\` — use the view tool instead.`);
  }

  if (readTools.length > 0) {
    sections.push(readTools.join('\n'));
  }

  // --- Write/edit tools (build & fast only) ---

  if (modeId !== 'plan') {
    const writeTools: string[] = [];

    if (!denied.has('string_replace_lsp')) {
      writeTools.push(`
**string_replace_lsp** — Edit files by replacing exact text
- You MUST read a file with \`view\` before editing it.
- \`old_str\` must be an exact match of existing text in the file.
- Provide enough surrounding context in \`old_str\` to make it unique.
- For creating new files, use \`write_file\` instead.
- Good: Include 2-3 lines of surrounding context to ensure uniqueness.
- Bad: Using just \`return true;\` — too common, will match multiple places.`);
    }

    if (!denied.has('write_file')) {
      writeTools.push(`
**write_file** — Create new files or overwrite existing ones
- Use this to create new files.
- If overwriting an existing file, you MUST have read it first with \`view\`.
- NEVER create files unless necessary. Prefer editing existing files.`);
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
