# Phase 1: Infrastructure - Research

**Researched:** 2026-01-26
**Domain:** Browser automation infrastructure with agent-browser and Mastra toolset patterns
**Confidence:** HIGH

## Summary

This phase establishes the foundational infrastructure for the BrowserToolset: a class that wraps agent-browser's BrowserManager and exposes tools via Mastra's `createTool` pattern. The primary challenges are lazy browser initialization, proper lifecycle management with cleanup, and timeout propagation through `context.abortSignal`.

The research confirms that agent-browser ^0.8.0 provides a `BrowserManager` class with `launch()` and programmatic navigation. Mastra tools receive an `abortSignal` in the execution context that should be used to cancel long-running operations. Playwright (underlying agent-browser) supports configurable timeouts and `waitUntil` options for navigation.

**Primary recommendation:** Implement BrowserToolset as a class with lazy initialization in `getBrowser()`, a `close()` cleanup method, and a navigate tool that respects 10-second timeouts using `domcontentloaded` as the default wait condition.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| agent-browser | ^0.8.0 | Browser automation for AI agents | Project requirement. BrowserManager class with AI-optimized abstractions. |
| @mastra/core | ^1.0.0 | Tool creation, execution context | Peer dependency. Provides `createTool`, `ToolAction`, `ToolExecutionContext`. |
| zod | ^3.25.0 | Schema validation | Mastra standard. All tool input/output schemas use zod. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright | (transitive) | Underlying browser engine | Not imported directly. agent-browser handles this. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| agent-browser | Playwright directly | Would lose AI-optimized refs and accessibility snapshots. Don't use. |
| agent-browser | Puppeteer | Different browser automation layer. Not compatible. Don't use. |

**Installation:**
```bash
pnpm add agent-browser@^0.8.0
pnpm add -D @mastra/core@^1.0.0
```

Note: `@mastra/core` is a peer dependency, installed by consumers.

## Architecture Patterns

### Recommended Project Structure
```
integrations/agent-browser/
  src/
    index.ts              # Exports BrowserToolset
    toolset.ts            # BrowserToolset class implementation
    types.ts              # TypeScript interfaces
    tools/
      navigate.ts         # Navigate tool (Phase 1)
  package.json
  tsconfig.json
```

### Pattern 1: Class-Based Toolset with Lazy Initialization
**What:** BrowserToolset class owns a BrowserManager instance, created lazily on first tool use.
**When to use:** Always for this integration. Browser launch is expensive (1-3 seconds).
**Example:**
```typescript
// Source: Mastra patterns from packages/core/src/integration/openapi-toolset.ts
import { createTool, ToolAction } from '@mastra/core';
import { BrowserManager } from 'agent-browser';

export class BrowserToolset {
  readonly name = 'agent-browser';
  private browserManager: BrowserManager | null = null;

  readonly tools: Record<string, ToolAction<any, any>> = {
    navigate: this.createNavigateTool(),
  };

  // Lazy initialization - browser starts on first tool use
  private async getBrowser(): Promise<BrowserManager> {
    if (!this.browserManager) {
      this.browserManager = new BrowserManager();
      await this.browserManager.launch({ headless: true });
    }
    return this.browserManager;
  }

  async close(): Promise<void> {
    if (this.browserManager) {
      // BrowserManager cleanup - implementation TBD based on API
      this.browserManager = null;
    }
  }

  private createNavigateTool(): ToolAction<any, any> {
    return createTool({
      id: 'navigate',
      description: 'Navigate the browser to a URL',
      inputSchema: z.object({
        url: z.string().url(),
        waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
      }),
      execute: async (input, context) => {
        const browser = await this.getBrowser();
        // ... implementation
      },
    });
  }
}
```

### Pattern 2: Tool Execute Signature
**What:** Tools receive `(inputData, context)` where context is `ToolExecutionContext`.
**When to use:** All tools.
**Example:**
```typescript
// Source: packages/core/src/tools/types.ts line 241
execute: async (inputData: { url: string; waitUntil?: string }, context: ToolExecutionContext) => {
  // context.abortSignal - for cancellation
  // context.mastra - for accessing Mastra instance
  // context.tracingContext - for observability
}
```

### Pattern 3: Timeout with AbortSignal Propagation
**What:** Use `context.abortSignal` to cancel browser operations on agent abort.
**When to use:** All long-running operations.
**Example:**
```typescript
// Source: Playwright docs + Mastra patterns
execute: async (input, context) => {
  const browser = await this.getBrowser();

  // Create timeout abort controller
  const timeoutMs = 10_000; // 10 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Link to context.abortSignal if provided
    if (context.abortSignal) {
      context.abortSignal.addEventListener('abort', () => controller.abort());
    }

    // Note: BrowserManager.navigate() may not accept AbortSignal directly
    // Use Playwright's timeout option instead
    await browser.navigate(input.url);
    // ...
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Anti-Patterns to Avoid
- **Eager browser initialization:** Don't launch browser in constructor. It's expensive and may not be needed.
- **Missing cleanup:** Always implement `close()` method. Browser instances leak memory.
- **networkidle as default:** Use `domcontentloaded` instead. SPA sites with websockets never reach networkidle.
- **Swallowing errors:** Return structured errors, don't hide failures.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom Playwright wrapper | agent-browser BrowserManager | Has AI-optimized accessibility refs |
| Tool creation | Manual tool objects | @mastra/core createTool | Handles validation, context organization |
| Schema validation | Manual type checking | zod schemas | Mastra standard, type inference |
| Timeout management | setTimeout without cleanup | try/finally with clearTimeout | Prevents memory leaks |

**Key insight:** agent-browser exists specifically for AI agents. Using Playwright directly would require rebuilding the accessibility ref system.

## Common Pitfalls

### Pitfall 1: Browser Instance Memory Leaks
**What goes wrong:** Browser instances accumulate without cleanup. Each Chromium instance consumes 100-500MB RAM.
**Why it happens:** Tool execution errors bypass cleanup code. No timeout enforcement.
**How to avoid:**
1. Implement try/finally pattern in ALL tool execute functions
2. Call `close()` method when toolset is no longer needed
3. Handle `context.abortSignal` to close browser on agent abort
**Warning signs:** Memory usage grows over time. Process eventually OOMs.

### Pitfall 2: Blocking Operations Without Timeouts
**What goes wrong:** navigate hangs indefinitely. Serverless function times out.
**Why it happens:** networkidle never settles on SPA sites with websockets. Default timeouts too long.
**How to avoid:**
1. Set 10-second default timeout for navigation
2. Use `domcontentloaded` not `networkidle` as default waitUntil
3. Include operation name in timeout error message
**Warning signs:** Agent calls take 30+ seconds. Lambda/Vercel timeouts.

### Pitfall 3: Error Messages Unhelpful for LLM
**What goes wrong:** Browser errors return stack traces. LLM can't understand or recover.
**Why it happens:** Default error handling exposes implementation details.
**How to avoid:**
1. Catch browser errors and return structured output
2. Include recovery hints in error response
3. Never expose stack traces to LLM
**Warning signs:** Agent retry loops without progress.

## Code Examples

Verified patterns from official sources:

### BrowserManager Basic Usage
```typescript
// Source: agent-browser npm docs + GitHub README
import { BrowserManager } from 'agent-browser';

const browser = new BrowserManager();
await browser.launch({ headless: true });
await browser.navigate('https://example.com');
```

### Mastra createTool Pattern
```typescript
// Source: packages/core/src/tools/tool.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';

const navigateTool = createTool({
  id: 'navigate',
  description: 'Navigate the browser to a URL',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to navigate to'),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle'])
      .optional()
      .default('domcontentloaded')
      .describe('When to consider navigation complete'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    url: z.string(),
    title: z.string(),
  }),
  execute: async (input, context) => {
    // Implementation here
    return { success: true, url: input.url, title: 'Page Title' };
  },
});
```

### ToolExecutionContext Usage
```typescript
// Source: packages/core/src/tools/types.ts
interface ToolExecutionContext {
  mastra?: MastraUnion;
  requestContext?: RequestContext;
  tracingContext?: TracingContext;
  abortSignal?: AbortSignal;  // Line 241 - key for timeout propagation
  writer?: ToolStream;
  agent?: AgentToolExecutionContext;
  workflow?: WorkflowToolExecutionContext;
  mcp?: MCPToolExecutionContext;
}
```

### Playwright Navigation Options
```typescript
// Source: https://playwright.dev/docs/api/class-page
// These options apply to underlying Playwright used by agent-browser
const gotoOptions = {
  timeout: 10_000,  // 10 seconds
  waitUntil: 'domcontentloaded',  // Faster than 'load' or 'networkidle'
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer | Playwright | 2023 | Playwright is now standard for Node.js browser automation |
| CSS selectors | Accessibility refs | 2024-2025 | agent-browser uses @e1 refs instead of selectors |
| networkidle waits | domcontentloaded | 2025 | SPA apps make networkidle unreliable |
| Direct Playwright | agent-browser wrapper | 2025 | AI-specific abstractions for token efficiency |

**Deprecated/outdated:**
- Puppeteer: Playwright has better TypeScript support and auto-wait features
- networkidle: Unreliable on modern SPA applications

## Open Questions

Things that couldn't be fully resolved:

1. **BrowserManager.close() API**
   - What we know: BrowserManager has launch() and navigate() methods
   - What's unclear: Exact method name and signature for cleanup (close? quit? shutdown?)
   - Recommendation: Check agent-browser source or npm types during implementation

2. **AbortSignal propagation to navigate**
   - What we know: Playwright supports timeout option on goto()
   - What's unclear: Does agent-browser expose timeout option on navigate()?
   - Recommendation: Test during implementation, fallback to wrapper timeout if needed

3. **Error types from BrowserManager**
   - What we know: Browser operations can timeout or fail
   - What's unclear: Exact error classes thrown by agent-browser
   - Recommendation: Catch all errors and normalize to structured output

## Sources

### Primary (HIGH confidence)
- packages/core/src/tools/types.ts - ToolExecutionContext interface, abortSignal property
- packages/core/src/tools/tool.ts - createTool function, Tool class implementation
- packages/core/src/integration/openapi-toolset.ts - OpenAPIToolset class pattern
- https://playwright.dev/docs/api/class-page - page.goto() timeout and waitUntil options

### Secondary (MEDIUM confidence)
- https://github.com/vercel-labs/agent-browser - BrowserManager basic usage
- https://www.npmjs.com/package/agent-browser - Package documentation
- https://github.com/vercel-labs/agent-browser/releases - Version 0.8.0 features

### Tertiary (LOW confidence)
- WebSearch results on Playwright timeout patterns - general best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from project RESEARCH.md and package.json
- Architecture: HIGH - Based on existing Mastra patterns in codebase
- Pitfalls: HIGH - From project-level PITFALLS.md research

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable domain)
