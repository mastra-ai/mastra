# Headless Config File & Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.mastracode/headless.json` config file support and `--mode`, `--thinking-level`, `--config` CLI flags to mastracode's headless mode.

**Architecture:** New `headless-config.ts` module handles config file discovery, parsing, and validation. `headless.ts` gains three new CLI flags and a resolution pipeline that merges config + flags before applying model/thinking changes to the harness. All new code is pure functions tested in isolation.

**Tech Stack:** TypeScript, Node.js `fs`/`path`/`os`, `node:util` parseArgs, Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-headless-config-design.md`
**Decisions:** `docs/superpowers/specs/decisions.md`

---

## File Structure

| File                                                      | Responsibility                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Create:** `mastracode/src/headless-config.ts`           | `HeadlessConfig` type, `loadHeadlessConfig()` (discovery + parse + validate), path helpers                                                                           |
| **Create:** `mastracode/src/headless-config.test.ts`      | Unit tests for config loading, validation, discovery                                                                                                                 |
| **Modify:** `mastracode/src/headless.ts`                  | Add `--mode`, `--thinking-level`, `--config` to `HeadlessArgs` and `parseHeadlessArgs()`. Add resolution pipeline to `runHeadless()`. Update `printHeadlessUsage()`. |
| **Modify:** `mastracode/src/headless.test.ts`             | Unit tests for new arg parsing                                                                                                                                       |
| **Modify:** `mastracode/src/headless-integration.test.ts` | Integration tests for config + flag resolution, precedence, errors                                                                                                   |

---

### Task 1: Config file type and loading (`headless-config.ts`)

**Files:**

- Create: `mastracode/src/headless-config.ts`
- Create: `mastracode/src/headless-config.test.ts`

- [ ] **Step 1: Write failing tests for `loadHeadlessConfig()`**

Create `mastracode/src/headless-config.test.ts`:

```typescript
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'

import { loadHeadlessConfig, type HeadlessConfig } from './headless-config.js'

const tempDirs: string[] = []
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'headless-config-'))
  tempDirs.push(dir)
  return dir
}
afterAll(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true })
    } catch {}
  }
})

describe('loadHeadlessConfig', () => {
  it('returns empty config when no file exists', () => {
    const dir = makeTempDir()
    const config = loadHeadlessConfig({ projectDir: dir })
    expect(config).toEqual({})
  })

  it('loads project-level .mastracode/headless.json', () => {
    const dir = makeTempDir()
    const mcDir = join(dir, '.mastracode')
    mkdirSync(mcDir)
    writeFileSync(
      join(mcDir, 'headless.json'),
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
        preferences: { thinkingLevel: 'high' },
      }),
    )
    const config = loadHeadlessConfig({ projectDir: dir })
    expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5')
    expect(config.preferences?.thinkingLevel).toBe('high')
  })

  it('loads global ~/.mastracode/headless.json when no project config', () => {
    const projectDir = makeTempDir()
    const globalDir = makeTempDir()
    const mcDir = join(globalDir, '.mastracode')
    mkdirSync(mcDir)
    writeFileSync(
      join(mcDir, 'headless.json'),
      JSON.stringify({
        preferences: { yolo: true },
      }),
    )
    const config = loadHeadlessConfig({ projectDir, globalDir })
    expect(config.preferences?.yolo).toBe(true)
  })

  it('project config wins over global config (first-file-wins)', () => {
    const projectDir = makeTempDir()
    const globalDir = makeTempDir()
    mkdirSync(join(projectDir, '.mastracode'))
    mkdirSync(join(globalDir, '.mastracode'))
    writeFileSync(
      join(projectDir, '.mastracode', 'headless.json'),
      JSON.stringify({
        preferences: { thinkingLevel: 'high' },
      }),
    )
    writeFileSync(
      join(globalDir, '.mastracode', 'headless.json'),
      JSON.stringify({
        preferences: { thinkingLevel: 'low' },
      }),
    )
    const config = loadHeadlessConfig({ projectDir, globalDir })
    expect(config.preferences?.thinkingLevel).toBe('high')
  })

  it('loads explicit config path via configPath option', () => {
    const dir = makeTempDir()
    const filePath = join(dir, 'custom.json')
    writeFileSync(
      filePath,
      JSON.stringify({
        models: { modeDefaults: { fast: 'cerebras/zai-glm-4.7' } },
      }),
    )
    const config = loadHeadlessConfig({ configPath: filePath })
    expect(config.models?.modeDefaults?.fast).toBe('cerebras/zai-glm-4.7')
  })

  it('throws when explicit configPath does not exist', () => {
    expect(() => loadHeadlessConfig({ configPath: '/nonexistent/path.json' })).toThrow(
      'Config file not found: /nonexistent/path.json',
    )
  })

  it('throws when explicit configPath has invalid JSON', () => {
    const dir = makeTempDir()
    const filePath = join(dir, 'bad.json')
    writeFileSync(filePath, '{ not valid json }')
    expect(() => loadHeadlessConfig({ configPath: filePath })).toThrow('Failed to parse config file')
  })

  it('returns empty config when auto-discovered file has invalid JSON', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, '.mastracode'))
    writeFileSync(join(dir, '.mastracode', 'headless.json'), '{ broken }')
    const config = loadHeadlessConfig({ projectDir: dir })
    expect(config).toEqual({})
  })

  it('ignores unknown top-level keys', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, '.mastracode'))
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
        unknownField: 'should be ignored',
      }),
    )
    const config = loadHeadlessConfig({ projectDir: dir })
    expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5')
    expect((config as any).unknownField).toBeUndefined()
  })

  it('ignores invalid thinkingLevel values', () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, '.mastracode'))
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        preferences: { thinkingLevel: 'extreme' },
      }),
    )
    const config = loadHeadlessConfig({ projectDir: dir })
    expect(config.preferences?.thinkingLevel).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mastracode && pnpm vitest run src/headless-config.test.ts`
Expected: FAIL — module `./headless-config.js` not found

- [ ] **Step 3: Implement `headless-config.ts`**

Create `mastracode/src/headless-config.ts`:

```typescript
/**
 * Headless config file loading — discovery, parsing, and validation.
 *
 * Discovery order (first-file-wins, no deep merge):
 *   1. Explicit --config <path> (error if not found)
 *   2. .mastracode/headless.json (project-level)
 *   3. ~/.mastracode/headless.json (global-level)
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const VALID_MODES = ['build', 'plan', 'fast'] as const
const VALID_THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh'] as const

export type HeadlessMode = (typeof VALID_MODES)[number]
export type ThinkingLevel = (typeof VALID_THINKING_LEVELS)[number]

export interface HeadlessConfig {
  models?: {
    modeDefaults?: Partial<Record<HeadlessMode, string>>
  }
  preferences?: {
    thinkingLevel?: ThinkingLevel
    yolo?: boolean
  }
}

export function getProjectHeadlessConfigPath(projectDir: string): string {
  return path.join(projectDir, '.mastracode', 'headless.json')
}

export function getGlobalHeadlessConfigPath(globalDir?: string): string {
  const base = globalDir ?? os.homedir()
  return path.join(base, '.mastracode', 'headless.json')
}

interface LoadOptions {
  configPath?: string
  projectDir?: string
  globalDir?: string
}

/**
 * Load and validate headless config.
 *
 * - If configPath is provided, load only that file. Throws on missing/invalid.
 * - Otherwise auto-discover: project → global. Returns {} if none found.
 *   Auto-discovered files with parse errors are silently ignored.
 */
export function loadHeadlessConfig(opts: LoadOptions = {}): HeadlessConfig {
  if (opts.configPath) {
    return loadExplicit(opts.configPath)
  }
  return loadAutoDiscover(opts.projectDir, opts.globalDir)
}

function loadExplicit(filePath: string): HeadlessConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`)
  }
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    throw new Error(`Failed to read config file: ${(err as Error).message}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Failed to parse config file: ${(err as Error).message}`)
  }
  return validate(parsed)
}

function loadAutoDiscover(projectDir?: string, globalDir?: string): HeadlessConfig {
  const paths: string[] = []
  if (projectDir) paths.push(getProjectHeadlessConfigPath(projectDir))
  paths.push(getGlobalHeadlessConfigPath(globalDir))

  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, 'utf-8')
      const parsed = JSON.parse(raw)
      return validate(parsed)
    } catch {
      // Silent fail-through for auto-discovered files
      continue
    }
  }
  return {}
}

function validate(raw: unknown): HeadlessConfig {
  if (!raw || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>
  const config: HeadlessConfig = {}

  // Validate models.modeDefaults
  if (obj.models && typeof obj.models === 'object') {
    const models = obj.models as Record<string, unknown>
    if (models.modeDefaults && typeof models.modeDefaults === 'object') {
      const defaults = models.modeDefaults as Record<string, unknown>
      const modeDefaults: Partial<Record<HeadlessMode, string>> = {}
      for (const mode of VALID_MODES) {
        if (typeof defaults[mode] === 'string') {
          modeDefaults[mode] = defaults[mode] as string
        }
      }
      if (Object.keys(modeDefaults).length > 0) {
        config.models = { modeDefaults }
      }
    }
  }

  // Validate preferences
  if (obj.preferences && typeof obj.preferences === 'object') {
    const prefs = obj.preferences as Record<string, unknown>
    const preferences: HeadlessConfig['preferences'] = {}
    if (
      typeof prefs.thinkingLevel === 'string' &&
      (VALID_THINKING_LEVELS as readonly string[]).includes(prefs.thinkingLevel)
    ) {
      preferences.thinkingLevel = prefs.thinkingLevel as ThinkingLevel
    }
    if (typeof prefs.yolo === 'boolean') {
      preferences.yolo = prefs.yolo
    }
    if (Object.keys(preferences).length > 0) {
      config.preferences = preferences
    }
  }

  return config
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mastracode && pnpm vitest run src/headless-config.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add mastracode/src/headless-config.ts mastracode/src/headless-config.test.ts
git commit -m "feat(mastracode): add headless config file loading and validation"
```

---

### Task 2: Add new CLI flags to arg parsing (`headless.ts`)

**Files:**

- Modify: `mastracode/src/headless.ts:13-68` (HeadlessArgs, headlessOptions, parseHeadlessArgs)
- Modify: `mastracode/src/headless.test.ts`

- [ ] **Step 1: Write failing tests for new flags**

Add to `mastracode/src/headless.test.ts`, inside the `parseHeadlessArgs` describe block, after the existing `--model` tests:

```typescript
it('parses --mode with value', () => {
  const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--mode', 'fast'])
  expect(args.mode).toBe('fast')
})

it('throws on invalid --mode value', () => {
  expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--mode', 'turbo'])).toThrow(
    '--mode must be "build", "plan", or "fast"',
  )
})

it('returns undefined mode when not provided', () => {
  const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task'])
  expect(args.mode).toBeUndefined()
})

it('parses --thinking-level with value', () => {
  const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--thinking-level', 'high'])
  expect(args.thinkingLevel).toBe('high')
})

it('throws on invalid --thinking-level value', () => {
  expect(() => parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--thinking-level', 'extreme'])).toThrow(
    '--thinking-level must be',
  )
})

it('returns undefined thinkingLevel when not provided', () => {
  const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task'])
  expect(args.thinkingLevel).toBeUndefined()
})

it('parses --config with path', () => {
  const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task', '--config', './my-config.json'])
  expect(args.config).toBe('./my-config.json')
})

it('returns undefined config when not provided', () => {
  const args = parseHeadlessArgs(['node', 'main.js', '-p', 'task'])
  expect(args.config).toBeUndefined()
})

it('parses all flags together including new ones', () => {
  const args = parseHeadlessArgs([
    'node',
    'main.js',
    '--prompt',
    'Run tests',
    '--continue',
    '--timeout',
    '600',
    '--format',
    'json',
    '--model',
    'anthropic/claude-sonnet-4-20250514',
    '--mode',
    'build',
    '--thinking-level',
    'medium',
    '--config',
    './ci.json',
  ])
  expect(args.prompt).toBe('Run tests')
  expect(args.continue_).toBe(true)
  expect(args.timeout).toBe(600)
  expect(args.format).toBe('json')
  expect(args.model).toBe('anthropic/claude-sonnet-4-20250514')
  expect(args.mode).toBe('build')
  expect(args.thinkingLevel).toBe('medium')
  expect(args.config).toBe('./ci.json')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mastracode && pnpm vitest run src/headless.test.ts`
Expected: FAIL — `args.mode`, `args.thinkingLevel`, `args.config` are undefined / no validation throws

- [ ] **Step 3: Update `HeadlessArgs` interface and `parseHeadlessArgs()`**

In `mastracode/src/headless.ts`, update the interface (around line 13):

```typescript
export interface HeadlessArgs {
  prompt?: string
  timeout?: number
  format: 'default' | 'json'
  continue_: boolean
  model?: string
  mode?: 'build' | 'plan' | 'fast'
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh'
  config?: string
}
```

Add to `headlessOptions` (around line 26):

```typescript
const headlessOptions = {
  prompt: { type: 'string', short: 'p' },
  continue: { type: 'boolean', short: 'c', default: false },
  timeout: { type: 'string' },
  format: { type: 'string', default: 'default' },
  model: { type: 'string', short: 'm' },
  mode: { type: 'string' },
  'thinking-level': { type: 'string' },
  config: { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
} as const
```

Add validation and extraction in `parseHeadlessArgs()`, after the existing `model` extraction (around line 60):

```typescript
const model = typeof values.model === 'string' ? values.model : undefined

let mode: HeadlessArgs['mode']
if (values.mode !== undefined) {
  const raw = String(values.mode)
  if (raw !== 'build' && raw !== 'plan' && raw !== 'fast') {
    throw new Error('--mode must be "build", "plan", or "fast"')
  }
  mode = raw
}

let thinkingLevel: HeadlessArgs['thinkingLevel']
if (values['thinking-level'] !== undefined) {
  const raw = String(values['thinking-level'])
  const valid = ['off', 'low', 'medium', 'high', 'xhigh']
  if (!valid.includes(raw)) {
    throw new Error('--thinking-level must be "off", "low", "medium", "high", or "xhigh"')
  }
  thinkingLevel = raw as HeadlessArgs['thinkingLevel']
}

const config = typeof values.config === 'string' ? values.config : undefined

return {
  prompt,
  timeout,
  format: format as 'default' | 'json',
  continue_: Boolean(values.continue),
  model,
  mode,
  thinkingLevel,
  config,
}
```

Also update the JSDoc on `parseHeadlessArgs` to mention the new flags:

```typescript
/** Parse CLI arguments for headless mode (--prompt, --timeout, --format, --continue, --model, --mode, --thinking-level, --config). */
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mastracode && pnpm vitest run src/headless.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add mastracode/src/headless.ts mastracode/src/headless.test.ts
git commit -m "feat(mastracode): add --mode, --thinking-level, --config flag parsing"
```

---

### Task 3: Update help output (`headless.ts`)

**Files:**

- Modify: `mastracode/src/headless.ts:76-101` (printHeadlessUsage)

- [ ] **Step 1: Update `printHeadlessUsage()`**

Replace the `printHeadlessUsage` function body in `mastracode/src/headless.ts`:

```typescript
export function printHeadlessUsage(): void {
  process.stdout.write(`
Usage: mastracode --prompt <text> [options]

Headless (non-interactive) mode options:
  --prompt, -p <text>           The task to execute (required, or pipe via stdin)
  --continue, -c                Resume the most recent thread instead of creating a new one
  --timeout <seconds>           Exit with code 2 if not complete within timeout
  --format <type>               Output format: "default" or "json" (default: "default")
  --model, -m <id>              Model override (e.g., "anthropic/claude-sonnet-4-5")
  --mode {build|plan|fast}      Execution mode (uses that mode's configured model)
  --thinking-level <level>      Thinking level: off, low, medium, high, xhigh
  --config <path>               Path to headless config file (default: .mastracode/headless.json)

Config file:
  Place a headless.json in .mastracode/ (project) or ~/.mastracode/ (global):
  {
    "models": { "modeDefaults": { "build": "anthropic/claude-sonnet-4-5" } },
    "preferences": { "thinkingLevel": "medium", "yolo": true }
  }

Exit codes:
  0  Agent completed successfully
  1  Error or aborted
  2  Timeout

Examples:
  mastracode --prompt "Fix the bug in auth.ts"
  mastracode --prompt "Add tests" --timeout 300
  mastracode --prompt "Fix the bug" --mode fast --thinking-level high
  mastracode --config ./ci.json --prompt "Run tests"
  mastracode -c --prompt "Continue where you left off"
  mastracode --prompt "Refactor utils" --format json
  echo "task description" | mastracode --prompt -

Run without --prompt for the interactive TUI.
`)
}
```

- [ ] **Step 2: Commit**

```bash
git add mastracode/src/headless.ts
git commit -m "docs(mastracode): update headless --help with new flags and config file example"
```

---

### Task 4: Resolution pipeline in `runHeadless()` (`headless.ts`)

**Files:**

- Modify: `mastracode/src/headless.ts:188-274` (runHeadless function)

- [ ] **Step 1: Add import for `loadHeadlessConfig`**

At the top of `mastracode/src/headless.ts`, add after the existing local imports (around line 11):

```typescript
import { loadHeadlessConfig } from './headless-config.js'
```

- [ ] **Step 2: Replace the model pre-flight block with full resolution pipeline**

In `runHeadless()`, replace the existing model validation block (lines 228-240) and add config loading + thinking level. The full pre-flight section after `failEarly` and the `--continue` block should become:

```typescript
// --- Load config file ---
let config: import('./headless-config.js').HeadlessConfig = {}
try {
  config = loadHeadlessConfig({
    configPath: args.config,
    projectDir: process.cwd(),
  })
} catch (err) {
  return failEarly((err as Error).message)
}

// --- Resolve model ---
if (args.model && args.mode) {
  process.stderr.write('Warning: --model overrides --mode, ignoring --mode\n')
}

if (args.model) {
  // Highest priority: explicit --model flag
  const available = await harness.listAvailableModels()
  const match = available.find(m => m.id === args.model)
  if (!match) {
    return failEarly(`Unknown model: "${args.model}"`)
  }
  if (!match.hasApiKey) {
    const keyHint = match.apiKeyEnvVar ? ` Set ${match.apiKeyEnvVar} to use this model.` : ''
    return failEarly(`Model "${args.model}" has no API key configured.${keyHint}`)
  }
  await harness.switchModel({ modelId: args.model })
  if (!emit) process.stderr.write(`[model] ${args.model}\n`)
} else {
  // Resolve from --mode or config modeDefaults
  const mode = args.mode ?? 'build'
  const modelId = config.models?.modeDefaults?.[mode]
  if (modelId) {
    const available = await harness.listAvailableModels()
    const match = available.find(m => m.id === modelId)
    if (!match) {
      return failEarly(`Unknown model "${modelId}" configured for mode "${mode}"`)
    }
    if (!match.hasApiKey) {
      const keyHint = match.apiKeyEnvVar ? ` Set ${match.apiKeyEnvVar} to use this model.` : ''
      return failEarly(`Model "${modelId}" (mode: ${mode}) has no API key configured.${keyHint}`)
    }
    await harness.switchModel({ modelId })
    if (!emit) process.stderr.write(`[model] ${modelId} (mode: ${mode})\n`)
  }
  // If no modelId from config, fall through to harness default — no action needed
}

// --- Resolve thinking level ---
const thinkingLevel = args.thinkingLevel ?? config.preferences?.thinkingLevel
if (thinkingLevel) {
  await harness.setState({ thinkingLevel } as any)
  if (!emit) process.stderr.write(`[thinking] ${thinkingLevel}\n`)
}

// --- Resolve yolo from config (flag already handled at harness init) ---
if (config.preferences?.yolo !== undefined) {
  await harness.setState({ yolo: config.preferences.yolo } as any)
}
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `cd mastracode && pnpm vitest run src/headless.test.ts src/headless-config.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add mastracode/src/headless.ts
git commit -m "feat(mastracode): add config loading and resolution pipeline to runHeadless"
```

---

### Task 5: Integration tests for config + flag resolution

**Files:**

- Modify: `mastracode/src/headless-integration.test.ts`

- [ ] **Step 1: Write integration tests for config file loading**

Add a new describe block at the end of `mastracode/src/headless-integration.test.ts`. This reuses the existing `createHarnessWithModels` helper and `tempStorePaths` cleanup from the `--model flag` describe block. Add these tests after the existing `--model flag` describe:

```typescript
describe('headless mode — config file', () => {
  function createHarnessWithModels(opts: {
    doStream: () => Promise<{ stream: ReadableStream }>
    customModels?: { id: string; provider: string; modelName: string; hasApiKey: boolean; apiKeyEnvVar?: string }[]
  }) {
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: new MastraLanguageModelV2Mock({ doStream: opts.doStream }) as any,
      tools: {},
    })

    const tempDir = mkdtempSync(join(tmpdir(), 'mastracode-headless-config-'))
    const storePath = join(tempDir, 'test.db')
    tempStorePaths.push(storePath, tempDir)

    const storage = new LibSQLStore({
      id: 'test-store',
      url: `file:${storePath}`,
    })

    const harness = new Harness({
      id: 'test-harness',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: true } as any,
      customModelCatalogProvider: () =>
        (opts.customModels ?? []).map(m => ({
          ...m,
          useCount: 0,
        })),
    })

    return harness
  }

  it('loads config file via --config and switches model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
      ],
    })

    await harness.init()
    await harness.selectOrCreateThread()

    // Write a temp config file
    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'))
    tempStorePaths.push(configDir)
    const configPath = join(configDir, 'headless.json')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
      }),
    )

    const events: HarnessEvent[] = []
    harness.subscribe(event => events.push(event))

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
    })

    expect(exitCode).toBe(0)
    const modelChanged = events.find(e => e.type === 'model_changed') as any
    expect(modelChanged).toBeDefined()
    expect(modelChanged.modelId).toBe('anthropic/claude-sonnet-4-5')
  })

  it('--model flag overrides config file model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', modelName: 'claude-haiku-4-5', hasApiKey: true },
        { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
      ],
    })

    await harness.init()
    await harness.selectOrCreateThread()

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'))
    tempStorePaths.push(configDir)
    const configPath = join(configDir, 'headless.json')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
      }),
    )

    const events: HarnessEvent[] = []
    harness.subscribe(event => events.push(event))

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      model: 'anthropic/claude-haiku-4-5',
      config: configPath,
    })

    expect(exitCode).toBe(0)
    // --model wins over config
    expect(harness.getCurrentModelId()).toBe('anthropic/claude-haiku-4-5')
  })

  it('--mode selects model from config modeDefaults', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [{ id: 'cerebras/zai-glm-4.7', provider: 'cerebras', modelName: 'zai-glm-4.7', hasApiKey: true }],
    })

    await harness.init()
    await harness.selectOrCreateThread()

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'))
    tempStorePaths.push(configDir)
    const configPath = join(configDir, 'headless.json')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { fast: 'cerebras/zai-glm-4.7' } },
      }),
    )

    const events: HarnessEvent[] = []
    harness.subscribe(event => events.push(event))

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      mode: 'fast',
      config: configPath,
    })

    expect(exitCode).toBe(0)
    expect(harness.getCurrentModelId()).toBe('cerebras/zai-glm-4.7')
  })

  it('returns exit code 1 for missing --config path', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
    })

    await harness.init()
    await harness.selectOrCreateThread()

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: '/nonexistent/headless.json',
    })

    expect(exitCode).toBe(1)
  })

  it('returns exit code 1 when config references unknown model', async () => {
    const harness = createHarnessWithModels({
      doStream: async () => ({ stream: createTextStream('Response') }),
      customModels: [],
    })

    await harness.init()
    await harness.selectOrCreateThread()

    const configDir = mkdtempSync(join(tmpdir(), 'headless-cfg-'))
    tempStorePaths.push(configDir)
    const configPath = join(configDir, 'headless.json')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(
      configPath,
      JSON.stringify({
        models: { modeDefaults: { build: 'nonexistent/model' } },
      }),
    )

    const exitCode = await runHeadless(harness, {
      prompt: 'Hello',
      format: 'default',
      continue_: false,
      config: configPath,
    })

    expect(exitCode).toBe(1)
  })
})
```

- [ ] **Step 2: Run integration tests**

Run: `cd mastracode && pnpm vitest run src/headless-integration.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 3: Commit**

```bash
git add mastracode/src/headless-integration.test.ts
git commit -m "test(mastracode): add integration tests for headless config file and flag resolution"
```

---

### Task 6: Update `headlessMain()` to pass config through

**Files:**

- Modify: `mastracode/src/headless.ts:276-328` (headlessMain function)

- [ ] **Step 1: Update `headlessMain()` to handle config errors at parse time**

The existing `headlessMain()` calls `parseHeadlessArgs()` which now validates `--mode` and `--thinking-level`. The `--config` path is just passed through as a string — actual loading happens in `runHeadless()`. No changes needed to `headlessMain()` beyond what `parseHeadlessArgs()` already provides, since the new fields are part of `HeadlessArgs` and get spread into `runHeadless()` via `{ ...args, prompt }`.

Verify this by reading the code — the spread at line 321 (`await runHeadless(harness, { ...args, prompt })`) already passes all `HeadlessArgs` fields through, including the new `mode`, `thinkingLevel`, and `config`.

- [ ] **Step 2: Run full test suite**

Run: `cd mastracode && pnpm vitest run src/headless.test.ts src/headless-config.test.ts src/headless-integration.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit (if any changes were needed)**

Only commit if Step 1 revealed changes were needed. If the spread already handles it, skip this commit.

---

### Task 7: Final verification and changeset

**Files:**

- Modify: `.changeset/sixty-cloths-feel.md` (or create new changeset)

- [ ] **Step 1: Run full build**

Run: `cd mastracode && pnpm build`
Expected: Build succeeds with no type errors

- [ ] **Step 2: Run all headless tests together**

Run: `cd mastracode && pnpm vitest run src/headless.test.ts src/headless-config.test.ts src/headless-integration.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Update changeset**

Update `.changeset/sixty-cloths-feel.md` to reflect the full scope:

```markdown
---
'mastracode': minor
---

Added headless config file support (`.mastracode/headless.json`) and new CLI flags (`--mode`, `--thinking-level`, `--config`) to headless mode. Users can configure model selection per execution mode (build/plan/fast), thinking level, and yolo preference via a checked-in config file or CLI flags. Flags override config file values. See `mastracode --help` for details.
```

- [ ] **Step 4: Commit**

```bash
git add .changeset/sixty-cloths-feel.md
git commit -m "chore(mastracode): update changeset for headless config file support"
```
