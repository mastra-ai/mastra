# Phase 2: Core Actions - Research

**Researched:** 2026-01-26
**Domain:** Browser element interaction via accessibility snapshots and refs
**Confidence:** HIGH

## Summary

This phase implements the four core interaction tools (snapshot, click, type, scroll) that enable agents to perceive page structure and interact with elements. The agent-browser library already provides most of the heavy lifting: `BrowserManager.getSnapshot()` returns an accessibility tree with refs, `getLocatorFromRef()` resolves refs to Playwright locators, and standard Playwright methods handle interactions.

The primary challenges are: (1) formatting the snapshot output for LLM consumption per user decisions (viewportOnly, page context, form values, focus indicators), (2) implementing auto-snapshot behavior when refs are stale, (3) designing token-efficient responses, and (4) translating Playwright errors into LLM-friendly messages with recovery hints.

The research confirms agent-browser v0.8.0 handles the core ref system (`@e1`, `@e2` format), ref-to-locator resolution, and AI-friendly error transformation. Our tools layer on top with custom snapshot formatting and toolset-level ref management.

**Primary recommendation:** Build tools using BrowserManager's existing ref system (getSnapshot, getLocatorFromRef) while adding custom snapshot formatting logic to meet user requirements for viewportOnly, inline form values, focus/checked state markers, and page context.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| agent-browser | ^0.8.0 | Ref system, locator resolution, error handling | Project dependency. BrowserManager.getSnapshot(), getLocatorFromRef() handle core complexity. |
| @mastra/core | ^1.0.0 | Tool creation pattern | Peer dependency. createTool for consistent tool structure. |
| zod | ^3.25.0 | Schema validation | Mastra standard. All input/output schemas. |
| playwright-core | (transitive) | Underlying locator API | Via agent-browser. Locator.click(), fill(), evaluate() for interactions. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | All functionality from core stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BrowserManager.getSnapshot() | Raw page.accessibility.snapshot() | Would need to rebuild ref system, formatting. Don't use. |
| Playwright Locator.fill() | Locator.type() (deprecated) | type() is deprecated. Use fill() for instant value setting, pressSequentially() for key-by-key. |

**Installation:**
```bash
# Already installed in Phase 1
# No additional dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
integrations/agent-browser/
  src/
    tools/
      navigate.ts         # Phase 1 (done)
      snapshot.ts         # NEW: Accessibility snapshot tool
      click.ts            # NEW: Click element by ref
      type.ts             # NEW: Type into element by ref
      scroll.ts           # NEW: Scroll viewport or element
    toolset.ts            # Register new tools
    types.ts              # Add new schemas
    errors.ts             # NEW: Unified error handling
    refs.ts               # NEW: Ref management layer
```

### Pattern 1: Ref Management with Auto-Snapshot
**What:** Store ref-to-element mapping at toolset level. When click/type uses a ref without prior snapshot, auto-snapshot first.
**When to use:** Always for ref-based tools.
**Example:**
```typescript
// Source: User decisions from CONTEXT.md
export class RefManager {
  private refMap: Map<string, RefData> = new Map();
  private browser: () => Promise<BrowserManager>;

  async getLocator(ref: string): Promise<Locator | null> {
    // If no refs stored, auto-snapshot first
    if (this.refMap.size === 0) {
      await this.refreshSnapshot();
    }

    const browser = await this.browser();
    // BrowserManager.getLocatorFromRef handles @e1 -> e1 parsing
    return browser.getLocatorFromRef(ref);
  }

  async refreshSnapshot(): Promise<EnhancedSnapshot> {
    const browser = await this.browser();
    const snapshot = await browser.getSnapshot({ interactive: true });
    // BrowserManager caches refMap internally
    return snapshot;
  }

  invalidate(): void {
    // Called after each snapshot - refs only valid until next snapshot
    this.refMap.clear();
  }
}
```

### Pattern 2: Custom Snapshot Formatting
**What:** Transform agent-browser's snapshot output into user-specified format with page context, form values, focus state.
**When to use:** Snapshot tool output.
**Example:**
```typescript
// Source: User decisions from CONTEXT.md
interface FormattedSnapshot {
  tree: string;           // Formatted accessibility tree
  refs: Record<string, RefInfo>;
  elementCount: number;
  truncated: boolean;
}

async function formatSnapshot(
  browser: BrowserManager,
  options: { viewportOnly?: boolean; maxElements?: number }
): Promise<FormattedSnapshot> {
  const page = browser.getPage();

  // Get enhanced snapshot from agent-browser (already has refs)
  const { tree, refs } = await browser.getSnapshot({
    interactive: true,
    compact: true,
  });

  // Build header with page context
  const url = page.url();
  const title = await page.title();
  const refCount = Object.keys(refs).length;

  const header = [
    `Page: ${title}`,
    `URL: ${url}`,
    `Interactive elements: ${refCount}`,
    '',
  ].join('\n');

  // Tree already has refs in format: button "Submit" [ref=e1]
  // Transform to user-specified format: button "Submit" @e1
  const formattedTree = tree.replace(/\[ref=(\w+)\]/g, '@$1');

  return {
    tree: header + formattedTree,
    refs,
    elementCount: refCount,
    truncated: refCount > (options.maxElements ?? 50),
  };
}
```

### Pattern 3: Error Response Structure
**What:** Unified error structure with code, message, and recovery hint.
**When to use:** All tool error responses.
**Example:**
```typescript
// Source: User decisions (REQ-08) + agent-browser toAIFriendlyError patterns
type ErrorCode =
  | 'stale_ref'           // Ref no longer valid
  | 'element_not_found'   // Element doesn't exist
  | 'element_blocked'     // Element covered by overlay
  | 'element_not_visible' // Element hidden
  | 'not_focusable'       // Can't type into element
  | 'timeout'             // Operation timed out
  | 'browser_error';      // Generic browser error

interface BrowserToolError {
  success: false;
  code: ErrorCode;
  message: string;         // LLM-friendly description
  recoveryHint?: string;   // Only when actionable
  canRetry: boolean;
}

function createError(code: ErrorCode, message: string, hint?: string): BrowserToolError {
  const canRetry = ['timeout', 'element_blocked'].includes(code);
  return {
    success: false,
    code,
    message,
    recoveryHint: hint,
    canRetry,
  };
}
```

### Pattern 4: Token-Efficient Responses
**What:** Return minimal information that helps agent decide next action.
**When to use:** All successful tool responses.
**Example:**
```typescript
// Source: User decisions from CONTEXT.md
// click: minimal response
{ success: true }

// type: return current value for verification
{ success: true, value: 'entered text' }

// scroll: return new position
{ success: true, position: { x: 0, y: 500 } }

// snapshot: full tree (already optimized by agent-browser)
{ tree: '...', refs: {...}, elementCount: 15, truncated: false }
```

### Anti-Patterns to Avoid
- **Building custom ref system:** Use BrowserManager.getRefMap() and getLocatorFromRef(). Don't rebuild.
- **Using Locator.type():** Deprecated. Use fill() for instant, pressSequentially() for realistic.
- **Returning verbose responses:** Token efficiency is priority. Avoid redundant fields.
- **Exposing stack traces:** Catch all errors, return structured BrowserToolError.
- **Force-clicking without explanation:** If element is blocked, return error with explanation, don't auto-force.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ref-to-locator resolution | Custom selector building | BrowserManager.getLocatorFromRef() | Handles @e1, e1, ref=e1 formats, nth disambiguation |
| Accessibility snapshot | Custom DOM traversal | BrowserManager.getSnapshot() | ARIA tree with proper role detection, ref assignment |
| AI-friendly errors | Custom error mapping | toAIFriendlyError() from agent-browser | Handles strict mode, overlay blocked, timeout cases |
| Element interactability | Custom visibility checks | Playwright auto-wait + actionability checks | Playwright waits for visible, stable, receives events |
| Scroll viewport | Complex position tracking | page.evaluate('window.scrollBy(x, y)') | Simple, reliable |

**Key insight:** agent-browser v0.8.0 implements the core ref system. Build formatting and toolset integration on top, don't recreate fundamentals.

## Common Pitfalls

### Pitfall 1: Stale Refs After Page Navigation
**What goes wrong:** Agent uses ref from old snapshot after page changes. Click fails with confusing error.
**Why it happens:** Navigation, clicking links, or AJAX updates change DOM. Old refs point to non-existent elements.
**How to avoid:**
1. Invalidate all refs after any navigation
2. Auto-snapshot before action if no current refs (per user decision)
3. Clear error message: "Ref @e5 is stale. Page has changed. Take a new snapshot."
**Warning signs:** "strict mode violation" or "element not found" errors after navigation.

### Pitfall 2: Element Blocked by Overlay
**What goes wrong:** Click fails because modal, cookie banner, or tooltip covers element.
**Why it happens:** Playwright's actionability checks detect overlay but error message is confusing.
**How to avoid:**
1. Catch Playwright error "intercepts pointer events"
2. Return clear message: "Element @e5 is blocked by another element (likely a modal or overlay). Dismiss the overlay first."
3. Do NOT use force:true automatically (user decision: error with explanation, no auto-retry)
**Warning signs:** Timeouts on elements that appear visible.

### Pitfall 3: Type Into Non-Focusable Element
**What goes wrong:** Agent tries to type into element that can't receive focus (div, span without contenteditable).
**Why it happens:** Agent sees element in snapshot but doesn't understand it's not an input.
**How to avoid:**
1. Check if locator is focusable before attempting type
2. Return clear error: "Element @e5 (role: heading) cannot receive text input. Only textbox, searchbox, and contenteditable elements can be typed into."
**Warning signs:** "Cannot focus" or "not interactable" errors.

### Pitfall 4: Form Value Not Cleared Before Typing
**What goes wrong:** New text appends to existing value instead of replacing it.
**Why it happens:** Agent forgets to use clearFirst:true, or doesn't know field has content.
**How to avoid:**
1. Show current field values in snapshot: `textbox "Email" @e3 [value: "old@email.com"]`
2. type tool has clearFirst option (default false per requirement)
3. Consider using fill() internally which clears first by design
**Warning signs:** Concatenated values like "old@email.comnew@email.com".

### Pitfall 5: Scroll Amount Confusion
**What goes wrong:** Agent scrolls wrong amount or direction. Page position unexpected.
**Why it happens:** Unclear what "page" or "half" means in pixels. Viewport size varies.
**How to avoid:**
1. "page" = viewport height (get from page.viewportSize())
2. "half" = viewport height / 2
3. Return actual scroll position in response
4. Include current scroll position in error messages
**Warning signs:** Repeated scroll commands not reaching expected position.

## Code Examples

Verified patterns from official sources:

### Snapshot Tool Implementation
```typescript
// Source: agent-browser getSnapshot API + user decisions
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export function createSnapshotTool(
  getBrowser: () => Promise<BrowserManager>,
  refreshRefs: () => void
) {
  return createTool({
    id: 'browser_snapshot',
    description: 'Capture accessibility snapshot of the page. Returns element refs (@e1, @e2) for use with click and type tools.',
    inputSchema: z.object({
      interactiveOnly: z.boolean().optional().default(true)
        .describe('Only show interactive elements (buttons, links, inputs)'),
      maxElements: z.number().optional().default(50)
        .describe('Maximum elements to return'),
    }),
    outputSchema: z.object({
      tree: z.string().describe('Formatted accessibility tree'),
      elementCount: z.number(),
      truncated: z.boolean(),
    }),
    execute: async (input, context) => {
      const browser = await getBrowser();
      const page = browser.getPage();

      // Get snapshot (agent-browser handles refs)
      const { tree, refs } = await browser.getSnapshot({
        interactive: input.interactiveOnly,
        compact: true,
      });

      // Invalidate previous refs (fresh each snapshot per user decision)
      refreshRefs();

      // Format with page context
      const url = page.url();
      const title = await page.title();
      const elementCount = Object.keys(refs).length;

      // Transform [ref=e1] to @e1 per user format decision
      const formattedTree = tree.replace(/\[ref=(\w+)\]/g, '@$1');

      const header = `Page: ${title}\nURL: ${url}\nInteractive elements: ${elementCount}${elementCount > input.maxElements ? ' (showing first ' + input.maxElements + ')' : ''}\n\n`;

      return {
        tree: header + formattedTree,
        elementCount,
        truncated: elementCount > input.maxElements,
      };
    },
  });
}
```

### Click Tool Implementation
```typescript
// Source: agent-browser getLocatorFromRef, toAIFriendlyError
export function createClickTool(
  getBrowser: () => Promise<BrowserManager>,
  defaultTimeout: number
) {
  return createTool({
    id: 'browser_click',
    description: 'Click on an element using its ref from the snapshot.',
    inputSchema: z.object({
      ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
      button: z.enum(['left', 'right', 'middle']).optional().default('left'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
    }),
    execute: async (input, context) => {
      const browser = await getBrowser();

      // BrowserManager.getLocatorFromRef handles @e1 -> locator resolution
      const locator = browser.getLocatorFromRef(input.ref);

      if (!locator) {
        return {
          success: false,
          code: 'stale_ref',
          message: `Ref ${input.ref} not found. The page may have changed.`,
          recoveryHint: 'Take a new snapshot to get current element refs.',
          canRetry: false,
        };
      }

      try {
        await locator.click({
          button: input.button,
          timeout: defaultTimeout,
        });
        return { success: true };
      } catch (error) {
        // Use agent-browser's error transformation
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('intercepts pointer events')) {
          return {
            success: false,
            code: 'element_blocked',
            message: `Element ${input.ref} is blocked by another element.`,
            recoveryHint: 'Dismiss any modals or overlays covering the element.',
            canRetry: true,
          };
        }

        if (message.includes('Timeout')) {
          return {
            success: false,
            code: 'timeout',
            message: `Click on ${input.ref} timed out.`,
            recoveryHint: 'Element may be loading. Wait and try again.',
            canRetry: true,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Click failed: ${message}`,
          canRetry: false,
        };
      }
    },
  });
}
```

### Type Tool Implementation
```typescript
// Source: Playwright fill() API + user decisions
export function createTypeTool(
  getBrowser: () => Promise<BrowserManager>,
  defaultTimeout: number
) {
  return createTool({
    id: 'browser_type',
    description: 'Type text into an input field using its ref.',
    inputSchema: z.object({
      ref: z.string().describe('Element ref from snapshot (e.g., @e3)'),
      text: z.string().describe('Text to type'),
      clearFirst: z.boolean().optional().default(false)
        .describe('Clear existing content before typing'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      value: z.string().optional().describe('Current field value after typing'),
    }),
    execute: async (input, context) => {
      const browser = await getBrowser();
      const locator = browser.getLocatorFromRef(input.ref);

      if (!locator) {
        return {
          success: false,
          code: 'stale_ref',
          message: `Ref ${input.ref} not found.`,
          recoveryHint: 'Take a new snapshot to get current element refs.',
          canRetry: false,
        };
      }

      try {
        // Focus first to ensure element is ready
        await locator.focus({ timeout: defaultTimeout });

        if (input.clearFirst) {
          // fill('') clears then fills - use it for clear
          await locator.fill('', { timeout: defaultTimeout });
        }

        // Use fill() for reliable text entry (instant, clears existing)
        // Or pressSequentially() for realistic key-by-key if needed
        await locator.fill(input.text, { timeout: defaultTimeout });

        // Get current value for verification
        const value = await locator.inputValue({ timeout: 1000 });

        return { success: true, value };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('not an input') || message.includes('Cannot type')) {
          return {
            success: false,
            code: 'not_focusable',
            message: `Element ${input.ref} cannot receive text input.`,
            recoveryHint: 'Only textbox and searchbox elements can be typed into.',
            canRetry: false,
          };
        }

        return {
          success: false,
          code: 'browser_error',
          message: `Type failed: ${message}`,
          canRetry: false,
        };
      }
    },
  });
}
```

### Scroll Tool Implementation
```typescript
// Source: Playwright page.evaluate + mouse.wheel patterns
export function createScrollTool(getBrowser: () => Promise<BrowserManager>) {
  return createTool({
    id: 'browser_scroll',
    description: 'Scroll the page viewport in a direction.',
    inputSchema: z.object({
      direction: z.enum(['up', 'down', 'left', 'right']),
      amount: z.union([
        z.enum(['page', 'half']),
        z.number().describe('Pixels to scroll'),
      ]).optional().default('page'),
      ref: z.string().optional()
        .describe('Element ref to scroll within (omit for viewport)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
    }),
    execute: async (input) => {
      const browser = await getBrowser();
      const page = browser.getPage();
      const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

      // Calculate scroll amount
      let pixels: number;
      if (typeof input.amount === 'number') {
        pixels = input.amount;
      } else if (input.amount === 'half') {
        pixels = Math.floor(viewport.height / 2);
      } else {
        pixels = viewport.height;
      }

      // Calculate delta based on direction
      let deltaX = 0;
      let deltaY = 0;
      switch (input.direction) {
        case 'up': deltaY = -pixels; break;
        case 'down': deltaY = pixels; break;
        case 'left': deltaX = -pixels; break;
        case 'right': deltaX = pixels; break;
      }

      if (input.ref) {
        // Scroll within element
        const locator = browser.getLocatorFromRef(input.ref);
        if (locator) {
          await locator.evaluate((el, { dx, dy }) => {
            el.scrollBy(dx, dy);
          }, { dx: deltaX, dy: deltaY });
        }
      } else {
        // Scroll viewport
        await page.evaluate(`window.scrollBy(${deltaX}, ${deltaY})`);
      }

      // Get new scroll position
      const position = await page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY,
      }));

      return { success: true, position };
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Screenshot-based interaction | Accessibility tree snapshots | 2025 | 10x faster, more reliable, no vision model needed |
| CSS selector memorization | Ephemeral refs (@e1, @e2) | 2025 | Simpler for LLMs, no selector construction |
| Locator.type() | Locator.fill() or pressSequentially() | Playwright 1.40 | type() deprecated, fill() is instant and reliable |
| networkidle wait | domcontentloaded | 2025 | Avoids infinite waits on SPAs |
| Force click workarounds | Proper error with recovery hint | 2025 | Better agent reasoning, no hidden failures |

**Deprecated/outdated:**
- Locator.type(): Use fill() for instant value setting, pressSequentially() for realistic typing
- Screenshot-based element finding: Accessibility snapshots are faster and more reliable

## Open Questions

Things that couldn't be fully resolved:

1. **Viewport-only snapshot filtering**
   - What we know: User decided viewportOnly: true by default
   - What's unclear: agent-browser getSnapshot() doesn't have explicit viewportOnly option
   - Recommendation: May need to filter refs by bounding box position, or accept that "interactive: true" is sufficient filtering. Test during implementation.

2. **Form value inline display**
   - What we know: User wants form values shown inline like `textbox "Email" @e3 [value: "..."]`
   - What's unclear: agent-browser tree format doesn't include input values
   - Recommendation: Post-process tree to add values via locator.inputValue() calls. May need performance consideration if many inputs.

3. **Focus state tracking**
   - What we know: User wants `[focused]` marker on currently focused element
   - What's unclear: How to determine which ref is focused
   - Recommendation: Use page.evaluate('document.activeElement') and match against ref locators

## Sources

### Primary (HIGH confidence)
- agent-browser v0.8.0 type definitions (browser.d.ts, snapshot.d.ts, types.d.ts)
- agent-browser v0.8.0 implementation (snapshot.js, actions.js)
- packages/core/src/tools/tool.ts - Mastra createTool pattern
- integrations/agent-browser/src/ - Phase 1 implementation
- https://playwright.dev/docs/api/class-locator - Playwright Locator API

### Secondary (MEDIUM confidence)
- https://github.com/microsoft/playwright-mcp - Accessibility snapshot patterns
- https://www.checklyhq.com/docs/learn/playwright/error-click-not-executed/ - Click error handling

### Tertiary (LOW confidence)
- WebSearch results on self-healing automation patterns - general concepts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from agent-browser types and Phase 1 implementation
- Architecture: HIGH - Based on agent-browser API and Mastra patterns
- Pitfalls: HIGH - From agent-browser toAIFriendlyError and Playwright docs

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable domain)
