# Phase 3: Screenshot - Research

**Researched:** 2026-01-26
**Domain:** Browser screenshot capture with Playwright via agent-browser
**Confidence:** HIGH

## Summary

This phase implements a screenshot tool for capturing visual images of the current browser page. The tool leverages Playwright's `page.screenshot()` and `locator.screenshot()` APIs, accessed through agent-browser's `BrowserManager.getPage()` method. The existing codebase already establishes patterns for tool creation, error handling, and browser access that this phase will follow.

Key capabilities required: viewport screenshots (default), full-page screenshots, and element screenshots by ref. The tool must return base64-encoded image data with metadata (dimensions, mimeType, fileSize) suitable for multimodal AI consumption. Critical considerations include handling large images that may exceed API limits (8000px), timeout management for full-page captures of long pages, and ensuring mimeType declaration matches actual image format.

**Primary recommendation:** Implement `createScreenshotTool()` following the existing tool factory pattern, using Playwright's `page.screenshot()` for viewport/full-page and `locator.screenshot()` for element capture, with a 30-second timeout and soft warnings for oversized images.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright-core | (transitive) | Screenshot capture via Page/Locator APIs | Underlying browser automation, accessed via agent-browser |
| agent-browser | ^0.8.0 | BrowserManager with getPage(), getLocatorFromRef() | Already used in existing tools; provides ref-to-locator resolution |
| @mastra/core/tools | ^1.0.0 | createTool factory | Existing pattern for all browser tools |
| zod | ^3.25.0 | Schema validation | Existing pattern for input/output schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Buffer | (Node.js built-in) | Base64 encoding | Convert screenshot buffer to string |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright page.screenshot() | agent-browser CLI screenshot | Would require shell execution; direct API is cleaner |
| Buffer.toString('base64') | Custom encoding | No reason to hand-roll base64 encoding |

**Installation:**
```bash
# No new dependencies required - all already installed
```

## Architecture Patterns

### Recommended Project Structure
```
integrations/agent-browser/
  src/
    tools/
      screenshot.ts     # New file - screenshot tool
    types.ts            # Add screenshot schemas
    errors.ts           # May need new error code
    toolset.ts          # Register screenshot tool
```

### Pattern 1: Tool Factory with getBrowser Closure
**What:** `createScreenshotTool(getBrowser)` receives a closure for lazy browser access.
**When to use:** All browser tools (established pattern).
**Example:**
```typescript
// Source: Existing pattern from src/tools/click.ts
export function createScreenshotTool(getBrowser: () => Promise<BrowserManager>, defaultTimeout: number) {
  return createTool({
    id: 'browser_screenshot',
    description: 'Capture a screenshot of the current page or a specific element.',
    inputSchema: screenshotInputSchema,
    outputSchema: screenshotOutputSchema,
    execute: async (input): Promise<ScreenshotOutput | BrowserToolError> => {
      const browser = await getBrowser();
      const page = browser.getPage();
      // ... implementation
    },
  });
}
```

### Pattern 2: Playwright Screenshot API
**What:** Use `page.screenshot()` for viewport/full-page, `locator.screenshot()` for elements.
**When to use:** All screenshot captures.
**Example:**
```typescript
// Source: https://playwright.dev/docs/api/class-page#page-screenshot
// Viewport screenshot (default)
const buffer = await page.screenshot({
  type: 'png',              // or 'jpeg'
  quality: 80,              // JPEG only, 0-100
  timeout: 30_000,          // 30 seconds
  fullPage: false,          // default - viewport only
});

// Full-page screenshot
const buffer = await page.screenshot({
  fullPage: true,
  timeout: 30_000,
});

// Element screenshot (locator captures element bounds, auto-scrolls into view)
const locator = browser.getLocatorFromRef(input.ref);
const buffer = await locator.screenshot({
  type: 'png',
  timeout: 30_000,
});

// Convert to base64
const base64 = buffer.toString('base64');
```

### Pattern 3: Image Dimension Extraction
**What:** Extract width/height from PNG/JPEG buffer header for metadata.
**When to use:** Return dimensions with screenshot.
**Example:**
```typescript
// PNG: dimensions in IHDR chunk at bytes 16-23
// JPEG: requires parsing SOF marker
// Simpler: capture viewport size from page before screenshot
const viewportSize = page.viewportSize();
// Or for full-page, set viewport first then get dimensions
```

### Pattern 4: Structured Error Return (Existing Pattern)
**What:** Return `BrowserToolError` with code, message, recoveryHint, canRetry.
**When to use:** All failure cases.
**Example:**
```typescript
// Source: src/errors.ts
import { createError } from '../errors.js';

// Timeout error
return createError(
  'timeout',
  'Screenshot capture timed out after 30 seconds.',
  'Try capturing viewport only (fullPage: false) or a specific element.'
);

// Element ref not found
return createError(
  'stale_ref',
  `Element ${input.ref} not found. The page may have changed.`,
  'Take a new snapshot to get current element refs.'
);
```

### Anti-Patterns to Avoid
- **Declaring wrong mimeType:** CRITICAL - if returning PNG data, declare `image/png`, not `image/jpeg`. Mismatch causes API errors.
- **No timeout on full-page:** Full-page screenshots on infinite-scroll pages can hang. Always set explicit timeout.
- **Returning data URLs:** Return raw base64, not `data:image/png;base64,...` format. Let consumers add prefix if needed.
- **Ignoring large images:** Images over 8000px in any dimension may fail API limits. Warn but still return.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screenshot capture | CDP Page.captureScreenshot | page.screenshot() | Playwright handles encoding, clipping, stitching |
| Element capture | Calculate bounds + clip | locator.screenshot() | Playwright auto-scrolls, waits for visibility |
| Base64 encoding | Manual byte conversion | Buffer.toString('base64') | Node.js built-in, reliable |
| Ref resolution | Parse ref string manually | browser.getLocatorFromRef() | Already implemented in agent-browser |
| Dimension parsing | PNG/JPEG header parsing | page.viewportSize() | Playwright provides viewport info |

**Key insight:** Playwright's screenshot API handles all the complexity of stitching full-page captures, waiting for animations, and clipping. Use it directly.

## Common Pitfalls

### Pitfall 1: Media Type Mismatch
**What goes wrong:** Declaring `image/jpeg` but returning PNG data causes Claude API 400 errors.
**Why it happens:** Default screenshot type is PNG; forgetting to match mimeType to actual format.
**How to avoid:**
1. If `type: 'png'` (default), return `mimeType: 'image/png'`
2. If `type: 'jpeg'`, return `mimeType: 'image/jpeg'`
3. Never assume format - explicitly set and match
**Warning signs:** API Error 400: "Image does not match the provided media type"

### Pitfall 2: Full-Page Screenshot Timeout
**What goes wrong:** Full-page screenshots on infinite-scroll or very long pages never complete.
**Why it happens:** Playwright tries to capture entire scrollable height; some pages are effectively infinite.
**How to avoid:**
1. Set explicit 30-second timeout for all screenshots
2. On timeout, return error with hint to try viewport-only
3. Consider warning for pages > 10000px height
**Warning signs:** Operation hangs, eventually times out with no image.

### Pitfall 3: Large Image API Rejection
**What goes wrong:** Images with dimensions > 8000px rejected by Claude API.
**Why it happens:** Multimodal APIs have dimension limits to prevent memory issues.
**How to avoid:**
1. After capture, check dimensions against 8000px threshold
2. If exceeded, include `warning` field in response
3. Still return the full image - let agent/user decide to retry
**Warning signs:** Claude Code error: "At least one of the image dimensions exceed max allowed size: 8000 pixels"

### Pitfall 4: Stale Element Ref
**What goes wrong:** Element screenshot fails because ref from old snapshot no longer valid.
**Why it happens:** Page changed since last snapshot; ref map is stale.
**How to avoid:**
1. Check `getLocatorFromRef()` returns non-null
2. Return `stale_ref` error with hint to take new snapshot
3. Consistent with click/type tool error handling
**Warning signs:** `null` returned from getLocatorFromRef().

### Pitfall 5: Font Loading Delays
**What goes wrong:** Screenshot times out waiting for fonts to load.
**Why it happens:** Playwright waits for fonts by default; slow CDN or blocked fonts cause hangs.
**How to avoid:**
1. Set reasonable timeout (30s)
2. On font-related timeout, hint in error message
3. Consider future option to skip font wait
**Warning signs:** Timeout error message mentions "waiting for fonts to load"

## Code Examples

Verified patterns from official sources:

### Viewport Screenshot
```typescript
// Source: https://playwright.dev/docs/screenshots
const page = browser.getPage();
const buffer = await page.screenshot({
  type: 'png',
  timeout: 30_000,
});
const base64 = buffer.toString('base64');
const viewport = page.viewportSize();

return {
  base64,
  mimeType: 'image/png',
  dimensions: { width: viewport.width, height: viewport.height },
  fileSize: buffer.length,
  timestamp: new Date().toISOString(),
  url: page.url(),
  title: await page.title(),
};
```

### Full-Page Screenshot
```typescript
// Source: https://playwright.dev/docs/screenshots
const buffer = await page.screenshot({
  fullPage: true,
  type: 'png',
  timeout: 30_000,
});

// Full-page dimensions require parsing buffer or measuring before capture
// Simpler: measure scrollHeight before capture
const dimensions = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  height: document.documentElement.scrollHeight,
}));
```

### JPEG Screenshot with Quality
```typescript
// Source: https://playwright.dev/docs/api/class-page#page-screenshot
const buffer = await page.screenshot({
  type: 'jpeg',
  quality: 80,  // 0-100, only for jpeg
  timeout: 30_000,
});

return {
  base64: buffer.toString('base64'),
  mimeType: 'image/jpeg',  // MUST match type above
  // ...
};
```

### Element Screenshot by Ref
```typescript
// Source: https://playwright.dev/docs/api/class-locator#locator-screenshot
const locator = browser.getLocatorFromRef(input.ref);
if (!locator) {
  return createError(
    'stale_ref',
    `Element ${input.ref} not found. The page may have changed.`,
    'Take a new snapshot to get current element refs.'
  );
}

// locator.screenshot() auto-scrolls element into view
const buffer = await locator.screenshot({
  type: 'png',
  timeout: 30_000,
});

// Get element bounding box for dimensions
const box = await locator.boundingBox();
const dimensions = box
  ? { width: Math.round(box.width), height: Math.round(box.height) }
  : { width: 0, height: 0 };
```

### Large Image Warning Check
```typescript
// After capturing
const MAX_DIMENSION = 8000;
const isOversized = dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION;

return {
  base64,
  mimeType: 'image/png',
  dimensions,
  fileSize: buffer.length,
  warning: isOversized
    ? `Image dimensions (${dimensions.width}x${dimensions.height}) exceed recommended 8000px limit. Some APIs may reject this image.`
    : undefined,
  // ...
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CDP Page.captureScreenshot | Playwright page.screenshot() | Playwright 1.0 | Simpler API, automatic stitching |
| Hardcoded JPEG | PNG default with optional JPEG | Convention | PNG lossless for UI, JPEG for photos |
| File path output | Buffer return | - | Better for programmatic use, base64 |
| No timeout | Explicit timeout always | 2025 best practice | Prevents indefinite hangs |

**Deprecated/outdated:**
- Manual full-page stitching: Playwright handles this automatically with `fullPage: true`
- CDP direct calls: Use Playwright's abstraction layer

## Open Questions

Things that couldn't be fully resolved:

1. **Large image handling threshold**
   - What we know: 8000px is Claude API limit; images can be much larger
   - What's unclear: Should we cap dimensions or just warn?
   - Recommendation: Warn only, return full image. User decision specified: "return full image + warning flag"

2. **Element screenshot dimensions**
   - What we know: `locator.boundingBox()` returns element bounds
   - What's unclear: Does this account for fractional pixels, borders, etc.?
   - Recommendation: Round to integers, accept minor inaccuracy

3. **Font timeout message detection**
   - What we know: Playwright may throw "waiting for fonts to load" timeout
   - What's unclear: Exact error message format varies by version
   - Recommendation: Check for 'font' in error message as heuristic

## Sources

### Primary (HIGH confidence)
- https://playwright.dev/docs/api/class-page#page-screenshot - Page.screenshot() API reference
- https://playwright.dev/docs/api/class-locator#locator-screenshot - Locator.screenshot() API reference
- https://playwright.dev/docs/screenshots - Screenshots guide with examples
- `/Users/abhiramaiyer/.superset/worktrees/mastra/ab-tools/integrations/agent-browser/src/tools/click.ts` - Existing tool pattern
- `/Users/abhiramaiyer/.superset/worktrees/mastra/ab-tools/integrations/agent-browser/src/errors.ts` - Error handling pattern
- `/Users/abhiramaiyer/.superset/worktrees/mastra/ab-tools/node_modules/.pnpm/agent-browser@0.8.0/node_modules/agent-browser/dist/browser.d.ts` - BrowserManager API

### Secondary (MEDIUM confidence)
- https://github.com/microsoft/playwright-mcp/issues/1211 - Media type mismatch bug analysis
- https://github.com/anthropics/claude-code/issues/9049 - 8000px dimension limit issue

### Tertiary (LOW confidence)
- WebSearch results on Playwright timeout issues - general patterns confirmed with docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies and patterns
- Architecture: HIGH - Following established tool factory pattern
- Pitfalls: HIGH - Documented issues with official sources and real bug reports

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable domain)
