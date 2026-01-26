# Requirements: Mastra Browser Tools v1

**Project:** Mastra Browser Tools
**Version:** 1.0
**Created:** 2026-01-26

---

## REQ-01: BrowserToolset Class

**Priority:** P0 (Critical)
**Phase:** 1

The integration must provide a `BrowserToolset` class that:
- Exposes all browser tools as a cohesive bundle
- Manages browser lifecycle (launch on first use, explicit cleanup)
- Follows Mastra integration patterns
- Lives in `integrations/agent-browser/`

**Acceptance Criteria:**
- [ ] Class exports `tools` record compatible with Mastra agent registration
- [ ] Single browser instance shared across tool calls
- [ ] `close()` method for explicit cleanup
- [ ] Compatible with `@mastra/core` peer dependency

---

## REQ-02: Navigate Tool

**Priority:** P0 (Critical)
**Phase:** 1
**Dependencies:** REQ-01

Tool to navigate the browser to a URL.

**Input Schema:**
- `url` (string, required): Target URL
- `waitUntil` (enum, optional): 'load' | 'domcontentloaded' | 'networkidle', default 'load'

**Output Schema:**
- `success` (boolean): Navigation completed
- `url` (string): Final URL (after redirects)
- `title` (string): Page title

**Acceptance Criteria:**
- [ ] Triggers browser launch if not already running
- [ ] Returns clear error on navigation failure
- [ ] Timeout defaults to 10 seconds
- [ ] Handles context.abortSignal

---

## REQ-03: Snapshot Tool

**Priority:** P0 (Critical)
**Phase:** 2
**Dependencies:** REQ-01

Tool to capture accessibility tree snapshot with element refs.

**Input Schema:**
- `interactiveOnly` (boolean, optional): Filter to interactive elements, default true
- `maxElements` (number, optional): Limit elements returned, default 100

**Output Schema:**
- `tree` (string): Formatted accessibility tree
- `refs` (record): Map of ref IDs to element metadata
- `elementCount` (number): Total elements on page
- `truncated` (boolean): Whether output was limited

**Acceptance Criteria:**
- [ ] Generates deterministic refs (@e1, @e2, etc.)
- [ ] Refs stored for subsequent click/type operations
- [ ] Previous refs invalidated on new snapshot
- [ ] Output optimized for LLM consumption (not raw DOM)

---

## REQ-04: Click Tool

**Priority:** P0 (Critical)
**Phase:** 2
**Dependencies:** REQ-03

Tool to click on elements using accessibility refs.

**Input Schema:**
- `ref` (string, required): Element ref from snapshot (e.g., "@e5")
- `button` (enum, optional): 'left' | 'right' | 'middle', default 'left'

**Output Schema:**
- `success` (boolean): Click executed
- `error` (object, optional): Structured error if failed

**Acceptance Criteria:**
- [ ] Resolves ref to DOM element from current snapshot
- [ ] Returns clear error if ref is stale or invalid
- [ ] Includes recovery hint in error response
- [ ] Timeout defaults to 5 seconds

---

## REQ-05: Type Tool

**Priority:** P0 (Critical)
**Phase:** 2
**Dependencies:** REQ-03

Tool to type text into focused element or element by ref.

**Input Schema:**
- `text` (string, required): Text to type
- `ref` (string, optional): Element ref to focus first
- `clearFirst` (boolean, optional): Clear existing content, default false

**Output Schema:**
- `success` (boolean): Text typed
- `error` (object, optional): Structured error if failed

**Acceptance Criteria:**
- [ ] Verifies focus before typing (prevents first-char drop)
- [ ] Small delay after focus before typing
- [ ] Handles special characters correctly
- [ ] Returns clear error if element not focusable

---

## REQ-06: Scroll Tool

**Priority:** P1 (High)
**Phase:** 2
**Dependencies:** REQ-01

Tool to scroll the page or element.

**Input Schema:**
- `direction` (enum, required): 'up' | 'down' | 'left' | 'right'
- `amount` (enum, optional): 'page' | 'half' | number (pixels), default 'page'
- `ref` (string, optional): Element ref to scroll within

**Output Schema:**
- `success` (boolean): Scroll executed
- `scrollPosition` (object): { x, y } current scroll position

**Acceptance Criteria:**
- [ ] Works without requiring snapshot refs
- [ ] Supports both viewport and element scrolling
- [ ] Returns new scroll position

---

## REQ-07: Screenshot Tool

**Priority:** P1 (High)
**Phase:** 3
**Dependencies:** REQ-01

Tool to capture screenshot of current page.

**Input Schema:**
- `fullPage` (boolean, optional): Capture full page, default false
- `quality` (number, optional): JPEG quality 0-100, default 80

**Output Schema:**
- `base64` (string): Base64-encoded image
- `mimeType` (string): 'image/png' | 'image/jpeg'
- `dimensions` (object): { width, height } of captured image

**Acceptance Criteria:**
- [ ] Returns base64 for direct use in multimodal prompts
- [ ] Stores viewport dimensions with screenshot
- [ ] Reasonable default resolution (avoid API resizing issues)

---

## REQ-08: Error Handling

**Priority:** P0 (Critical)
**Phase:** 2 (implemented across all phases)

All tools must implement structured error handling.

**Error Schema:**
```typescript
type BrowserToolError = {
  code: 'element_not_found' | 'navigation_failed' | 'timeout' | 'stale_ref' | 'browser_crashed';
  message: string;
  recoveryHint: string;
  canRetry: boolean;
}
```

**Acceptance Criteria:**
- [ ] Never expose stack traces to LLM
- [ ] All errors include recovery hints
- [ ] Errors indicate if retry is likely to succeed

---

## REQ-09: Resource Cleanup

**Priority:** P0 (Critical)
**Phase:** 1

Browser resources must be properly managed.

**Acceptance Criteria:**
- [ ] try/finally pattern in all tool execute functions
- [ ] Browser closed on toolset close()
- [ ] Handle context.abortSignal to close browser on agent abort
- [ ] No memory leaks on repeated tool calls

---

## REQ-10: Timeout Management

**Priority:** P0 (Critical)
**Phase:** 1

All operations must have sensible timeouts.

**Defaults:**
- Navigation: 10 seconds
- Actions (click, type): 5 seconds
- Screenshot: 10 seconds

**Acceptance Criteria:**
- [ ] No operation blocks indefinitely
- [ ] Use 'domcontentloaded' not 'networkidle' as default wait
- [ ] Timeout errors include what operation timed out

---

## Out of Scope (v2+)

- REQ-FUTURE-01: Session persistence (cookies/storage across runs)
- REQ-FUTURE-02: Form-filling workflows
- REQ-FUTURE-03: Cloud browser providers (Browserbase)
- REQ-FUTURE-04: Multi-tab support
- REQ-FUTURE-05: Authentication persistence
- REQ-FUTURE-06: Coordinate-based clicking fallback

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | Phase 1 | Pending |
| REQ-02 | Phase 1 | Pending |
| REQ-09 | Phase 1 | Pending |
| REQ-10 | Phase 1 | Pending |
| REQ-03 | Phase 2 | Pending |
| REQ-04 | Phase 2 | Pending |
| REQ-05 | Phase 2 | Pending |
| REQ-06 | Phase 2 | Pending |
| REQ-08 | Phase 2 | Pending |
| REQ-07 | Phase 3 | Pending |

---

*Requirements defined: 2026-01-26*
*Phase mappings added: 2026-01-26*
