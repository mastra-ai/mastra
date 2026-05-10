# `brightdata-agent-test` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone TypeScript CLI at `/home/meirk/brightdata-agent-test/` that wires a Mastra agent backed by an OpenRouter model to the `@mastra/brightdata` `web-search` and `web-fetch` tools, prints each tool call with truncated args/results, and prints the final answer.

**Architecture:** Single-file `index.ts` runs through `tsx`. Reads `OPENROUTER_API_KEY`, `BRIGHTDATA_API_TOKEN`, and the user query (CLI arg). Constructs an `Agent` with `model: 'openrouter/<model-id>'` (Mastra's built-in OpenRouter registry; no extra provider package needed) and `tools: createBrightDataTools()`. Calls `agent.stream(query)` and iterates `stream.fullStream`, printing `tool-call` and `tool-result` chunk types live, then prints accumulated `text-delta` text as the final answer.

**Tech Stack:** `@mastra/core` 1.27.x, `@mastra/brightdata` (linked via `file:`), `tsx`, plain Node + TypeScript. No bundler, no test runner — this is a manual smoke test.

**Spec:** [docs/superpowers/specs/2026-05-10-brightdata-agent-test-design.md](../specs/2026-05-10-brightdata-agent-test-design.md)

**Important spec deviation:** The spec proposed `@openrouter/ai-sdk-provider`. Investigation showed Mastra's built-in OpenRouter provider via the `'openrouter/...'` model-id string works directly and reads `OPENROUTER_API_KEY` from env. We use the string form — fewer deps, less code, identical capability. This is reflected in every task below.

---

## File Structure

All files are under `/home/meirk/brightdata-agent-test/` (a NEW directory outside the mastra repo):

| File            | Responsibility                                                             |
| --------------- | -------------------------------------------------------------------------- |
| `package.json`  | Deps: `@mastra/core`, `@mastra/brightdata` (file:), `tsx`. `start` script. |
| `tsconfig.json` | ES2022 + nodenext, strict, esModuleInterop                                 |
| `index.ts`      | Entire CLI: arg parsing, env validation, agent build, stream loop, output  |
| `README.md`     | One paragraph + run command                                                |
| `.gitignore`    | `node_modules`, `*.log`                                                    |

---

## Task 1: Scaffold the project directory and configs

**Files:**

- Create: `/home/meirk/brightdata-agent-test/package.json`
- Create: `/home/meirk/brightdata-agent-test/tsconfig.json`
- Create: `/home/meirk/brightdata-agent-test/.gitignore`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /home/meirk/brightdata-agent-test
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "brightdata-agent-test",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx index.ts"
  },
  "dependencies": {
    "@mastra/brightdata": "file:../BrightAI/mastra/integrations/brightdata",
    "@mastra/core": "^1.27.0",
    "tsx": "^4.20.0",
    "typescript": "^5.6.0"
  }
}
```

Note: `@brightdata/sdk` is pulled in transitively from `@mastra/brightdata`. There is no separate OpenRouter provider package — Mastra's built-in registry handles the `'openrouter/...'` model id and reads `OPENROUTER_API_KEY` from env automatically.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
*.log
.env
.DS_Store
```

- [ ] **Step 5: Verify the integration's dist exists**

The `file:` link points at the integration's `package.json` which references `./dist/`. If `dist/` is empty, `pnpm install` will succeed but runtime imports will fail.

Run: `ls /home/meirk/BrightAI/mastra/integrations/brightdata/dist/index.js`

Expected: file exists. If it doesn't, run `pnpm --filter ./integrations/brightdata build:lib` from `/home/meirk/BrightAI/mastra` first.

- [ ] **Step 6: Install dependencies**

Run from `/home/meirk/brightdata-agent-test`:

```bash
cd /home/meirk/brightdata-agent-test && npm install
```

Expected: `node_modules/` populated. `node_modules/@mastra/brightdata/dist/index.js` exists. `node_modules/@mastra/core/` exists. Some peer-dep warnings (about `zod` versions, etc.) are normal and OK.

We use `npm` rather than `pnpm` here because this directory is not part of any pnpm workspace — npm just resolves the local `file:` and registry deps cleanly without trying to attach to the mastra monorepo.

- [ ] **Step 7: Smoke-check imports resolve**

Run from `/home/meirk/brightdata-agent-test`:

```bash
node -e "import('@mastra/brightdata').then(m => console.log(Object.keys(m)))"
```

Expected output (in any order):

```
[
  'createBrightDataFetchTool',
  'createBrightDataSearchTool',
  'createBrightDataTools',
  'getBrightDataClient'
]
```

If `Cannot find package`, the `dist/` is missing or the path is wrong — go back to Step 5.

(There is no commit step in this task because this directory is outside the mastra repo and not under git.)

---

## Task 2: Implement the CLI in `index.ts`

**Files:**

- Create: `/home/meirk/brightdata-agent-test/index.ts`

This is one focused file. We write it whole rather than piece-by-piece because all the logic is linear and small (~80 lines).

- [ ] **Step 1: Write `index.ts`**

```ts
import { Agent } from '@mastra/core/agent'
import { createBrightDataTools } from '@mastra/brightdata'

function fail(message: string, withUsage = false): never {
  console.error(`Error: ${message}`)
  if (withUsage) {
    console.error('')
    console.error('Usage:')
    console.error('  OPENROUTER_API_KEY=sk-or-... BRIGHTDATA_API_TOKEN=brd_... \\')
    console.error('  tsx index.ts "your query here"')
    console.error('')
    console.error('Optional env vars:')
    console.error('  OPENROUTER_MODEL  default: openai/gpt-5')
    console.error('  MAX_STEPS         default: 5')
  }
  process.exit(1)
}

function truncate(value: unknown, max = 200): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (!str) return ''
  return str.length > max ? `${str.slice(0, max)}…` : str
}

function summarizeResult(result: unknown): string {
  if (result === null || result === undefined) return String(result)
  if (typeof result !== 'object') return truncate(result)
  const obj = result as Record<string, unknown>
  const parts: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      parts.push(`${key}: [${value.length} items]`)
    } else if (typeof value === 'string' && value.length > 80) {
      parts.push(`${key}: "<${value.length} chars>"`)
    } else {
      parts.push(`${key}: ${truncate(value, 80)}`)
    }
  }
  return `{ ${parts.join(', ')} }`
}

async function main(): Promise<void> {
  const query = process.argv[2]
  if (!query) fail('missing query argument', true)

  if (!process.env.OPENROUTER_API_KEY) fail('OPENROUTER_API_KEY env var not set', true)
  if (!process.env.BRIGHTDATA_API_TOKEN) fail('BRIGHTDATA_API_TOKEN env var not set', true)

  const modelId = process.env.OPENROUTER_MODEL ?? 'openai/gpt-5'
  const maxSteps = Number(process.env.MAX_STEPS ?? '5')

  console.log(`🚀 Running agent with model: openrouter/${modelId}`)
  console.log(`📝 Query: ${query}`)
  console.log('')

  const agent = new Agent({
    id: 'brightdata-test-agent',
    name: 'BrightData Test Agent',
    model: `openrouter/${modelId}`,
    instructions:
      'You are a research assistant. When the user asks a question that needs current ' +
      'information, use the web-search tool to find relevant pages, then optionally use ' +
      'web-fetch to read a specific page in full. Always cite the URLs you used.',
    tools: createBrightDataTools(),
  })

  const stream = await agent.stream(query, { maxSteps })

  let answer = ''
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call') {
      const args = truncate(chunk.payload?.args ?? {}, 200)
      console.log(`🔧 ${chunk.payload?.toolName}(${args})`)
    } else if (chunk.type === 'tool-result') {
      const result = summarizeResult(chunk.payload?.result)
      console.log(`   ↳ ${result}`)
    } else if (chunk.type === 'text-delta') {
      answer += chunk.payload?.text ?? ''
    }
  }

  console.log('')
  console.log('💬 Final answer:')
  console.log(answer || '(no text returned)')
}

main()
```

- [ ] **Step 2: Type-check**

Run from `/home/meirk/brightdata-agent-test`:

```bash
npx tsc --noEmit
```

Expected: zero errors.

If TypeScript objects to optional-chain on `chunk.payload?` because the chunk types are strictly typed, change the relevant lines to use `(chunk as any).payload?.…` — the spec accepts this pragmatic cast since the chunk-event union is wide and we only care about three specific types. (Document the cast with a one-line comment if you make this change.)

- [ ] **Step 3: Sanity-run with no args**

Run from `/home/meirk/brightdata-agent-test`:

```bash
npm start
```

Expected: prints `Error: missing query argument` plus the usage block, exits 1.

- [ ] **Step 4: Sanity-run with missing env**

Run from `/home/meirk/brightdata-agent-test`:

```bash
unset OPENROUTER_API_KEY BRIGHTDATA_API_TOKEN; npm start "test"
```

Expected: prints `Error: OPENROUTER_API_KEY env var not set`, exits 1.

(There is no commit step — this directory is outside any git repo.)

---

## Task 3: README

**Files:**

- Create: `/home/meirk/brightdata-agent-test/README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# brightdata-agent-test

Smoke test for the `@mastra/brightdata` integration. Runs a Mastra agent on an
OpenRouter model with the `web-search` and `web-fetch` tools, prints every tool
call live, then prints the final answer.

## Run

The integration's `dist/` must be built first:

```bash
cd ../BrightAI/mastra && pnpm --filter ./integrations/brightdata build:lib
```
````

Then from this directory:

```bash
npm install
OPENROUTER_API_KEY=sk-or-... BRIGHTDATA_API_TOKEN=brd_... \
  npm start "who won the most recent F1 race"
```

## Optional env vars

- `OPENROUTER_MODEL` — default `openai/gpt-5`. Any OpenRouter model id works
  (e.g. `anthropic/claude-sonnet-4.5`).
- `MAX_STEPS` — default `5`. Caps tool-use iterations per run.

````

(No commit step.)

---

## Task 4: End-to-end smoke run

This task verifies the integration actually works against the real Bright Data API and a real OpenRouter model. The user provides the keys at runtime.

**Files:** none changed.

- [ ] **Step 1: Confirm with the user that they have valid keys ready**

Ask:
> "Ready to run the smoke test. Do you have `OPENROUTER_API_KEY` and `BRIGHTDATA_API_TOKEN` to provide? You can paste them inline or export them in your shell first."

If they choose inline: collect both values from the user's response and run the command with the keys exported in the same line. **Never write the keys to disk** (no `.env` file, no file-based secret storage).

- [ ] **Step 2: Run a real query**

Suggested first query: `"who won the most recent F1 grand prix"` — recent enough to require a real search.

Run from `/home/meirk/brightdata-agent-test`:

```bash
OPENROUTER_API_KEY=<key> BRIGHTDATA_API_TOKEN=<token> \
  npm start "who won the most recent F1 grand prix"
````

Expected output structure (specific text varies):

```
🚀 Running agent with model: openrouter/openai/gpt-5
📝 Query: who won the most recent F1 grand prix

🔧 web-search({"query":"latest F1 grand prix winner 2026"})
   ↳ { query: "latest F1 grand prix winner 2026", results: [N items], currentPage: 1 }
🔧 web-fetch({"url":"https://www.formula1.com/..."})
   ↳ { url: "https://www.formula1.com/...", content: "<NN chars>" }

💬 Final answer:
<text answer with cited URLs>
```

- [ ] **Step 3: Verify success criteria**

Confirm with the user:

- The agent invoked `web-search` at least once with a sensible query.
- The tool result was a structured object (not an error).
- The agent produced a final answer that referenced URLs from the search.

If `web-search` was NOT called (e.g., the model answered from training data):

- Re-run with a more time-sensitive query like `"what did the Bright Data company announce this week"` or
- Strengthen the instructions to require tool use:

  ```
  instructions: 'You are a research assistant. You MUST use the web-search tool for every question…'
  ```

  (this is a one-line edit to `index.ts` if needed; do not commit anywhere — this dir is not under git).

- [ ] **Step 4: Report back**

Report success or any failure mode observed (auth error, model error, tool error, hung run, etc.) so the user can decide whether the integration is ready for the PR.

---

## Spec coverage check

| Spec section                                             | Implemented in                                      |
| -------------------------------------------------------- | --------------------------------------------------- |
| Location & layout (`/home/meirk/brightdata-agent-test/`) | Task 1                                              |
| Dependencies via `file:` link                            | Task 1                                              |
| `tsconfig.json` shape                                    | Task 1                                              |
| Required CLI arg + env vars + exit codes                 | Task 2 (`fail()` + arg/env checks)                  |
| Optional `OPENROUTER_MODEL`, `MAX_STEPS`                 | Task 2                                              |
| Agent shape with `createBrightDataTools()`               | Task 2                                              |
| Step printing format & truncation                        | Task 2 (`truncate`, `summarizeResult`, stream loop) |
| Error handling — surface, don't swallow                  | Task 2 (no global try/catch; errors propagate)      |
| README                                                   | Task 3                                              |
| End-to-end smoke run                                     | Task 4                                              |

**Spec deviation note:** the spec's "OpenRouter provider" snippet used `@openrouter/ai-sdk-provider`. The plan uses Mastra's built-in `'openrouter/...'` model-id string instead — same end behavior, simpler dep tree. The spec's "Risks and open questions" section #1 noted streaming-API uncertainty; this plan uses the confirmed `agent.stream(prompt, { maxSteps }) → stream.fullStream` async iterable with `tool-call` / `tool-result` / `text-delta` chunk types (verified against `@mastra/core` source).
