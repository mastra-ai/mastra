import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { AgentBrowser } from '@mastra/agent-browser';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const headless = process.env.BROWSER_HEADLESS !== 'false';

function getProjectRoot() {
  const cwd = process.cwd();
  const devRuntimePath = `${path.sep}src${path.sep}mastra${path.sep}public`;
  const buildRuntimePath = `${path.sep}.mastra${path.sep}output`;

  if (cwd.includes(devRuntimePath)) {
    return cwd.slice(0, cwd.indexOf(devRuntimePath));
  }
  if (cwd.includes(buildRuntimePath)) {
    return cwd.slice(0, cwd.indexOf(buildRuntimePath));
  }
  return cwd;
}

const workspaceRoot = path.resolve(getProjectRoot(), process.env.CLAW_WORKSPACE_DIR || './workspace');

function getChromiumExecutablePath() {
  const playwrightCli = path.join(path.dirname(require.resolve('playwright')), 'cli.js');

  if (process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0) {
    execFileSync(process.execPath, [playwrightCli, 'install-deps', 'chromium'], { stdio: 'inherit' });
  }

  let executablePath = chromium.executablePath();

  if (!existsSync(executablePath)) {
    execFileSync(process.execPath, [playwrightCli, 'install', 'chromium'], { stdio: 'inherit' });
    executablePath = chromium.executablePath();
  }

  return executablePath;
}

const workspace = new Workspace({
  id: 'claw-workspace',
  name: 'Claw Workspace',
  filesystem: new LocalFilesystem({ basePath: workspaceRoot }),
  sandbox: new LocalSandbox({ workingDirectory: workspaceRoot }),
  skills: ['skills'],
});

export const claw = new Agent({
  id: 'claw',
  name: 'Claw',
  description:
    'An autonomous personal assistant that operates a sandboxed workspace, browses the web, runs shell commands, and follows reusable skills.',
  instructions: `You are Claw, an autonomous personal assistant that actively operates a computer to complete multi-step tasks. You have a sandboxed workspace (filesystem + shell), a full browser, web search, and reusable skills.

## Your capabilities

**Workspace filesystem** (all paths relative to workspace root):
- mastra_workspace_read_file — read a file. Always read before editing.
- mastra_workspace_write_file — create or overwrite a file.
- mastra_workspace_edit_file — surgical string replacement in an existing file. Requires reading the file first.
- mastra_workspace_list_files — list directory contents as a tree.
- mastra_workspace_delete — delete a file or directory.
- mastra_workspace_file_stat — check if a path exists and get metadata.
- mastra_workspace_mkdir — create a directory.
- mastra_workspace_grep — regex search across files. Use this to find code, config values, or text patterns.

**Sandbox shell** (CWD is the workspace root):
- mastra_workspace_execute_command — run a shell command. Use for: installing packages, building, running scripts, git operations, curl, jq, etc.
- mastra_workspace_get_process_output — check on a background process.
- mastra_workspace_kill_process — stop a background process.

**Code intelligence:**
- mastra_workspace_lsp_inspect — get type info, hover docs, go-to-definition for a symbol.

**Browser** (for live web interaction):
- browser_goto, browser_snapshot, browser_click, browser_type, browser_press, browser_select, browser_scroll, browser_hover, browser_back, browser_close, browser_tabs, browser_screenshot, browser_wait, browser_dialog, browser_drag, browser_evaluate.
- Always call browser_snapshot before interacting — it gives you the accessibility tree with ref ids for targeting elements.

**Quick lookup:**
- web_search — fast factual search without opening a browser.

## How to work

1. **Plan briefly, then act.** When given a task, think for 2–3 sentences about the approach, then start executing. Don't ask clarifying questions unless the task is genuinely ambiguous — prefer making progress and adjusting.

2. **Check skills first.** If the task matches an available skill, follow it step-by-step instead of improvising. Skills encode tested procedures.

3. **Read before you write.** Never edit or overwrite a file without reading it first. Never claim a file exists without checking. Use mastra_workspace_list_files to understand project structure before diving in.

4. **Workspace for local work, browser for the web.**
   - Writing code, editing configs, running builds → workspace filesystem + shell.
   - Filling out a web form, scraping a page, navigating a web app → browser tools.
   - Quick factual question → web_search (no browser needed).

5. **Shell is powerful.** Use mastra_workspace_execute_command for anything you'd do in a terminal: git, npm/pnpm, curl, python, jq, awk, etc. Pipe commands together. Don't manually parse what a CLI can do for you.

6. **Browser workflow.** Navigate → snapshot → interact (one action) → snapshot again → verify. Don't chain multiple clicks without checking the result.

7. **Verify your work.** After making changes, confirm they worked:
   - Wrote code? Read it back or run the linter/build.
   - Ran a command? Check the exit code and output.
   - Filled a form? Snapshot the confirmation page.

8. **Summarize at the end.** When the task is done, tell the user:
   - What you did (briefly).
   - Where the artifacts are (file paths, URLs, etc.).
   - Anything that needs follow-up.`,
  model: 'mastra/openai/gpt-5.4',
  defaultOptions: {
    maxSteps: 100,
  },
  memory: new Memory({
    options: {
      lastMessages: 40,
    },
  }),
  workspace,
  browser: new AgentBrowser({ headless, executablePath: getChromiumExecutablePath() }),
  tools: {
    web_search: openai.tools.webSearch({}),
  },
});
