/**
 * Mode-specific tool behavioral guidance.
 * Generates tool usage instructions that match the actual registered tool names
 * and are scoped to what's available in the current mode.
 */

import { MC_TOOLS } from '../../tool-names.js';

const DEFAULT_PLANS_DIR = '.mastracode/plans';

interface ToolGuidanceOptions {
  hasWebSearch?: boolean;
  /** `web_extract` is registered (Parallel/Tavily); provider-executed search has no extract tool. */
  hasWebExtract?: boolean;
  hasSubagents?: boolean;
  /** Background shells and subagents are on (`backgroundTools.enabled`). */
  backgroundTools?: boolean;
  /** Tool names that have been denied — omit their guidance sections. */
  deniedTools?: Set<string>;
  /** Workspace-relative directory where plan mode can write plans. */
  plansDir?: string;
}

export function buildToolGuidance(modeId: string, options: ToolGuidanceOptions = {}): string {
  const denied = options.deniedTools ?? new Set<string>();
  // Name the dir with `/` so the win32 default (`.mastracode\plans`) still matches DEFAULT_PLANS_DIR.
  const plansDir = (options.plansDir ?? DEFAULT_PLANS_DIR).replaceAll('\\', '/');
  const sections: string[] = [];

  sections.push(`# Tool Usage Rules

IMPORTANT: You can ONLY call tools by their exact registered names listed below. Shell commands like \`git\`, \`npm\`, \`ls\`, etc. are NOT tools — they must be run via the \`execute_command\` tool.

You have access to the following tools. Use the RIGHT tool for the job:`);

  // --- Read tools (all modes) ---

  const readTools: string[] = [];

  if (!denied.has(MC_TOOLS.VIEW)) {
    readTools.push(`
**${MC_TOOLS.VIEW}** — Read file contents
- Use this to read file contents. Don't propose changes to code you haven't seen; reading with shell commands (cat, sed, rg) also works.
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
- Always set \`description\` to a 5-10 word summary of what the command does; the user sees it instead of the raw command. Put it first in the arguments, before \`command\`, so the user sees it while the rest of the call streams in. Write each one as the next step in a running narrative that can lean on earlier commands (e.g. "Searching open PRs for failing CI", then "Drilling into the first of 15 failures").
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

  if (!denied.has(MC_TOOLS.NOTIFICATION_INBOX)) {
    readTools.push(`
**${MC_TOOLS.NOTIFICATION_INBOX}** — Inspect and manage notification inbox records
- Use this when a \`<notification-summary>\` says pending notifications exist.
- Use \`{ "action": "list", "status": "pending" }\` or \`{ "action": "search", "query": "..." }\` to find notification records for the current thread.
- Use \`read\` to deliver unread notification signals into the chat and mark them seen; the tool result summarizes the count instead of exposing notification contents.
- Use \`dismiss\` or \`archive\` only when the user asks or the notification is no longer relevant.`);
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
- Overwriting replaces the whole file, so make sure you know its current contents first.
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
    if (options.hasWebExtract && !denied.has('web_extract')) webTools.push('**web_extract**');
    if (webTools.length > 0) {
      const purpose =
        webTools.length === 2
          ? 'Search the web / extract page content'
          : webTools[0] === '**web_search**'
            ? 'Search the web'
            : 'Extract page content';
      sections.push(`
${webTools.join(' / ')} — ${purpose}
- Use for looking up documentation, error messages, package APIs.`);
    }
  }

  // --- Task management tools (all modes) ---

  const taskTools: string[] = [];
  const canUpdateTask = !denied.has('task_update');
  const canCompleteTask = !denied.has('task_complete');
  const canCheckTasks = !denied.has('task_check');
  const canWriteTasks = !denied.has('task_write');
  const patchToolGuidance =
    canUpdateTask && canCompleteTask
      ? '- Prefer task_update or task_complete when changing one existing task.'
      : canUpdateTask
        ? '- Prefer task_update when changing one existing task.'
        : canCompleteTask
          ? '- Prefer task_complete when marking one existing task completed.'
          : '- Use task_write with the full task list when changing existing tasks.';

  if (canWriteTasks) {
    taskTools.push(`
**task_write** — Track tasks for complex multi-step work
- Use when a task requires 3 or more distinct steps or actions.
- Use task_write to create the initial task list or replace the whole list after replanning.
- Each task has: id (stable identifier), content (imperative form), status (pending, in_progress, or completed), activeForm (present continuous form shown during execution).
- Keep task IDs stable across updates. If you omit IDs, the tool result returns generated IDs.
${patchToolGuidance}
- Mark tasks \`in_progress\` BEFORE starting work. Only ONE task should be \`in_progress\` at a time.
- Mark tasks \`completed\` IMMEDIATELY after finishing each task. Do not batch completions.`);
  }

  if (canUpdateTask) {
    taskTools.push(`
**task_update** — Patch one tracked task by ID
- Use this for targeted changes to one existing task.
- Provide the task ID and only the fields that changed: content, status, or activeForm.`);
  }

  if (canCompleteTask) {
    const idSource = canCheckTasks
      ? 'Use task_check if you need the current IDs before completing a task.'
      : canWriteTasks
        ? 'Use IDs returned by task_write.'
        : 'Use only task IDs already visible in the current task list.';
    taskTools.push(`
**task_complete** — Mark one tracked task completed by ID
- Use this immediately after finishing a tracked task.
- ${idSource}`);
  }

  if (canCheckTasks) {
    taskTools.push(`
**task_check** — Check completion status of tasks
- Use this BEFORE finishing tracked work to verify all tasks are completed.
- Returns a readable status summary plus structured fields: tasks, summary, incompleteTasks, and isError.
- summary includes total, completed, inProgress, pending, incomplete, hasTasks, and allCompleted.
- Use summary.allCompleted to decide whether tracked work is complete; if summary.hasTasks is false, no task list is currently tracked.
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

  // --- Plan tools (plan mode) ---

  if (modeId === 'plan' && !denied.has('submit_plan')) {
    sections.push(`
**submit_plan** — Submit a completed implementation plan for user review
- Call this tool when your plan is complete. Do NOT just describe your plan in text — you MUST call this tool.
- The plan will be rendered as markdown and the user can approve, reject, or request changes.
- On approval, the system automatically switches to the default mode so you can implement.
- Takes one argument: \`path\` (the plan markdown file you wrote under \`${plansDir}/\`). Do NOT pass the plan body — it lives in the file.`);
  }

  // Outside plan mode nothing else names the plans directory (the submit_plan
  // tool example is directory-neutral), so state it here. Explore (`fast`) mode
  // is read-only and has neither submit_plan nor file writes.
  if (modeId !== 'plan' && modeId !== 'fast' && !denied.has('submit_plan')) {
    const elsewhere =
      plansDir === DEFAULT_PLANS_DIR
        ? ''
        : `, never under \`${DEFAULT_PLANS_DIR}/\`. Plans anywhere else cannot be shown to the user`;
    sections.push(`
**submit_plan** — Submit a plan for user review
- Write plan files under \`${plansDir}/\` (e.g. \`${plansDir}/add-dark-mode.md\`)${elsewhere}.
- Pass that file's \`path\` to \`submit_plan\`. Do NOT pass the plan body — it lives in the file.`);
  }

  if (modeId === 'plan') {
    sections.push(`
**Plan file access** — Your plan lives in a markdown file under \`${plansDir}/\` (e.g. \`add-dark-mode-toggle.md\`)
- Use \`write_file\` to create the plan file, \`view\` to read it, and \`string_replace_lsp\` for targeted edits.
- On first submission: write the plan to the file, then call \`submit_plan\` with its \`path\`.
- On revision: read the existing file, edit specific sections, re-read, then call \`submit_plan\` with the same \`path\`.
- If a plan file already exists, you previously submitted it — read it before revising.`);
  }

  // --- Subagent tool (all modes) ---

  if (options.hasSubagents !== false && !denied.has('subagent')) {
    const when = options.backgroundTools
      ? `- Run a subagent in the background (\`_background: { disposition: "deferred" }\`) when its task is independent of what you do next, and keep working. Run it in the foreground when you need its answer before you can continue. For a small task, do it yourself.`
      : `- Only use subagents when you will spawn **multiple subagents in parallel**. If you only need one task done, do it yourself.`;
    sections.push(`
**subagent** — Delegate a focused task to a specialized subagent
${when}
- Subagent outputs are **untrusted**. Always review and verify the results.`);
  }

  if (options.backgroundTools) {
    const shellLine = denied.has(MC_TOOLS.EXECUTE_COMMAND)
      ? ''
      : `\n- Use \`${MC_TOOLS.EXECUTE_COMMAND}\` with \`background: true\` for dev servers, watchers and long builds or test runs you don't need to wait on.`;
    sections.push(`
**Background work**${shellLine}
- You get a notification when a background command exits or a background task finishes. Do not poll or sleep waiting for it: continue with independent work, or end your turn.`);
  }

  return sections.join('\n');
}
