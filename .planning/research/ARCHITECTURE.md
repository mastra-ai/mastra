# Architecture Patterns

**Domain:** Browser toolset for AI agents
**Researched:** 2026-01-26

## Recommended Architecture

```
+------------------+     +-------------------+     +------------------+
|   Mastra Agent   |---->|  Browser Toolset  |---->|  agent-browser   |
|                  |     |   (Integration)   |     |  BrowserManager  |
+------------------+     +-------------------+     +------------------+
                                 |
                                 v
                    +------------------------+
                    |    Individual Tools    |
                    +------------------------+
                    | - navigate            |
                    | - snapshot            |
                    | - click               |
                    | - type                |
                    | - scroll              |
                    | - screenshot          |
                    +------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `BrowserToolset` | Tool collection, lifecycle management, browser instance ownership | Mastra Agent (via tools interface), BrowserManager |
| `BrowserManager` | Browser automation, Playwright wrapper, accessibility tree generation | Toolset methods, underlying Chromium |
| Individual Tools | Single-purpose browser operations with Zod schemas | Toolset (shared browser), Agent (via tool calls) |
| Element Refs Registry | Maps `@e1`, `@e2` etc. to DOM elements within snapshot scope | Snapshot (generates), interaction tools (consume) |

### Data Flow

**Agent-to-Browser Flow:**

```
1. Agent receives task requiring web interaction
2. Agent calls navigate tool with URL
3. Toolset ensures browser is launched (lazy init)
4. BrowserManager navigates to URL
5. Agent calls snapshot tool
6. Snapshot returns accessibility tree with refs (@e1, @e2, etc.)
7. Agent reasons about page structure
8. Agent calls click/type with ref identifier
9. Toolset resolves ref to DOM element
10. BrowserManager executes action
```

**Ref Lifecycle:**

```
snapshot() → generates fresh refs → refs valid until next snapshot
click(@e5) → uses current refs → action executed
snapshot() → invalidates old refs → new refs generated
```

**Key insight:** Refs are snapshot-scoped. Each snapshot invalidates previous refs.

## Component Details

### 1. BrowserToolset Class

```typescript
class BrowserToolset {
  readonly name = 'agent-browser';
  private browserManager: BrowserManager | null = null;
  private currentRefs: Map<string, ElementHandle> = new Map();

  // Lazy initialization
  private async ensureBrowser(): Promise<BrowserManager> {
    if (!this.browserManager) {
      this.browserManager = new BrowserManager();
      await this.browserManager.launch({ headless: true });
    }
    return this.browserManager;
  }

  readonly tools = {
    navigate: createTool({ ... }),
    snapshot: createTool({ ... }),
    click: createTool({ ... }),
    type: createTool({ ... }),
    scroll: createTool({ ... }),
    screenshot: createTool({ ... }),
  };

  async close(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
    }
    this.currentRefs.clear();
  }
}
```

### 2. Tool Schemas

**Navigate:**
```typescript
inputSchema: z.object({
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load'),
})
```

**Snapshot:**
```typescript
inputSchema: z.object({
  interactiveOnly: z.boolean().optional().default(true),
  maxDepth: z.number().optional(),
})
outputSchema: z.object({
  tree: z.string(),
  refs: z.record(z.string(), z.object({
    role: z.string(),
    name: z.string().optional(),
  })),
  elementCount: z.number(),
})
```

**Click:**
```typescript
inputSchema: z.object({
  ref: z.string().regex(/^@e\d+$/),
  button: z.enum(['left', 'right', 'middle']).optional().default('left'),
})
```

## Patterns to Follow

### Pattern 1: Lazy Browser Initialization
Browser instance created on first tool use, not at toolset construction.

### Pattern 2: Ref-Based Element Targeting
Use accessibility refs (`@e1`) instead of CSS selectors. Refs are deterministic within snapshot scope.

### Pattern 3: Snapshot-Before-Act
Always capture fresh snapshot before interactions. Refs become stale after DOM changes.

### Pattern 4: Tool Independence
Each tool callable independently. Navigate handles "no browser" case. Click handles "no snapshot taken" case.

### Pattern 5: Structured Error Returns
Return error information in output schema, don't throw for recoverable errors.

## Anti-Patterns to Avoid

1. **CSS Selector Exposure** - Selectors are brittle, LLMs hallucinate invalid selectors
2. **Browser Instance Per Tool Call** - Extremely slow, loses session state
3. **Unscoped Refs** - Refs must be cleared on every snapshot
4. **Raw DOM Dump** - Too many tokens, hard for LLM to parse

## Build Order Dependencies

```
1. BrowserToolset skeleton
   └── Lazy browser initialization
   └── Close/cleanup method

2. navigate tool
   └── Triggers browser launch

3. snapshot tool
   └── Ref generation
   └── Ref registry management

4. click tool (depends on snapshot)
5. type tool (depends on snapshot)
6. scroll tool
7. screenshot tool
```

## File Structure

```
integrations/agent-browser/
├── src/
│   ├── index.ts
│   ├── toolset.ts
│   ├── types.ts
│   ├── tools/
│   │   ├── navigate.ts
│   │   ├── snapshot.ts
│   │   ├── click.ts
│   │   ├── type.ts
│   │   ├── scroll.ts
│   │   └── screenshot.ts
│   └── __tests__/
├── package.json
└── README.md
```

---

*Architecture research: 2026-01-26*
