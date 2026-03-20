# Smoke Tests: Workflow Coverage — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create post-release smoke tests that exercise all Mastra workflow features end-to-end through the HTTP API, using `mastra build` + `mastra start` against alpha-tagged packages.

**Architecture:** A standalone project in `e2e-tests/smoke/` (not in pnpm workspace) that defines workflows covering every workflow primitive, boots a real production server via CLI, and runs Vitest tests against the API using raw `fetch`. LibSQL file-based storage provides real persistence for run management tests.

**Tech Stack:** `@mastra/core@alpha`, `@mastra/libsql@alpha`, `mastra@alpha` (CLI), Vitest, Zod, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-19-smoke-tests-workflows-design.md`

---

## File Structure

```
e2e-tests/smoke/
├── package.json              # standalone ESM package
├── vitest.config.ts          # globalSetup, 30s timeout, sequential
├── tsconfig.json             # strict TS config
├── .env                      # empty placeholder
├── src/
│   └── mastra/
│       ├── index.ts          # Mastra instance: LibSQL + all workflows
│       └── workflows/
│           ├── basic.ts              # sequential-steps, schema-validation, map-between-steps
│           ├── control-flow.ts       # branch, parallel, dowhile, dountil, foreach
│           ├── suspend-resume.ts     # basic-suspend, parallel-suspend, loop-suspend
│           ├── state.ts              # stateful-workflow, initial-state
│           ├── nested.ts             # inner-workflow, outer-workflow
│           └── error-handling.ts     # retry-workflow, failure-workflow, cancelable-workflow
└── tests/
    ├── setup.ts              # globalSetup: mastra build, mastra start, teardown
    ├── utils.ts              # fetchApi(), streamApi(), baseUrl injection
    └── workflows/
        ├── basic.test.ts
        ├── control-flow.test.ts
        ├── suspend-resume.test.ts
        ├── state.test.ts
        ├── nested.test.ts
        ├── error-handling.test.ts
        ├── run-management.test.ts
        └── streaming.test.ts
```

---

## Chunk 1: Project Scaffolding & Infrastructure

### Task 1: Create project skeleton

**Files:**

- Create: `e2e-tests/smoke/package.json`
- Create: `e2e-tests/smoke/tsconfig.json`
- Create: `e2e-tests/smoke/vitest.config.ts`
- Create: `e2e-tests/smoke/.env`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "e2e-smoke-tests",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "npx mastra build",
    "test": "vitest run"
  },
  "dependencies": {
    "@mastra/core": "alpha",
    "@mastra/libsql": "alpha"
  },
  "devDependencies": {
    "mastra": "alpha",
    "vitest": "^4.1.0",
    "typescript": "^5.8.0",
    "zod": "^3.24.0",
    "get-port": "^7.1.0",
    "execa": "^9.6.1"
  }
}
```

> **Note:** Using `get-port@^7.1.0` (ESM-only) which works fine since the project is `"type": "module"`. This matches the pattern in `e2e-tests/create-mastra/package.json`. Using `execa` for spawning `mastra build`/`mastra start` child processes — also matches existing e2e patterns.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", ".mastra"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/**/*.test.ts'],
    globalSetup: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    sequence: {
      concurrent: false,
    },
  },
})
```

> **Note:** `hookTimeout: 120_000` gives `mastra build` + `mastra start` up to 2 minutes in globalSetup. `testTimeout: 30_000` for individual tests. Sequential execution avoids run interference.

- [ ] **Step 4: Create `.env`**

```
# Smoke tests — no API keys needed for workflow-only tests
# LibSQL storage is configured in src/mastra/index.ts
```

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/smoke/package.json e2e-tests/smoke/tsconfig.json e2e-tests/smoke/vitest.config.ts e2e-tests/smoke/.env
git commit -m "chore: scaffold smoke test project skeleton"
```

---

### Task 2: Create globalSetup and test utilities

**Files:**

- Create: `e2e-tests/smoke/tests/setup.ts`
- Create: `e2e-tests/smoke/tests/utils.ts`

- [ ] **Step 1: Create `tests/setup.ts`**

This is the Vitest globalSetup. It runs `mastra build`, spawns `mastra start`, polls for readiness, and tears down on completion.

```typescript
import type { TestProject } from 'vitest/node'
import { execa, type ResultPromise } from 'execa'
import getPort from 'get-port'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectDir = join(__dirname, '..')

async function waitForServer(baseUrl: string, maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/workflows`)
      if (res.ok) {
        return
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Server at ${baseUrl} did not respond within ${maxAttempts * 500}ms`)
}

export default async function setup(project: TestProject) {
  const port = await getPort()
  const baseUrl = `http://localhost:${port}`

  // Step 1: Build
  console.log('[smoke] Running mastra build...')
  await execa('npx', ['mastra', 'build'], {
    cwd: projectDir,
    stdio: 'inherit',
  })
  console.log('[smoke] Build complete.')

  // Step 2: Start server
  console.log(`[smoke] Starting mastra server on port ${port}...`)
  const serverProc = execa('npx', ['mastra', 'start'], {
    cwd: projectDir,
    env: {
      ...process.env,
      PORT: port.toString(),
    },
    stdio: 'pipe',
  })

  // Log server output for debugging
  serverProc.stdout?.on('data', (data: Buffer) => {
    console.log(`[mastra] ${data.toString().trim()}`)
  })
  serverProc.stderr?.on('data', (data: Buffer) => {
    console.error(`[mastra:err] ${data.toString().trim()}`)
  })

  // Step 3: Wait for server readiness
  try {
    await waitForServer(baseUrl)
  } catch (err) {
    serverProc.kill('SIGTERM')
    throw err
  }

  console.log(`[smoke] Server ready at ${baseUrl}`)

  // Step 4: Provide baseUrl to tests
  project.provide('baseUrl', baseUrl)

  // Step 5: Return teardown
  return async () => {
    console.log('[smoke] Tearing down...')
    serverProc.kill('SIGTERM')

    // Wait briefly for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Clean up build output and database
    await rm(join(projectDir, '.mastra'), { recursive: true, force: true }).catch(() => {})
    await rm(join(projectDir, 'test.db'), { force: true }).catch(() => {})
    await rm(join(projectDir, 'test.db-journal'), { force: true }).catch(() => {})
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
  }
}
```

> **Key decisions:**
>
> - Uses `execa` for child process management (matches existing e2e patterns).
> - `maxAttempts = 60` (30 seconds) for server readiness polling.
> - Teardown cleans up `.mastra/` build output, `test.db`, and `test.db-journal`.
> - `stdio: 'pipe'` for `mastra start` so we can capture output for debugging while not blocking.

- [ ] **Step 2: Create `tests/utils.ts`**

```typescript
import { inject } from 'vitest'

/**
 * Get the base URL from the global setup.
 */
export function getBaseUrl(): string {
  return inject('baseUrl')
}

/**
 * Make a JSON API request to the Mastra server.
 */
export async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path}`
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })
}

/**
 * Make a JSON API request and parse the response.
 */
export async function fetchJson<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; data: T }> {
  const res = await fetchApi(path, options)
  const data = await res.json()
  return { status: res.status, data: data as T }
}

/**
 * Start a workflow and return the result.
 * Generates a client-side runId for consistent tracking.
 */
export async function startWorkflow(
  workflowId: string,
  body: Record<string, unknown> = {},
  runId?: string,
): Promise<{ runId: string; status: number; data: any }> {
  const id = runId ?? crypto.randomUUID()
  const res = await fetchApi(`/api/workflows/${workflowId}/start-async?runId=${id}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { runId: id, status: res.status, data }
}

/**
 * Resume a suspended workflow run.
 */
export async function resumeWorkflow(
  workflowId: string,
  runId: string,
  body: Record<string, unknown> = {},
): Promise<{ status: number; data: any }> {
  const res = await fetchApi(`/api/workflows/${workflowId}/resume-async?runId=${runId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { status: res.status, data }
}

/**
 * Get a workflow run by ID.
 */
export async function getWorkflowRun(workflowId: string, runId: string): Promise<{ status: number; data: any }> {
  return fetchJson(`/api/workflows/${workflowId}/runs/${runId}`)
}

/**
 * Stream a workflow execution and collect all chunks.
 * Mastra uses \x1E (record separator) delimited JSON, Content-Type: text/plain.
 */
export async function streamWorkflow(
  workflowId: string,
  body: Record<string, unknown> = {},
  runId?: string,
): Promise<{ runId: string; chunks: any[] }> {
  const id = runId ?? crypto.randomUUID()
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/workflows/${workflowId}/stream?runId=${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  const chunks = text
    .split('\x1E')
    .filter(s => s.trim().length > 0)
    .map(s => {
      try {
        return JSON.parse(s)
      } catch {
        return s
      }
    })

  return { runId: id, chunks }
}

/**
 * Stream a workflow resume and collect all chunks.
 */
export async function streamResumeWorkflow(
  workflowId: string,
  runId: string,
  body: Record<string, unknown> = {},
): Promise<{ chunks: any[] }> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/workflows/${workflowId}/resume-stream?runId=${runId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  const chunks = text
    .split('\x1E')
    .filter(s => s.trim().length > 0)
    .map(s => {
      try {
        return JSON.parse(s)
      } catch {
        return s
      }
    })

  return { chunks }
}
```

> **Key decisions:**
>
> - `startWorkflow` always generates a client-side `runId` via `crypto.randomUUID()` per the spec's RunId Strategy.
> - `streamWorkflow` reads the full response as text and splits on `\x1E` (record separator), matching Mastra's stream format.
> - Helper functions return both `status` and `data` so tests can assert on HTTP status codes.

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/tests/setup.ts e2e-tests/smoke/tests/utils.ts
git commit -m "feat(smoke): add globalSetup and test utilities"
```

---

## Chunk 2: Mastra Instance & Basic Workflows

### Task 3: Create basic workflow definitions

**Files:**

- Create: `e2e-tests/smoke/src/mastra/workflows/basic.ts`

- [ ] **Step 1: Write `basic.ts` with three workflows**

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// --- sequential-steps ---
// 3 chained steps. Each step receives the previous step's output.

const addGreeting = createStep({
  id: 'add-greeting',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ name: z.string(), greeting: z.string() }),
  execute: async ({ inputData }) => {
    return { name: inputData.name, greeting: `Hello, ${inputData.name}!` }
  },
})

const addFarewell = createStep({
  id: 'add-farewell',
  inputSchema: z.object({ name: z.string(), greeting: z.string() }),
  outputSchema: z.object({ name: z.string(), greeting: z.string(), farewell: z.string() }),
  execute: async ({ inputData }) => {
    return { ...inputData, farewell: `Goodbye, ${inputData.name}!` }
  },
})

const combineMessages = createStep({
  id: 'combine-messages',
  inputSchema: z.object({ name: z.string(), greeting: z.string(), farewell: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ inputData }) => {
    return { message: `${inputData.greeting} ${inputData.farewell}` }
  },
})

export const sequentialSteps = createWorkflow({
  id: 'sequential-steps',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ message: z.string() }),
})
  .then(addGreeting)
  .then(addFarewell)
  .then(combineMessages)
  .commit()

// --- schema-validation ---
// Workflow with strict input/output schemas.

const doubleNumber = createStep({
  id: 'double-number',
  inputSchema: z.object({ value: z.number().min(0).max(100) }),
  outputSchema: z.object({ result: z.number() }),
  execute: async ({ inputData }) => {
    return { result: inputData.value * 2 }
  },
})

export const schemaValidation = createWorkflow({
  id: 'schema-validation',
  inputSchema: z.object({ value: z.number().min(0).max(100) }),
  outputSchema: z.object({ result: z.number() }),
})
  .then(doubleNumber)
  .commit()

// --- map-between-steps ---
// Uses .map() to transform data between steps.

const produceData = createStep({
  id: 'produce-data',
  inputSchema: z.object({ firstName: z.string(), lastName: z.string() }),
  outputSchema: z.object({ firstName: z.string(), lastName: z.string(), fullName: z.string() }),
  execute: async ({ inputData }) => {
    return {
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      fullName: `${inputData.firstName} ${inputData.lastName}`,
    }
  },
})

const consumeMapped = createStep({
  id: 'consume-mapped',
  inputSchema: z.object({ displayName: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  execute: async ({ inputData }) => {
    return { formatted: `User: ${inputData.displayName}` }
  },
})

export const mapBetweenSteps = createWorkflow({
  id: 'map-between-steps',
  inputSchema: z.object({ firstName: z.string(), lastName: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
})
  .then(produceData)
  .map({
    displayName: {
      step: produceData,
      path: 'fullName',
    },
  })
  .then(consumeMapped)
  .commit()
```

- [ ] **Step 2: Commit**

```bash
git add e2e-tests/smoke/src/mastra/workflows/basic.ts
git commit -m "feat(smoke): add basic workflow definitions"
```

---

### Task 4: Create Mastra instance (initial — basic workflows only)

**Files:**

- Create: `e2e-tests/smoke/src/mastra/index.ts`

- [ ] **Step 1: Write `src/mastra/index.ts`**

```typescript
import { Mastra } from '@mastra/core/mastra'
import { LibSQLStore } from '@mastra/libsql'

import { sequentialSteps, schemaValidation, mapBetweenSteps } from './workflows/basic.js'

export const mastra = new Mastra({
  workflows: {
    'sequential-steps': sequentialSteps,
    'schema-validation': schemaValidation,
    'map-between-steps': mapBetweenSteps,
  },
  storage: new LibSQLStore({
    url: 'file:test.db',
  }),
})
```

> **Note:** We start with just the basic workflows. Each subsequent task will add its workflow file and update this file to register the new workflows. This keeps each task independently verifiable.

- [ ] **Step 2: Commit**

```bash
git add e2e-tests/smoke/src/mastra/index.ts
git commit -m "feat(smoke): add Mastra instance with basic workflows"
```

---

### Task 5: Write and verify basic workflow tests

**Files:**

- Create: `e2e-tests/smoke/tests/workflows/basic.test.ts`

- [ ] **Step 1: Write `basic.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { startWorkflow } from '../utils.js'

describe('basic workflows', () => {
  describe('sequential-steps', () => {
    it('should chain 3 steps and produce combined message', async () => {
      const { data } = await startWorkflow('sequential-steps', {
        inputData: { name: 'Alice' },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ message: 'Hello, Alice! Goodbye, Alice!' })
    })
  })

  describe('schema-validation', () => {
    it('should succeed with valid input', async () => {
      const { data } = await startWorkflow('schema-validation', {
        inputData: { value: 21 },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ result: 42 })
    })

    it('should fail with invalid input (value too high)', async () => {
      const { data } = await startWorkflow('schema-validation', {
        inputData: { value: 200 },
      })

      // Workflow should fail due to input schema validation
      expect(data.status).toBe('failed')
    })

    it('should fail with invalid input (wrong type)', async () => {
      const { data } = await startWorkflow('schema-validation', {
        inputData: { value: 'not-a-number' },
      })

      expect(data.status).toBe('failed')
    })
  })

  describe('map-between-steps', () => {
    it('should map fullName to displayName between steps', async () => {
      const { data } = await startWorkflow('map-between-steps', {
        inputData: { firstName: 'John', lastName: 'Doe' },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ formatted: 'User: John Doe' })
    })
  })
})
```

- [ ] **Step 2: Install dependencies and run tests**

```bash
cd e2e-tests/smoke && pnpm install --ignore-workspace && pnpm test
```

Expected: All 4 tests pass. If any fail, debug by checking server output and adjusting workflow definitions or test assertions.

> **Important:** This is the first time the full pipeline runs (install alpha packages → mastra build → mastra start → vitest). Expect potential issues with package resolution or build config. Debug and fix before proceeding.

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/tests/workflows/basic.test.ts
git commit -m "test(smoke): add basic workflow tests"
```

---

## Chunk 3: Control Flow Workflows

### Task 6: Create control flow workflow definitions

**Files:**

- Create: `e2e-tests/smoke/src/mastra/workflows/control-flow.ts`
- Modify: `e2e-tests/smoke/src/mastra/index.ts`

- [ ] **Step 1: Write `control-flow.ts`**

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// --- branch-workflow ---
// Conditional branching based on input type.

const classifyInput = createStep({
  id: 'classify-input',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number(), category: z.string() }),
  execute: async ({ inputData }) => {
    const category = inputData.value >= 0 ? 'positive' : 'negative'
    return { value: inputData.value, category }
  },
})

const handlePositive = createStep({
  id: 'handle-positive',
  inputSchema: z.object({ value: z.number(), category: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `Positive: ${inputData.value}` }
  },
})

const handleNegative = createStep({
  id: 'handle-negative',
  inputSchema: z.object({ value: z.number(), category: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `Negative: ${inputData.value}` }
  },
})

export const branchWorkflow = createWorkflow({
  id: 'branch-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(classifyInput)
  .branch([
    [async ({ inputData }) => inputData.category === 'positive', handlePositive],
    [async ({ inputData }) => inputData.category === 'negative', handleNegative],
  ])
  .commit()

// --- parallel-workflow ---
// 3 steps run concurrently.

const computeSquare = createStep({
  id: 'compute-square',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ square: z.number() }),
  execute: async ({ inputData }) => {
    return { square: inputData.value * inputData.value }
  },
})

const computeDouble = createStep({
  id: 'compute-double',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ double: z.number() }),
  execute: async ({ inputData }) => {
    return { double: inputData.value * 2 }
  },
})

const computeNegate = createStep({
  id: 'compute-negate',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ negated: z.number() }),
  execute: async ({ inputData }) => {
    return { negated: -inputData.value }
  },
})

export const parallelWorkflow = createWorkflow({
  id: 'parallel-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ square: z.number(), double: z.number(), negated: z.number() }),
})
  .parallel([computeSquare, computeDouble, computeNegate])
  .commit()

// --- dowhile-workflow ---
// Loop that increments a counter while condition is true.

const incrementCounter = createStep({
  id: 'increment-counter',
  inputSchema: z.object({ count: z.number() }),
  outputSchema: z.object({ count: z.number() }),
  execute: async ({ inputData }) => {
    return { count: inputData.count + 1 }
  },
})

export const dowhileWorkflow = createWorkflow({
  id: 'dowhile-workflow',
  inputSchema: z.object({ count: z.number() }),
  outputSchema: z.object({ count: z.number() }),
})
  .dowhile(incrementCounter, async ({ inputData }) => inputData.count < 5)
  .commit()

// --- dountil-workflow ---
// Loop that accumulates values until threshold.

const accumulateValue = createStep({
  id: 'accumulate-value',
  inputSchema: z.object({ total: z.number() }),
  outputSchema: z.object({ total: z.number() }),
  execute: async ({ inputData }) => {
    return { total: inputData.total + 10 }
  },
})

export const dountilWorkflow = createWorkflow({
  id: 'dountil-workflow',
  inputSchema: z.object({ total: z.number() }),
  outputSchema: z.object({ total: z.number() }),
})
  .dountil(accumulateValue, async ({ inputData }) => inputData.total >= 50)
  .commit()

// --- foreach-workflow ---
// Iterates over array items with concurrency.

const processItem = createStep({
  id: 'process-item',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ processed: z.string() }),
  execute: async ({ inputData }) => {
    return { processed: inputData.item.toUpperCase() }
  },
})

const produceItems = createStep({
  id: 'produce-items',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ item: z.string() })),
  execute: async ({ inputData }) => {
    return inputData.items.map(item => ({ item }))
  },
})

export const foreachWorkflow = createWorkflow({
  id: 'foreach-workflow',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.array(z.object({ processed: z.string() })),
})
  .then(produceItems)
  .foreach(processItem, { concurrency: 2 })
  .commit()
```

- [ ] **Step 2: Register in `src/mastra/index.ts`**

Add to imports:

```typescript
import {
  branchWorkflow,
  parallelWorkflow,
  dowhileWorkflow,
  dountilWorkflow,
  foreachWorkflow,
} from './workflows/control-flow.js'
```

Add to `workflows` object:

```typescript
    'branch-workflow': branchWorkflow,
    'parallel-workflow': parallelWorkflow,
    'dowhile-workflow': dowhileWorkflow,
    'dountil-workflow': dountilWorkflow,
    'foreach-workflow': foreachWorkflow,
```

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/src/mastra/workflows/control-flow.ts e2e-tests/smoke/src/mastra/index.ts
git commit -m "feat(smoke): add control flow workflow definitions"
```

---

### Task 7: Write and verify control flow tests

**Files:**

- Create: `e2e-tests/smoke/tests/workflows/control-flow.test.ts`

- [ ] **Step 1: Write `control-flow.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { startWorkflow } from '../utils.js'

describe('control flow workflows', () => {
  describe('branch-workflow', () => {
    it('should take the positive branch for positive values', async () => {
      const { data } = await startWorkflow('branch-workflow', {
        inputData: { value: 42 },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ result: 'Positive: 42' })
    })

    it('should take the negative branch for negative values', async () => {
      const { data } = await startWorkflow('branch-workflow', {
        inputData: { value: -7 },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ result: 'Negative: -7' })
    })
  })

  describe('parallel-workflow', () => {
    it('should execute all 3 steps concurrently and collect results', async () => {
      const { data } = await startWorkflow('parallel-workflow', {
        inputData: { value: 5 },
      })

      expect(data.status).toBe('success')
      // Parallel results are keyed by step ID
      expect(data.result).toMatchObject({
        'compute-square': { square: 25 },
        'compute-double': { double: 10 },
        'compute-negate': { negated: -5 },
      })
    })
  })

  describe('dowhile-workflow', () => {
    it('should loop until count reaches 5', async () => {
      const { data } = await startWorkflow('dowhile-workflow', {
        inputData: { count: 0 },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ count: 5 })
    })
  })

  describe('dountil-workflow', () => {
    it('should accumulate until total reaches 50', async () => {
      const { data } = await startWorkflow('dountil-workflow', {
        inputData: { total: 0 },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ total: 50 })
    })
  })

  describe('foreach-workflow', () => {
    it('should process each item in the array', async () => {
      const { data } = await startWorkflow('foreach-workflow', {
        inputData: { items: ['hello', 'world', 'test'] },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual([{ processed: 'HELLO' }, { processed: 'WORLD' }, { processed: 'TEST' }])
    })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd e2e-tests/smoke && pnpm test
```

Expected: All control flow tests pass alongside existing basic tests.

> **Note:** The parallel workflow result shape (`{ 'step-id': output }`) may need adjustment based on actual Mastra behavior. If the result is structured differently (e.g., flat object or array), update assertions accordingly.

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/tests/workflows/control-flow.test.ts
git commit -m "test(smoke): add control flow workflow tests"
```

---

## Chunk 4: Suspend/Resume & State Workflows

### Task 8: Create suspend/resume workflow definitions

**Files:**

- Create: `e2e-tests/smoke/src/mastra/workflows/suspend-resume.ts`
- Modify: `e2e-tests/smoke/src/mastra/index.ts`

- [ ] **Step 1: Write `suspend-resume.ts`**

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// --- basic-suspend ---
// Step suspends with payload, test resumes with data.

const prepareRequest = createStep({
  id: 'prepare-request',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ item: z.string(), requestId: z.string() }),
  execute: async ({ inputData }) => {
    return { item: inputData.item, requestId: `req-${Date.now()}` }
  },
})

const awaitApproval = createStep({
  id: 'await-approval',
  inputSchema: z.object({ item: z.string(), requestId: z.string() }),
  outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
  suspendSchema: z.object({ message: z.string(), requestId: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({
        message: `Please approve: ${inputData.item}`,
        requestId: inputData.requestId,
      })
    }
    return { item: inputData.item, approved: resumeData?.approved ?? false }
  },
})

const finalize = createStep({
  id: 'finalize',
  inputSchema: z.object({ item: z.string(), approved: z.boolean() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return {
      result: inputData.approved ? `${inputData.item} approved` : `${inputData.item} rejected`,
    }
  },
})

export const basicSuspend = createWorkflow({
  id: 'basic-suspend',
  inputSchema: z.object({ item: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(prepareRequest)
  .then(awaitApproval)
  .then(finalize)
  .commit()

// --- parallel-suspend ---
// Two parallel branches, each suspends with a different resume label.

const suspendBranchA = createStep({
  id: 'suspend-branch-a',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ branchA: z.string() }),
  suspendSchema: z.object({ branch: z.literal('A') }),
  resumeSchema: z.object({ dataA: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ branch: 'A' }, { resumeLabel: 'branch-a' })
    }
    return { branchA: resumeData?.dataA ?? 'default' }
  },
})

const suspendBranchB = createStep({
  id: 'suspend-branch-b',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ branchB: z.string() }),
  suspendSchema: z.object({ branch: z.literal('B') }),
  resumeSchema: z.object({ dataB: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ branch: 'B' }, { resumeLabel: 'branch-b' })
    }
    return { branchB: resumeData?.dataB ?? 'default' }
  },
})

export const parallelSuspend = createWorkflow({
  id: 'parallel-suspend',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ branchA: z.string(), branchB: z.string() }),
})
  .parallel([suspendBranchA, suspendBranchB])
  .commit()

// --- loop-suspend ---
// Suspend inside a dowhile loop. Resume continues looping.

const loopWithSuspend = createStep({
  id: 'loop-with-suspend',
  inputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
  outputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
  suspendSchema: z.object({ currentIteration: z.number() }),
  resumeSchema: z.object({ value: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      await suspend({ currentIteration: inputData.iteration })
    }
    return {
      iteration: inputData.iteration + 1,
      items: [...inputData.items, resumeData?.value ?? 'none'],
    }
  },
})

export const loopSuspend = createWorkflow({
  id: 'loop-suspend',
  inputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
  outputSchema: z.object({ iteration: z.number(), items: z.array(z.string()) }),
})
  .dowhile(loopWithSuspend, async ({ inputData }) => inputData.iteration < 3)
  .commit()
```

- [ ] **Step 2: Register in `src/mastra/index.ts`**

Add to imports:

```typescript
import { basicSuspend, parallelSuspend, loopSuspend } from './workflows/suspend-resume.js'
```

Add to `workflows` object:

```typescript
    'basic-suspend': basicSuspend,
    'parallel-suspend': parallelSuspend,
    'loop-suspend': loopSuspend,
```

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/src/mastra/workflows/suspend-resume.ts e2e-tests/smoke/src/mastra/index.ts
git commit -m "feat(smoke): add suspend/resume workflow definitions"
```

---

### Task 9: Write and verify suspend/resume tests

**Files:**

- Create: `e2e-tests/smoke/tests/workflows/suspend-resume.test.ts`

- [ ] **Step 1: Write `suspend-resume.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { startWorkflow, resumeWorkflow, getWorkflowRun } from '../utils.js'

describe('suspend/resume workflows', () => {
  describe('basic-suspend', () => {
    it('should suspend and return suspend payload', async () => {
      const { runId, data } = await startWorkflow('basic-suspend', {
        inputData: { item: 'report' },
      })

      expect(data.status).toBe('suspended')
    })

    it('should resume with data and complete', async () => {
      const { runId, data: startData } = await startWorkflow('basic-suspend', {
        inputData: { item: 'report' },
      })

      expect(startData.status).toBe('suspended')

      const { data: resumeData } = await resumeWorkflow('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      })

      expect(resumeData.status).toBe('success')
      expect(resumeData.result).toEqual({ result: 'report approved' })
    })

    it('should handle rejection on resume', async () => {
      const { runId } = await startWorkflow('basic-suspend', {
        inputData: { item: 'expense' },
      })

      const { data } = await resumeWorkflow('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: false },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ result: 'expense rejected' })
    })
  })

  describe('parallel-suspend', () => {
    it('should suspend both parallel branches', async () => {
      const { runId, data } = await startWorkflow('parallel-suspend', {
        inputData: { value: 1 },
      })

      expect(data.status).toBe('suspended')
    })

    it('should resume individual branches by step ID', async () => {
      const { runId } = await startWorkflow('parallel-suspend', {
        inputData: { value: 1 },
      })

      // Resume branch A (identified by step ID only — the API has no label field)
      const { data: afterA } = await resumeWorkflow('parallel-suspend', runId, {
        step: 'suspend-branch-a',
        resumeData: { dataA: 'value-a' },
      })

      // After resuming one branch, workflow may still be suspended (other branch)
      // Resume branch B
      const { data: afterB } = await resumeWorkflow('parallel-suspend', runId, {
        step: 'suspend-branch-b',
        resumeData: { dataB: 'value-b' },
      })

      expect(afterB.status).toBe('success')
      expect(afterB.result).toMatchObject({
        'suspend-branch-a': { branchA: 'value-a' },
        'suspend-branch-b': { branchB: 'value-b' },
      })
    })
  })

  describe('loop-suspend', () => {
    it('should suspend on each loop iteration and resume', async () => {
      // Start — should suspend on first iteration
      const { runId, data: iter0 } = await startWorkflow('loop-suspend', {
        inputData: { iteration: 0, items: [] },
      })
      expect(iter0.status).toBe('suspended')

      // Resume iteration 0 → suspends on iteration 1
      const { data: iter1 } = await resumeWorkflow('loop-suspend', runId, {
        step: 'loop-with-suspend',
        resumeData: { value: 'first' },
      })
      expect(iter1.status).toBe('suspended')

      // Resume iteration 1 → suspends on iteration 2
      const { data: iter2 } = await resumeWorkflow('loop-suspend', runId, {
        step: 'loop-with-suspend',
        resumeData: { value: 'second' },
      })
      expect(iter2.status).toBe('suspended')

      // Resume iteration 2 → iteration becomes 3, loop condition false → complete
      const { data: final } = await resumeWorkflow('loop-suspend', runId, {
        step: 'loop-with-suspend',
        resumeData: { value: 'third' },
      })
      expect(final.status).toBe('success')
      expect(final.result).toEqual({
        iteration: 3,
        items: ['first', 'second', 'third'],
      })
    })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd e2e-tests/smoke && pnpm test
```

Expected: All suspend/resume tests pass.

> **Important:** Suspend/resume behavior through the API may differ from direct programmatic usage. The `step` field in the resume body specifies which step to resume. If the API expects different field names or the response shape differs, adjust accordingly. Check server logs for errors.

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/tests/workflows/suspend-resume.test.ts
git commit -m "test(smoke): add suspend/resume workflow tests"
```

---

### Task 10: Create state workflow definitions and tests

**Files:**

- Create: `e2e-tests/smoke/src/mastra/workflows/state.ts`
- Modify: `e2e-tests/smoke/src/mastra/index.ts`
- Create: `e2e-tests/smoke/tests/workflows/state.test.ts`

- [ ] **Step 1: Write `state.ts`**

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

const stateSchema = z.object({
  count: z.number(),
  log: z.array(z.string()),
})

// --- stateful-workflow ---
// Multiple steps that read and write workflow state.

const stepOne = createStep({
  id: 'state-step-one',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ action: z.string() }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    await setState({
      count: (state?.count ?? 0) + 1,
      log: [...(state?.log ?? []), `step-one:${inputData.action}`],
    })
    return { action: inputData.action }
  },
})

const stepTwo = createStep({
  id: 'state-step-two',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ finalCount: z.number(), finalLog: z.array(z.string()) }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const newCount = (state?.count ?? 0) + 1
    const newLog = [...(state?.log ?? []), `step-two:${inputData.action}`]
    await setState({ count: newCount, log: newLog })
    return { finalCount: newCount, finalLog: newLog }
  },
})

export const statefulWorkflow = createWorkflow({
  id: 'stateful-workflow',
  inputSchema: z.object({ action: z.string() }),
  outputSchema: z.object({ finalCount: z.number(), finalLog: z.array(z.string()) }),
  stateSchema,
})
  .then(stepOne)
  .then(stepTwo)
  .commit()

// --- initial-state ---
// Started with initialState, steps read and modify it.

const readAndModify = createStep({
  id: 'read-and-modify',
  inputSchema: z.object({ addValue: z.string() }),
  outputSchema: z.object({
    originalCount: z.number(),
    newCount: z.number(),
    log: z.array(z.string()),
  }),
  stateSchema,
  execute: async ({ inputData, state, setState }) => {
    const originalCount = state?.count ?? 0
    const newLog = [...(state?.log ?? []), inputData.addValue]
    await setState({ count: originalCount + 10, log: newLog })
    return { originalCount, newCount: originalCount + 10, log: newLog }
  },
})

export const initialStateWorkflow = createWorkflow({
  id: 'initial-state',
  inputSchema: z.object({ addValue: z.string() }),
  outputSchema: z.object({
    originalCount: z.number(),
    newCount: z.number(),
    log: z.array(z.string()),
  }),
  stateSchema,
})
  .then(readAndModify)
  .commit()
```

- [ ] **Step 2: Register in `src/mastra/index.ts`**

Add to imports:

```typescript
import { statefulWorkflow, initialStateWorkflow } from './workflows/state.js'
```

Add to `workflows` object:

```typescript
    'stateful-workflow': statefulWorkflow,
    'initial-state': initialStateWorkflow,
```

- [ ] **Step 3: Write `state.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { startWorkflow } from '../utils.js'

describe('state workflows', () => {
  describe('stateful-workflow', () => {
    it('should accumulate state across steps', async () => {
      const { data } = await startWorkflow('stateful-workflow', {
        inputData: { action: 'test' },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({
        finalCount: 2,
        finalLog: ['step-one:test', 'step-two:test'],
      })
    })
  })

  describe('initial-state', () => {
    it('should start with provided initialState', async () => {
      const { data } = await startWorkflow('initial-state', {
        inputData: { addValue: 'injected' },
        initialState: { count: 5, log: ['pre-existing'] },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({
        originalCount: 5,
        newCount: 15,
        log: ['pre-existing', 'injected'],
      })
    })
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd e2e-tests/smoke && pnpm test
```

Expected: All state tests pass alongside existing tests.

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/smoke/src/mastra/workflows/state.ts e2e-tests/smoke/src/mastra/index.ts e2e-tests/smoke/tests/workflows/state.test.ts
git commit -m "feat(smoke): add state workflow definitions and tests"
```

---

## Chunk 5: Nested, Error Handling, Run Management & Streaming

### Task 11: Create nested workflow definitions and tests

**Files:**

- Create: `e2e-tests/smoke/src/mastra/workflows/nested.ts`
- Modify: `e2e-tests/smoke/src/mastra/index.ts`
- Create: `e2e-tests/smoke/tests/workflows/nested.test.ts`

- [ ] **Step 1: Write `nested.ts`**

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// --- inner-workflow ---
const transformStep = createStep({
  id: 'transform',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ transformed: z.string() }),
  execute: async ({ inputData }) => {
    return { transformed: inputData.text.toUpperCase() }
  },
})

export const innerWorkflow = createWorkflow({
  id: 'inner-workflow',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ transformed: z.string() }),
})
  .then(transformStep)
  .commit()

// --- outer-workflow ---
const prepareStep = createStep({
  id: 'prepare',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  execute: async ({ inputData }) => {
    return { text: `processed:${inputData.input}` }
  },
})

const wrapStep = createStep({
  id: 'wrap',
  inputSchema: z.object({ transformed: z.string() }),
  outputSchema: z.object({ final: z.string() }),
  execute: async ({ inputData }) => {
    return { final: `[${inputData.transformed}]` }
  },
})

export const outerWorkflow = createWorkflow({
  id: 'outer-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ final: z.string() }),
})
  .then(prepareStep)
  .then(innerWorkflow)
  .then(wrapStep)
  .commit()
```

- [ ] **Step 2: Register in `src/mastra/index.ts`**

Add to imports:

```typescript
import { innerWorkflow, outerWorkflow } from './workflows/nested.js'
```

Add to `workflows` object:

```typescript
    'inner-workflow': innerWorkflow,
    'outer-workflow': outerWorkflow,
```

- [ ] **Step 3: Write `nested.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { startWorkflow } from '../utils.js'

describe('nested workflows', () => {
  it('should execute inner workflow as a step and pass data through', async () => {
    const { data } = await startWorkflow('outer-workflow', {
      inputData: { input: 'hello' },
    })

    expect(data.status).toBe('success')
    expect(data.result).toEqual({ final: '[PROCESSED:HELLO]' })
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd e2e-tests/smoke && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/smoke/src/mastra/workflows/nested.ts e2e-tests/smoke/src/mastra/index.ts e2e-tests/smoke/tests/workflows/nested.test.ts
git commit -m "feat(smoke): add nested workflow definitions and tests"
```

---

### Task 12: Create error handling workflow definitions and tests

**Files:**

- Create: `e2e-tests/smoke/src/mastra/workflows/error-handling.ts`
- Modify: `e2e-tests/smoke/src/mastra/index.ts`
- Create: `e2e-tests/smoke/tests/workflows/error-handling.test.ts`

- [ ] **Step 1: Write `error-handling.ts`**

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

// --- retry-workflow ---
// Step fails on retryCount 0 and 1, succeeds on retryCount 2 (3rd attempt).
// `retries: 3` means 3 retries after initial attempt = 4 total attempts allowed.

const flakyStep = createStep({
  id: 'flaky-step',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string(), attempts: z.number() }),
  retries: 3,
  execute: async ({ inputData, retryCount }) => {
    if (retryCount < 2) {
      throw new Error(`Attempt ${retryCount + 1} failed`)
    }
    return { result: inputData.message, attempts: retryCount + 1 }
  },
})

export const retryWorkflow = createWorkflow({
  id: 'retry-workflow',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string(), attempts: z.number() }),
})
  .then(flakyStep)
  .commit()

// --- failure-workflow ---
// Step always throws.

const alwaysFails = createStep({
  id: 'always-fails',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async () => {
    throw new Error('Intentional failure for smoke test')
  },
})

export const failureWorkflow = createWorkflow({
  id: 'failure-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(alwaysFails)
  .commit()

// --- cancelable-workflow ---
// Uses .sleep() for a long duration so it can be cancelled mid-execution.

const beforeSleep = createStep({
  id: 'before-sleep',
  inputSchema: z.object({ label: z.string() }),
  outputSchema: z.object({ label: z.string(), started: z.boolean() }),
  execute: async ({ inputData }) => {
    return { label: inputData.label, started: true }
  },
})

const afterSleep = createStep({
  id: 'after-sleep',
  inputSchema: z.object({ label: z.string(), started: z.boolean() }),
  outputSchema: z.object({ label: z.string(), completed: z.boolean() }),
  execute: async ({ inputData }) => {
    return { label: inputData.label, completed: true }
  },
})

export const cancelableWorkflow = createWorkflow({
  id: 'cancelable-workflow',
  inputSchema: z.object({ label: z.string() }),
  outputSchema: z.object({ label: z.string(), completed: z.boolean() }),
})
  .then(beforeSleep)
  .sleep(60_000) // 60 seconds — long enough to cancel
  .then(afterSleep)
  .commit()
```

- [ ] **Step 2: Register in `src/mastra/index.ts`**

Add to imports:

```typescript
import { retryWorkflow, failureWorkflow, cancelableWorkflow } from './workflows/error-handling.js'
```

Add to `workflows` object:

```typescript
    'retry-workflow': retryWorkflow,
    'failure-workflow': failureWorkflow,
    'cancelable-workflow': cancelableWorkflow,
```

- [ ] **Step 3: Write `error-handling.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { startWorkflow } from '../utils.js'

describe('error handling workflows', () => {
  describe('retry-workflow', () => {
    it('should succeed after retries', async () => {
      const { data } = await startWorkflow('retry-workflow', {
        inputData: { message: 'retry-test' },
      })

      expect(data.status).toBe('success')
      expect(data.result).toEqual({ result: 'retry-test', attempts: 3 })
    })
  })

  describe('failure-workflow', () => {
    it('should report failed status with error details', async () => {
      const { data } = await startWorkflow('failure-workflow', {
        inputData: { input: 'will-fail' },
      })

      expect(data.status).toBe('failed')
      expect(data.error).toBeDefined()
    })
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd e2e-tests/smoke && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add e2e-tests/smoke/src/mastra/workflows/error-handling.ts e2e-tests/smoke/src/mastra/index.ts e2e-tests/smoke/tests/workflows/error-handling.test.ts
git commit -m "feat(smoke): add error handling workflow definitions and tests"
```

---

### Task 13: Write run management tests

**Files:**

- Create: `e2e-tests/smoke/tests/workflows/run-management.test.ts`

- [ ] **Step 1: Write `run-management.test.ts`**

Uses workflows already registered (`sequential-steps`, `cancelable-workflow`).

```typescript
import { describe, it, expect } from 'vitest'
import { fetchJson, fetchApi, startWorkflow } from '../utils.js'

describe('run management', () => {
  describe('workflow discovery', () => {
    it('should list all registered workflows', async () => {
      const { data } = await fetchJson<Record<string, any>>('/api/workflows')

      // Verify key workflows are present
      expect(data).toHaveProperty('sequential-steps')
      expect(data).toHaveProperty('branch-workflow')
      expect(data).toHaveProperty('basic-suspend')
      expect(data).toHaveProperty('cancelable-workflow')
    })

    it('should get single workflow metadata', async () => {
      const { data } = await fetchJson<any>('/api/workflows/sequential-steps')

      expect(data).toHaveProperty('steps')
      expect(data).toHaveProperty('stepGraph')
    })
  })

  describe('run CRUD', () => {
    it('should list runs after starting a workflow', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'run-list-test' },
      })

      const { data } = await fetchJson<any>('/api/workflows/sequential-steps/runs')

      expect(data.runs).toBeDefined()
      expect(data.runs.length).toBeGreaterThan(0)

      const run = data.runs.find((r: any) => r.runId === runId)
      expect(run).toBeDefined()
    })

    it('should get run details by ID', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'run-detail-test' },
      })

      const { data } = await fetchJson<any>(`/api/workflows/sequential-steps/runs/${runId}`)

      expect(data.runId).toBe(runId)
      expect(data.status).toBe('success')
      expect(data.result).toBeDefined()
    })

    it('should delete a run', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'run-delete-test' },
      })

      const deleteRes = await fetchApi(`/api/workflows/sequential-steps/runs/${runId}`, { method: 'DELETE' })
      expect(deleteRes.status).toBe(200)

      // Verify it's gone
      const getRes = await fetchApi(`/api/workflows/sequential-steps/runs/${runId}`)
      expect(getRes.status).toBe(404)
    })
  })

  describe('cancel', () => {
    it('should cancel a running workflow', async () => {
      // cancelable-workflow has a 60s sleep.
      // start-async blocks until completion, so we use create-run + /start (fire-and-forget).
      const runId = crypto.randomUUID()

      // Step 1: Create the run
      const createRes = await fetchApi(`/api/workflows/cancelable-workflow/create-run?runId=${runId}`, {
        method: 'POST',
      })
      expect(createRes.status).toBe(200)

      // Step 2: Fire-and-forget start (returns immediately with a message)
      const startRes = await fetchApi(`/api/workflows/cancelable-workflow/start?runId=${runId}`, {
        method: 'POST',
        body: JSON.stringify({ inputData: { label: 'cancel-test' } }),
      })
      expect(startRes.status).toBe(200)

      // Give it a moment to enter the sleep state
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 3: Cancel
      const cancelRes = await fetchApi(`/api/workflows/cancelable-workflow/runs/${runId}/cancel`, { method: 'POST' })
      expect(cancelRes.status).toBe(200)

      // Step 4: Verify the run is cancelled
      const { data } = await fetchJson<any>(`/api/workflows/cancelable-workflow/runs/${runId}`)
      expect(data.status).toBe('canceled')
    })
  })

  describe('time-travel', () => {
    it('should re-execute from a specific step with new input', async () => {
      // First, run the workflow normally
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'Alice' },
      })

      // Time-travel to re-execute from 'add-farewell' step with different data
      const { data } = await fetchJson<any>(`/api/workflows/sequential-steps/time-travel-async?runId=${runId}`, {
        method: 'POST',
        body: JSON.stringify({
          step: 'add-farewell',
          inputData: { name: 'Bob', greeting: 'Hi Bob!' },
        }),
      })

      expect(data.status).toBe('success')
      // The farewell and combine steps should use the new data
      expect(data.result.message).toContain('Bob')
    })
  })

  describe('restart', () => {
    it('should restart a completed run with original input', async () => {
      const { runId } = await startWorkflow('sequential-steps', {
        inputData: { name: 'restart-test' },
      })

      // Restart re-executes with the original input data.
      // The restart body schema only accepts requestContext and tracingOptions — no inputData.
      const { data } = await fetchJson<any>(`/api/workflows/sequential-steps/restart-async?runId=${runId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      })

      expect(data.status).toBe('success')
      expect(data.result.message).toContain('restart-test')
    })
  })
})
```

> **Note:** The cancel test uses `create-run` + `/start` (fire-and-forget) instead of `start-async` because `start-async` blocks until the workflow completes — which would mean waiting 60s for the sleep step.

- [ ] **Step 2: Run tests**

```bash
cd e2e-tests/smoke && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/tests/workflows/run-management.test.ts
git commit -m "test(smoke): add run management tests"
```

---

### Task 14: Write streaming tests

**Files:**

- Create: `e2e-tests/smoke/tests/workflows/streaming.test.ts`

- [ ] **Step 1: Write `streaming.test.ts`**

Uses `sequential-steps` and `basic-suspend` workflows (already registered).

```typescript
import { describe, it, expect } from 'vitest'
import { streamWorkflow, streamResumeWorkflow, startWorkflow } from '../utils.js'

describe('streaming workflows', () => {
  describe('stream execution', () => {
    it('should stream sequential-steps and receive chunks', async () => {
      const { runId, chunks } = await streamWorkflow('sequential-steps', {
        inputData: { name: 'stream-test' },
      })

      // Should have received at least one chunk
      expect(chunks.length).toBeGreaterThan(0)

      // The last chunk should contain the final result
      const lastChunk = chunks[chunks.length - 1]
      expect(lastChunk).toBeDefined()
    })
  })

  describe('stream suspend/resume', () => {
    it('should stream suspend then stream resume', async () => {
      // Stream the workflow — should suspend
      const { runId, chunks: startChunks } = await streamWorkflow('basic-suspend', {
        inputData: { item: 'stream-suspend-test' },
      })

      expect(startChunks.length).toBeGreaterThan(0)

      // Resume via stream
      const { chunks: resumeChunks } = await streamResumeWorkflow('basic-suspend', runId, {
        step: 'await-approval',
        resumeData: { approved: true },
      })

      expect(resumeChunks.length).toBeGreaterThan(0)
    })
  })
})
```

> **Note:** Stream chunk assertions are intentionally loose — we're verifying that streaming works and returns data, not the exact chunk format. The exact shape of stream chunks may vary between versions.

- [ ] **Step 2: Run tests**

```bash
cd e2e-tests/smoke && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add e2e-tests/smoke/tests/workflows/streaming.test.ts
git commit -m "test(smoke): add streaming workflow tests"
```

---

## Chunk 6: Final Verification & Cleanup

### Task 15: Full test suite run and adjustments

- [ ] **Step 1: Run the complete test suite**

```bash
cd e2e-tests/smoke && pnpm test
```

Verify all test files pass:

- `basic.test.ts` — 4 tests
- `control-flow.test.ts` — 6 tests
- `suspend-resume.test.ts` — 5 tests
- `state.test.ts` — 2 tests
- `nested.test.ts` — 1 test
- `error-handling.test.ts` — 2 tests
- `run-management.test.ts` — 7 tests
- `streaming.test.ts` — 2 tests

**Total: ~29 tests**

- [ ] **Step 2: Fix any failing tests**

Iterate on failures. Common adjustments:

- Response shape mismatches → update assertions based on actual API responses
- Parallel result structure → may be `{ 'step-id': output }` or different
- Sleep/cancel timing → adjust delays or use a different endpoint
- Foreach output shape → may be array or wrapped object
- Stream chunk format → adjust parsing if format differs

- [ ] **Step 3: Final commit with any adjustments**

```bash
git add -u e2e-tests/smoke/
git commit -m "fix(smoke): adjust tests based on actual API behavior"
```

> **Note:** Only commit this if adjustments were needed. Skip if all tests passed on first run.

- [ ] **Step 4: Verify clean run from scratch**

```bash
cd e2e-tests/smoke
rm -rf node_modules .mastra test.db test.db-journal
pnpm install --ignore-workspace
pnpm test
```

This simulates a fresh run as a user would do after a release.
