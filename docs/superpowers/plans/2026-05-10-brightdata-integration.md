# `@mastra/brightdata` Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `@mastra/brightdata` package at `integrations/brightdata/` exposing `web-search` and `web-fetch` Mastra agent tools backed by `@brightdata/sdk`.

**Architecture:** Mirrors `integrations/tavily/` structure 1:1. A small `client.ts` lazily wraps `@brightdata/sdk`'s `bdclient`. Two tool factories (`search.ts`, `fetch.ts`) each call the SDK and project the response into a stable Mastra output schema. A `tools.ts` bundle returns both tools together. Tests mock `@brightdata/sdk` at the module level (matches Tavily's testing pattern).

**Tech Stack:** TypeScript, Mastra `createTool`, Zod, `@brightdata/sdk` v1.1.0+, vitest, tsup, pnpm workspaces.

**Spec:** [docs/superpowers/specs/2026-05-10-brightdata-integration-design.md](../specs/2026-05-10-brightdata-integration-design.md)

**Reference files (read-only):**
- `integrations/tavily/` — structural template
- `/home/meirk/brightdata-mcp-sse/server.js:560-656` — MCP source for `search_engine` and `scrape_as_markdown`
- `/home/meirk/brightdata-mcp-sse/server.js:1082-1110` — `clean_google_search_payload` (defines parsed Google shape)

---

## File Structure

Files this plan creates (all under `integrations/brightdata/`):

| File | Responsibility |
|---|---|
| `package.json` | Package metadata, deps, build scripts |
| `tsconfig.json` | TS config, extends repo root |
| `tsconfig.build.json` | Build TS config |
| `tsup.config.ts` | Bundler config |
| `vitest.config.ts` | Test runner config |
| `turbo.json` | Turborepo task definitions |
| `eslint.config.js` | Lint config |
| `CHANGELOG.md` | Empty stub, populated by changesets |
| `README.md` | Public-facing docs |
| `src/index.ts` | Barrel exports |
| `src/client.ts` | `getBrightDataClient` + types |
| `src/search.ts` | `createBrightDataSearchTool` (id `web-search`) |
| `src/fetch.ts` | `createBrightDataFetchTool` (id `web-fetch`) |
| `src/tools.ts` | `createBrightDataTools` bundle |
| `src/__tests__/client.test.ts` | client tests |
| `src/__tests__/search.test.ts` | search tool tests |
| `src/__tests__/fetch.test.ts` | fetch tool tests |
| `src/__tests__/tools.test.ts` | bundle tests |

Plus one changeset file generated via the CLI.

---

## Task 1: Scaffold package config files

**Files:**
- Create: `integrations/brightdata/package.json`
- Create: `integrations/brightdata/tsconfig.json`
- Create: `integrations/brightdata/tsconfig.build.json`
- Create: `integrations/brightdata/tsup.config.ts`
- Create: `integrations/brightdata/vitest.config.ts`
- Create: `integrations/brightdata/turbo.json`
- Create: `integrations/brightdata/eslint.config.js`
- Create: `integrations/brightdata/CHANGELOG.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@mastra/brightdata",
  "version": "0.1.0",
  "description": "Bright Data web search and web fetch tools for Mastra agents",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "CHANGELOG.md"
  ],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build:watch": "pnpm build:lib --watch",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "keywords": [
    "mastra",
    "brightdata",
    "web-search",
    "web-fetch",
    "tools",
    "ai-agent"
  ],
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mastra-ai/mastra.git",
    "directory": "integrations/brightdata"
  },
  "bugs": {
    "url": "https://github.com/mastra-ai/mastra/issues"
  },
  "homepage": "https://mastra.ai",
  "engines": {
    "node": ">=22.13.0"
  },
  "dependencies": {
    "@brightdata/sdk": "^1.1.0"
  },
  "peerDependencies": {
    "@mastra/core": ">=1.0.0-0 <2.0.0-0",
    "zod": ">=3.0.0 || >=4.0.0"
  },
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/core": "workspace:*",
    "tsup": "^8.5.1",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "zod": "catalog:"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.node.json",
  "include": ["src/**/*", "tsup.config.ts"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": ["./tsconfig.json", "../../tsconfig.build.json"],
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 4: Create `tsup.config.ts`**

```ts
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/brightdata',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tasks": {
    "build:lib": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "tsup.config.ts",
        "tsconfig.json",
        "package.json",
        "!**/*.md",
        "!**/*.test.ts",
        "!**/*.spec.ts",
        "!**/__tests__/**"
      ],
      "outputs": ["dist/**"]
    },
    "build": {
      "dependsOn": ["build:lib"],
      "inputs": ["package.json"]
    }
  }
}
```

- [ ] **Step 7: Create `eslint.config.js`**

```js
import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [...config];
```

- [ ] **Step 8: Create empty `CHANGELOG.md`**

```markdown
# @mastra/brightdata
```

- [ ] **Step 9: Install workspace dependency**

Run: `pnpm install` from repo root.

Expected: Lockfile updates and `@brightdata/sdk` is installed under `integrations/brightdata/node_modules`.

If install reports peer warnings about `@mastra/core` or `zod`, that's expected (those are peer deps).

- [ ] **Step 10: Commit**

```bash
git add integrations/brightdata/package.json integrations/brightdata/tsconfig.json integrations/brightdata/tsconfig.build.json integrations/brightdata/tsup.config.ts integrations/brightdata/vitest.config.ts integrations/brightdata/turbo.json integrations/brightdata/eslint.config.js integrations/brightdata/CHANGELOG.md pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(brightdata): scaffold @mastra/brightdata package

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `client.ts` — `getBrightDataClient`

**Files:**
- Create: `integrations/brightdata/src/client.ts`
- Create: `integrations/brightdata/src/__tests__/client.test.ts`

- [ ] **Step 1: Write failing test**

Create `integrations/brightdata/src/__tests__/client.test.ts`:

```ts
import { bdclient } from '@brightdata/sdk';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBrightDataClient } from '../client.js';

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn().mockImplementation(() => ({
    search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
    scrapeUrl: vi.fn(),
  })),
}));

describe('getBrightDataClient', () => {
  const originalEnv = process.env.BRIGHTDATA_API_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BRIGHTDATA_API_TOKEN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BRIGHTDATA_API_TOKEN = originalEnv;
    } else {
      delete process.env.BRIGHTDATA_API_TOKEN;
    }
  });

  it('should throw if no API token is provided and env var is not set', () => {
    expect(() => getBrightDataClient()).toThrow('Bright Data API token is required');
  });

  it('should use the API key from config', () => {
    getBrightDataClient({ apiKey: 'test-key-123' });
    expect(bdclient).toHaveBeenCalledWith({ apiKey: 'test-key-123' });
  });

  it('should fall back to BRIGHTDATA_API_TOKEN env var', () => {
    process.env.BRIGHTDATA_API_TOKEN = 'env-key-456';
    getBrightDataClient();
    expect(bdclient).toHaveBeenCalledWith({ apiKey: 'env-key-456' });
  });

  it('should prefer config.apiKey over env var', () => {
    process.env.BRIGHTDATA_API_TOKEN = 'env-key-456';
    getBrightDataClient({ apiKey: 'config-key-789' });
    expect(bdclient).toHaveBeenCalledWith({ apiKey: 'config-key-789' });
  });

  it('should pass through additional options', () => {
    getBrightDataClient({ apiKey: 'test-key', timeout: 60000, webUnlockerZone: 'my_zone' });
    expect(bdclient).toHaveBeenCalledWith({
      apiKey: 'test-key',
      timeout: 60000,
      webUnlockerZone: 'my_zone',
    });
  });

  it('should return a client object', () => {
    const client = getBrightDataClient({ apiKey: 'test-key' });
    expect(client).toBeDefined();
    expect(client.search).toBeDefined();
    expect(client.scrapeUrl).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: FAIL with "Cannot find module '../client.js'" (or equivalent — file doesn't exist yet).

- [ ] **Step 3: Implement `src/client.ts`**

```ts
import { bdclient } from '@brightdata/sdk';

export type BrightDataClientOptions = ConstructorParameters<typeof bdclient>[0];
export type BrightDataClient = bdclient;

export function getBrightDataClient(config?: BrightDataClientOptions): BrightDataClient {
  const apiKey = config?.apiKey ?? process.env.BRIGHTDATA_API_TOKEN;
  if (!apiKey) {
    throw new Error(
      'Bright Data API token is required. Pass { apiKey } or set BRIGHTDATA_API_TOKEN env var.',
    );
  }
  return new bdclient({ ...config, apiKey });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: 6 tests in `client.test.ts` PASS.

If TypeScript complains that `BrightDataClient = bdclient` doesn't work because `bdclient` is a value not a type, change the type alias to:
```ts
export type BrightDataClient = InstanceType<typeof bdclient>;
```

- [ ] **Step 5: Commit**

```bash
git add integrations/brightdata/src/client.ts integrations/brightdata/src/__tests__/client.test.ts
git commit -m "$(cat <<'EOF'
feat(brightdata): add getBrightDataClient with env fallback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `search.ts` — `web-search` tool

**Files:**
- Create: `integrations/brightdata/src/search.ts`
- Create: `integrations/brightdata/src/__tests__/search.test.ts`

- [ ] **Step 1: Write failing test**

Create `integrations/brightdata/src/__tests__/search.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGoogle = vi.fn();

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn().mockImplementation(() => ({
    search: { google: mockGoogle, bing: vi.fn(), yandex: vi.fn() },
    scrapeUrl: vi.fn(),
  })),
}));

import { createBrightDataSearchTool } from '../search.js';

describe('createBrightDataSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogle.mockResolvedValue({
      organic: [
        {
          link: 'https://example.com/a',
          title: 'Example A',
          description: 'A description',
        },
        {
          link: 'https://example.com/b',
          title: 'Example B',
          description: 'B description',
        },
      ],
      current_page: 2,
    });
  });

  it('should create a tool with id web-search', () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('web-search');
    expect(tool.description).toBeDefined();
    expect(tool.description!.length).toBeGreaterThan(0);
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.search.google with mapped parameters', async () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    const result = await tool.execute!(
      { query: 'pizza restaurants', country: 'us', cursor: 'abc' },
      {} as any,
    );

    expect(mockGoogle).toHaveBeenCalledWith('pizza restaurants', {
      country: 'us',
      cursor: 'abc',
    });

    expect(result).toEqual({
      query: 'pizza restaurants',
      results: [
        { link: 'https://example.com/a', title: 'Example A', description: 'A description' },
        { link: 'https://example.com/b', title: 'Example B', description: 'B description' },
      ],
      currentPage: 2,
    });
  });

  it('should handle minimal input (only query)', async () => {
    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await tool.execute!({ query: 'simple search' }, {} as any);

    expect(mockGoogle).toHaveBeenCalledWith('simple search', {
      country: undefined,
      cursor: undefined,
    });
  });

  it('should default to empty results when organic is missing', async () => {
    mockGoogle.mockResolvedValue({});

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([]);
    expect(result.currentPage).toBe(1);
  });

  it('should default currentPage to 1 when current_page is missing or non-positive', async () => {
    mockGoogle.mockResolvedValue({ organic: [], current_page: 0 });

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.currentPage).toBe(1);
  });

  it('should filter out organic entries missing link or title', async () => {
    mockGoogle.mockResolvedValue({
      organic: [
        { link: 'https://ok.example', title: 'Has both', description: 'ok' },
        { link: '', title: 'Missing link', description: 'x' },
        { link: 'https://nope.example', title: '', description: 'x' },
        null,
      ],
      current_page: 1,
    });

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });
    const result = (await tool.execute!({ query: 'test' }, {} as any)) as any;

    expect(result.results).toEqual([
      { link: 'https://ok.example', title: 'Has both', description: 'ok' },
    ]);
  });

  it('should let errors propagate', async () => {
    mockGoogle.mockRejectedValue(new Error('API rate limit exceeded'));

    const tool = createBrightDataSearchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ query: 'test' }, {} as any)).rejects.toThrow(
      'API rate limit exceeded',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: FAIL on `search.test.ts` (file `../search.js` not found).

- [ ] **Step 3: Implement `src/search.ts`**

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getBrightDataClient } from './client.js';
import type { BrightDataClient, BrightDataClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query'),
  country: z
    .string()
    .length(2)
    .optional()
    .describe('2-letter country code for geo-targeted results (e.g., "us", "gb")'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for the next page of results'),
});

const outputSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      link: z.string(),
      title: z.string(),
      description: z.string(),
    }),
  ),
  currentPage: z.number(),
});

export function createBrightDataSearchTool(config?: BrightDataClientOptions) {
  let client: BrightDataClient | null = null;

  function getClient(): BrightDataClient {
    if (!client) {
      client = getBrightDataClient(config);
    }
    return client;
  }

  return createTool({
    id: 'web-search',
    description:
      "Search Google and get back parsed organic results (link, title, description). Uses Bright Data's SERP API which bypasses bot detection. Supports country targeting and pagination.",
    inputSchema,
    outputSchema,
    execute: async input => {
      const brightDataClient = getClient();

      const response = (await brightDataClient.search.google(input.query, {
        country: input.country,
        cursor: input.cursor,
      })) as { organic?: unknown; current_page?: unknown };

      const organic = Array.isArray(response.organic) ? response.organic : [];
      const results = organic
        .map((entry: any) => {
          if (!entry || typeof entry !== 'object') return null;
          const link = typeof entry.link === 'string' ? entry.link.trim() : '';
          const title = typeof entry.title === 'string' ? entry.title.trim() : '';
          const description = typeof entry.description === 'string' ? entry.description.trim() : '';
          if (!link || !title) return null;
          return { link, title, description };
        })
        .filter((r): r is { link: string; title: string; description: string } => r !== null);

      const parsedPage = Number(response.current_page);
      const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

      return {
        query: input.query,
        results,
        currentPage,
      };
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: All `search.test.ts` tests PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add integrations/brightdata/src/search.ts integrations/brightdata/src/__tests__/search.test.ts
git commit -m "$(cat <<'EOF'
feat(brightdata): add web-search tool backed by Bright Data SERP

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `fetch.ts` — `web-fetch` tool

**Files:**
- Create: `integrations/brightdata/src/fetch.ts`
- Create: `integrations/brightdata/src/__tests__/fetch.test.ts`

- [ ] **Step 1: Write failing test**

Create `integrations/brightdata/src/__tests__/fetch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScrapeUrl = vi.fn();

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn().mockImplementation(() => ({
    search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
    scrapeUrl: mockScrapeUrl,
  })),
}));

import { createBrightDataFetchTool } from '../fetch.js';

describe('createBrightDataFetchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapeUrl.mockResolvedValue('# Example Page\n\nHello world.');
  });

  it('should create a tool with id web-fetch', () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });
    expect(tool.id).toBe('web-fetch');
    expect(tool.description).toBeDefined();
    expect(tool.description!.length).toBeGreaterThan(0);
  });

  it('should have inputSchema and outputSchema', () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call client.scrapeUrl with markdown dataFormat', async () => {
    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    const result = await tool.execute!({ url: 'https://example.com' }, {} as any);

    expect(mockScrapeUrl).toHaveBeenCalledWith('https://example.com', {
      dataFormat: 'markdown',
    });

    expect(result).toEqual({
      url: 'https://example.com',
      content: '# Example Page\n\nHello world.',
    });
  });

  it('should let errors propagate', async () => {
    mockScrapeUrl.mockRejectedValue(new Error('Network unreachable'));

    const tool = createBrightDataFetchTool({ apiKey: 'test-key' });

    await expect(tool.execute!({ url: 'https://example.com' }, {} as any)).rejects.toThrow(
      'Network unreachable',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: FAIL on `fetch.test.ts` (file `../fetch.js` not found).

- [ ] **Step 3: Implement `src/fetch.ts`**

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getBrightDataClient } from './client.js';
import type { BrightDataClient, BrightDataClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().url().describe('The URL to fetch'),
});

const outputSchema = z.object({
  url: z.string(),
  content: z.string().describe('Page content as markdown'),
});

export function createBrightDataFetchTool(config?: BrightDataClientOptions) {
  let client: BrightDataClient | null = null;

  function getClient(): BrightDataClient {
    if (!client) {
      client = getBrightDataClient(config);
    }
    return client;
  }

  return createTool({
    id: 'web-fetch',
    description:
      "Fetch a webpage and return its content as markdown. Uses Bright Data's Web Unlocker which bypasses bot detection and CAPTCHAs. Pass any URL, including pages that block normal scrapers.",
    inputSchema,
    outputSchema,
    execute: async input => {
      const brightDataClient = getClient();

      const content = (await brightDataClient.scrapeUrl(input.url, {
        dataFormat: 'markdown',
      })) as string;

      return {
        url: input.url,
        content,
      };
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: All `fetch.test.ts` tests PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add integrations/brightdata/src/fetch.ts integrations/brightdata/src/__tests__/fetch.test.ts
git commit -m "$(cat <<'EOF'
feat(brightdata): add web-fetch tool backed by Bright Data Web Unlocker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `tools.ts` — bundle factory

**Files:**
- Create: `integrations/brightdata/src/tools.ts`
- Create: `integrations/brightdata/src/__tests__/tools.test.ts`

- [ ] **Step 1: Write failing test**

Create `integrations/brightdata/src/__tests__/tools.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@brightdata/sdk', () => ({
  bdclient: vi.fn().mockImplementation(() => ({
    search: { google: vi.fn(), bing: vi.fn(), yandex: vi.fn() },
    scrapeUrl: vi.fn(),
  })),
}));

import { createBrightDataTools } from '../tools.js';

describe('createBrightDataTools', () => {
  it('should return both tools', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch).toBeDefined();
    expect(tools.webFetch).toBeDefined();
  });

  it('should create tools with correct ids', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch.id).toBe('web-search');
    expect(tools.webFetch.id).toBe('web-fetch');
  });

  it('should create tools that all have descriptions', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch.description).toBeTruthy();
    expect(tools.webFetch.description).toBeTruthy();
  });

  it('should create tools that all have input and output schemas', () => {
    const tools = createBrightDataTools({ apiKey: 'test-key' });

    expect(tools.webSearch.inputSchema).toBeDefined();
    expect(tools.webSearch.outputSchema).toBeDefined();
    expect(tools.webFetch.inputSchema).toBeDefined();
    expect(tools.webFetch.outputSchema).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: FAIL on `tools.test.ts` (file `../tools.js` not found).

- [ ] **Step 3: Implement `src/tools.ts`**

```ts
import type { BrightDataClientOptions } from './client.js';
import { createBrightDataFetchTool } from './fetch.js';
import { createBrightDataSearchTool } from './search.js';

export function createBrightDataTools(config?: BrightDataClientOptions) {
  return {
    webSearch: createBrightDataSearchTool(config),
    webFetch: createBrightDataFetchTool(config),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: All `tools.test.ts` tests PASS (4 tests). All previous test files still pass.

- [ ] **Step 5: Commit**

```bash
git add integrations/brightdata/src/tools.ts integrations/brightdata/src/__tests__/tools.test.ts
git commit -m "$(cat <<'EOF'
feat(brightdata): add createBrightDataTools bundle factory

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `index.ts` barrel

**Files:**
- Create: `integrations/brightdata/src/index.ts`

- [ ] **Step 1: Create barrel**

```ts
export { getBrightDataClient, type BrightDataClientOptions, type BrightDataClient } from './client.js';
export { createBrightDataSearchTool } from './search.js';
export { createBrightDataFetchTool } from './fetch.js';
export { createBrightDataTools } from './tools.js';
```

- [ ] **Step 2: Build to verify exports compile**

Run: `pnpm --filter ./integrations/brightdata build:lib`
Expected: tsup builds `dist/index.js`, `dist/index.cjs`, and `dist/index.d.ts` with no TypeScript errors. Output should resemble Tavily's `dist/` layout.

If `generateTypes` fails because of missing internal toolchain state, run `pnpm install` from repo root once and retry.

- [ ] **Step 3: Run lint**

Run: `pnpm --filter ./integrations/brightdata lint`
Expected: No lint errors.

If there are import-order or unused-import warnings, fix them inline before continuing.

- [ ] **Step 4: Commit**

```bash
git add integrations/brightdata/src/index.ts
git commit -m "$(cat <<'EOF'
feat(brightdata): add public barrel exports

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: README

**Files:**
- Create: `integrations/brightdata/README.md`

- [ ] **Step 1: Write README**

```markdown
# @mastra/brightdata

[Bright Data](https://brightdata.com) web search and web fetch tools for [Mastra](https://mastra.ai) agents.

Backed by the official [`@brightdata/sdk`](https://github.com/brightdata/sdk-js). Bright Data's SERP API and Web Unlocker bypass bot detection and CAPTCHAs, so the tools work on sites that block typical scrapers.

## Installation

```bash
npm install @mastra/brightdata @brightdata/sdk zod
```

## Quick Start

Use `createBrightDataTools()` to get both tools with a shared configuration:

```typescript
import { Agent } from '@mastra/core/agent';
import { createBrightDataTools } from '@mastra/brightdata';

const tools = createBrightDataTools();
// Or pass an explicit API token:
// const tools = createBrightDataTools({ apiKey: 'brd_...' });

const agent = new Agent({
  id: 'realtime-information-agent',
  name: 'Realtime Information Agent',
  instructions:
    'You are a realtime information agent. Use web-search to find pages, and web-fetch to read them.',
  model: 'anthropic/claude-sonnet-4-6',
  tools,
});
```

By default the tools read `BRIGHTDATA_API_TOKEN` from your environment. You can also pass `{ apiKey }` explicitly.

## Individual Tools

Each tool can be created independently:

```typescript
import { createBrightDataSearchTool, createBrightDataFetchTool } from '@mastra/brightdata';

const search = createBrightDataSearchTool({ apiKey: 'brd_...' });
const fetch = createBrightDataFetchTool(); // uses BRIGHTDATA_API_TOKEN env var
```

### Web Search (`web-search`)

```typescript
import { createBrightDataSearchTool } from '@mastra/brightdata';

const searchTool = createBrightDataSearchTool();

// When called by an agent, accepts:
// - query (required)
// - country: 2-letter code (e.g., 'us', 'gb')
// - cursor: pagination cursor
//
// Returns:
// {
//   query: string,
//   results: Array<{ link, title, description }>,
//   currentPage: number
// }
```

### Web Fetch (`web-fetch`)

```typescript
import { createBrightDataFetchTool } from '@mastra/brightdata';

const fetchTool = createBrightDataFetchTool();

// Accepts: url (required)
// Returns: { url, content }  // content is markdown
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `process.env.BRIGHTDATA_API_TOKEN` | Your Bright Data API token |

All tools accept the full `BrightDataClientOptions` from `@brightdata/sdk` (including `timeout`, `webUnlockerZone`, `serpZone`, `rateLimit`, etc.). If no API token is found, the tool throws a clear error at execution time.

## RAG Pairing Example

Combine search and fetch for retrieval-augmented generation:

```typescript
import { Agent } from '@mastra/core/agent';
import { createBrightDataTools } from '@mastra/brightdata';

const agent = new Agent({
  id: 'rag-agent',
  name: 'Research Assistant',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: `You are a research assistant. Use web-search to find relevant pages, then use web-fetch to get full markdown content from the best results.`,
  tools: createBrightDataTools(),
});
```

## License

Apache-2.0
```

- [ ] **Step 2: Commit**

```bash
git add integrations/brightdata/README.md
git commit -m "$(cat <<'EOF'
docs(brightdata): add README with quick start and tool reference

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification + changeset

**Files:**
- Verify: full package
- Create: changeset file (via CLI)

- [ ] **Step 1: Run full package test suite**

Run: `pnpm --filter ./integrations/brightdata test`
Expected: All tests PASS across `client.test.ts` (6), `search.test.ts` (8), `fetch.test.ts` (4), `tools.test.ts` (4) — 22 tests total.

- [ ] **Step 2: Run lint**

Run: `pnpm --filter ./integrations/brightdata lint`
Expected: No errors.

- [ ] **Step 3: Run build**

Run: `pnpm --filter ./integrations/brightdata build:lib`
Expected: `dist/` populated with `index.js`, `index.cjs`, `index.d.ts`. No errors.

- [ ] **Step 4: Verify dist output**

Run: `ls integrations/brightdata/dist/`
Expected: `index.js`, `index.cjs`, `index.d.ts`, plus `.map` files. Matches the shape of `integrations/tavily/dist/`.

- [ ] **Step 5: Create changeset**

Run from repo root:

```bash
pnpm changeset -s -m "Added @mastra/brightdata integration with web-search and web-fetch tools backed by Bright Data's SERP API and Web Unlocker. The tools bypass bot detection and CAPTCHAs out of the box.

\`\`\`typescript
import { Agent } from '@mastra/core/agent';
import { createBrightDataTools } from '@mastra/brightdata';

const agent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Use web-search to find pages and web-fetch to read them.',
  tools: createBrightDataTools(),
});
\`\`\`

Set \`BRIGHTDATA_API_TOKEN\` in your environment, or pass \`{ apiKey }\` explicitly." --minor @mastra/brightdata
```

Expected: A new file appears under `.changeset/` with the package and message.

- [ ] **Step 6: Commit changeset**

```bash
git add .changeset/
git commit -m "$(cat <<'EOF'
chore(brightdata): add changeset for new integration package

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Final repo-wide sanity check**

Run from repo root:

```bash
git status
```

Expected: Working tree clean. All commits on `main` (or current feature branch).

---

## Spec coverage check

Cross-reference each section of the [design spec](../specs/2026-05-10-brightdata-integration-design.md):

| Spec section | Implemented in |
|---|---|
| Package layout | Task 1, Task 6 (index.ts) |
| Public API barrel | Task 6 |
| `getBrightDataClient` | Task 2 |
| `BrightDataClientOptions` / `BrightDataClient` types | Task 2 |
| `web-search` tool | Task 3 |
| `web-fetch` tool | Task 4 |
| `createBrightDataTools` bundle | Task 5 |
| Error propagation | Tasks 3, 4 (test cases) |
| Configuration table | Task 7 (README) |
| Tests (client/search/fetch/tools) | Tasks 2, 3, 4, 5 |
| `package.json` | Task 1 |
| README | Task 7 |
| Changeset | Task 8 |
