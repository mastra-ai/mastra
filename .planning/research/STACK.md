# Technology Stack: Browser Toolset

**Project:** Mastra Browser Tools
**Researched:** 2026-01-26
**Overall Confidence:** HIGH

---

## Recommended Stack

### Core Browser Automation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| agent-browser | ^0.8.0 | Browser automation for AI agents | Primary requirement. Provides BrowserManager class with accessibility snapshots, ref-based element targeting, and input injection designed specifically for LLM workflows. | HIGH |
| playwright | (transitive) | Underlying browser engine | agent-browser uses Playwright internally. Bundled Chromium by default. Not a direct dependency. | HIGH |

### Schema Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zod | ^3.25.0 \|\| ^4.0.0 | Input/output schema validation | Mastra standard. Core package uses zod as peer dependency. All tool inputSchema/outputSchema use zod. | HIGH |

### TypeScript Configuration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| typescript | ^5.9.3 | Type checking | Mastra monorepo standard via catalog. Strict mode enabled. | HIGH |
| tsup | ^8.5.1 | Build tooling | Mastra standard for library bundling. Outputs ESM and CJS. | HIGH |

### Runtime Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >=22.13.0 | Mastra-wide minimum. Required for agent-browser daemon. |
| pnpm | >=10.18.0 | Monorepo package manager. |

---

## What NOT to Use

### Do NOT Use: Puppeteer
- agent-browser already wraps Playwright, not Puppeteer
- Would add conflicting browser automation layer
- No accessibility snapshot refs support

### Do NOT Use: Playwright Directly
- Bypasses agent-browser's AI-optimized abstractions
- Loses ref-based element targeting
- Project requirement explicitly states use agent-browser

### Do NOT Use: Selenium/WebDriver
- Outdated approach for 2025
- No LLM-friendly abstractions

### Do NOT Use: JSON Schema Directly
- Mastra uses zod throughout
- Would break `createTool` pattern

---

## Architecture Decisions

### Package Location

```
integrations/agent-browser/
  package.json
  src/
    index.ts              # Exports BrowserToolset
    toolset.ts            # BrowserToolset class
    tools/
      navigate.ts
      snapshot.ts
      click.ts
      type.ts
      scroll.ts
      screenshot.ts
    types.ts
  tsconfig.json
```

### Toolset Pattern

Use a class-based toolset pattern:

```typescript
import { createTool, ToolAction } from '@mastra/core';

export class BrowserToolset {
  readonly name = 'agent-browser';
  private browserManager: BrowserManager | null = null;

  tools: Record<string, ToolAction<any, any>> = {
    navigate: this.createNavigateTool(),
    snapshot: this.createSnapshotTool(),
    click: this.createClickTool(),
    type: this.createTypeTool(),
    scroll: this.createScrollTool(),
    screenshot: this.createScreenshotTool(),
  };

  // Lazy initialization - browser starts on first tool use
  private async getBrowser(): Promise<BrowserManager> {
    if (!this.browserManager) {
      this.browserManager = new BrowserManager();
      await this.browserManager.launch({ headless: true });
    }
    return this.browserManager;
  }

  async cleanup(): Promise<void> {
    // Graceful shutdown
  }
}
```

### Browser Lifecycle Management

**Strategy:** Lazy initialization with explicit cleanup
- Browser instance created on first tool invocation
- Single browser instance shared across tool calls
- `cleanup()` method exposed for explicit teardown

---

## Dependencies

### Production Dependencies

```json
{
  "dependencies": {
    "agent-browser": "^0.8.0",
    "zod": "^3.25.0"
  },
  "peerDependencies": {
    "@mastra/core": "^1.0.0"
  }
}
```

### Dev Dependencies

```json
{
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@types/node": "22.19.7",
    "tsup": "^8.5.1",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

---

## Open Questions

1. **Browser instance lifetime**: Auto-cleanup after N seconds of inactivity, or only on explicit cleanup()?
2. **Headless mode**: Configurable per-toolset instance, or always headless?
3. **Error handling**: How should browser crashes propagate to agent?
4. **Screenshot format**: Base64 PNG vs file path?

---

*Research completed: 2026-01-26*
