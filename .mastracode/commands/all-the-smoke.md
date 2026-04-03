# All The Smoke - Automated Studio Smoke Testing

You are an automated smoke tester for Mastra Studio. Your job is to use **Playwright headless browser** automation to navigate the studio, interact with UI elements, and verify that everything works correctly - just like a QA engineer would, but faster and more thorough.

## Step 1: Determine Test Target

Ask the user:

1. **Is a dev server already running?** If yes, ask for the URL (default: `http://localhost:4111`). If no, offer to set one up using the `/smoke-test` skill first.
2. **Which domains do you want to smoke test?**

Read all `.md` files from `.mastracode/smoke-domains/` (excluding `README.md`) to discover available domains. Present them as a numbered list:

```
Available smoke test domains:

  [0] ALL - Run every domain
  [1] agents - Agent listing, detail views, and chat
  [2] networks - Agent network mode coordination
  [3] tools - Tool listing and execution
  [4] workflows - Workflow listing, graph view, and execution
  [5] observability - Traces and timeline views
  [6] scorers - Scorer listing and detail views
  [7] navigation - Home page, routing, and general navigation
  [8] settings - Settings page
  [9] extras - Templates, processors, MCP servers, request context
  ... (any additional domains added by engineers)

Which domains? (comma-separated numbers, or 0 for all):
```

The list should be dynamically generated from whatever `.md` files exist in the `smoke-domains/` folder. Each file's YAML frontmatter `name` and `description` fields determine the display name and summary.

## Step 2: Load Domain Instructions

For each selected domain, read its corresponding `.md` file from `.mastracode/smoke-domains/`. Each file contains:
- The routes to visit
- Step-by-step interaction instructions
- Expected behaviors to verify
- Known issues to watch for

## Step 3: Execute Tests with Playwright

### Setup

Use the persistent Playwright harness in `.mastracode/smoke-runner/`.

Install Playwright there once and reuse it across runs:

```sh
cd .mastracode/smoke-runner
npm install
npx playwright install chromium
```

Create each fresh `create-mastra` test app under:

```sh
.mastracode/tmp-smoke/runs/<run-id>/app
```

Store per-run screenshots under:

```sh
.mastracode/tmp-smoke/runs/<run-id>/screenshots
```

### Writing the Test Script

Reuse the persistent `smoke-test.mjs` script from `.mastracode/smoke-runner/` and pass it the base URL, selected domains, and screenshot directory for the current run.

The reusable script should:

1. Launches a **headless Chromium** browser via Playwright
2. Creates a page with a `1440x900` viewport
3. Listens for browser console errors

**Critical: Wait strategy** — Do NOT use `waitUntil: 'networkidle'` for Mastra Studio pages. The studio maintains persistent WebSocket/SSE connections that prevent `networkidle` from resolving. Instead use:

```js
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000); // Allow hydration
```

For each selected domain, the script should:

1. **Navigate** to each route using `domcontentloaded` wait strategy
2. **Find elements** using cascading selectors (try specific selectors first, fall back to generic):
   - `textarea` → `input[type="text"]` → `[contenteditable="true"]`
   - `button[type="submit"]` → `button:has-text("Submit")` → `button:has-text("Run")`
3. **Interact** with UI elements (click, fill, submit)
4. **Poll for responses** instead of waiting for specific selectors — the studio's DOM structure may vary:
   ```js
   for (let i = 0; i < maxRetries; i++) {
     await page.waitForTimeout(5000);
     const content = await page.content();
     if (content.includes(expectedText)) break;
   }
   ```
5. **Screenshot** at each major checkpoint to the per-run screenshots directory, e.g. `.mastracode/tmp-smoke/runs/<run-id>/screenshots/`
6. **Record** pass/fail for each test item
7. **Continue on failure** — catch errors per-test, don't let one failure abort the run

### Execution

Prefer the automated orchestrator, which creates a fresh app, wires in the network fixtures, starts the dev server, runs the reusable Playwright harness, opens the screenshots in Finder, and then deletes only the generated app on success:

```sh
cd .mastracode/smoke-runner && \
SMOKE_AUTOMATION_CONFIG='{"domains":["agents","networks"],"provider":"openai","packageManager":"npm","tag":"latest","openScreenshots":true}' \
node run-smoke.mjs
```

The lower-level harness remains available when you already have a running target app:

```sh
cd .mastracode/smoke-runner && \
SMOKE_RUN_CONFIG='{"baseUrl":"<url>","domains":["agents"],"screenshotDir":"../tmp-smoke/runs/<run-id>/screenshots"}' \
node smoke-test.mjs
```

Use a long timeout (up to 10 minutes) since agent chat responses can take up to 90 seconds.

### Key Routes and IDs

These are the typical IDs from a `create-mastra` project with `-e` (examples):

| Resource | Route | Notes |
|----------|-------|-------|
| Agent listing | `/agents` | |
| Agent chat | `/agents/weather-agent/chat` | May redirect to `/chat/new` |
| Tool listing | `/tools` | |
| Tool detail | `/tools/get-weather` | Tool ID is `get-weather`, not `weatherTool` |
| Workflow listing | `/workflows` | |
| Workflow detail | `/workflows/weatherWorkflow` | |
| Scorers | `/scorers` | |
| Settings | `/settings` | |
| Traces | `/traces` | Under observability |

## Step 4: Report Results

After all tests complete, provide a structured report:

```
## Smoke Test Report

**Target**: <URL>
**Date**: <date>
**Domains tested**: <list>

### Results Summary
| Domain | Tests | Passed | Failed | Skipped |
|--------|-------|--------|--------|---------|
| ...    | ...   | ...    | ...    | ...     |

### Failures (if any)
For each failure:
- **Domain**: <domain>
- **Test**: <what was being tested>
- **Expected**: <what should have happened>
- **Actual**: <what actually happened>
- **Screenshot**: <reference>

### Flaky Tests (if any)
- ...

### Notes
- ...
```

After displaying the report, **read the key screenshots** (agent listing, chat response, tool execution, workflow execution) to visually verify results.

## Step 5: Cleanup

If all tests passed:

1. **Open the per-run screenshots directory in Finder** so the results are easy to review immediately
2. **Kill the generated app's dev server**
3. **Delete only the generated `create-mastra` app directory**: `rm -rf .mastracode/tmp-smoke/runs/<run-id>/app`
4. **Keep** the per-run screenshots unless the user asks to remove them
5. **Do not delete** `.mastracode/smoke-runner/`, its `package.json`, or its Playwright installation
6. **Confirm cleanup** to the user

If any tests failed, **leave the generated app and per-run artifacts in place** for debugging, and still open the screenshots directory in Finder.

## Adding New Domains

Engineers can add new smoke test domains by creating a `.md` file in `.mastracode/smoke-domains/`. See `.mastracode/smoke-domains/README.md` for the template and guidelines.
