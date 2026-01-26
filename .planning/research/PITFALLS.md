# Domain Pitfalls: Browser Toolset for AI Agents

**Domain:** Browser automation toolset for Mastra agents using agent-browser
**Researched:** 2026-01-26
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Browser Instance Memory Leaks

**What goes wrong:** Browser instances accumulate without cleanup. Each Chromium instance consumes 100-500MB RAM. System runs out of memory.

**Why it happens:**
- Tool execution errors bypass cleanup code
- Agent loops don't close browsers between tasks
- No timeout enforcement on long-running operations

**Evidence:**
- agent-browser issue #212: "Manual browser closure breaks isLaunched check"
- Anthropic computer-use-demo issue #346: "Critical memory leak causing OOM"

**Prevention:**
1. Implement try/finally pattern in ALL tool execute functions
2. Create BrowserPool class with automatic cleanup on error
3. Add context.abortSignal handler to close browser on agent abort

**Phase:** Address in Phase 1 (Core Infrastructure)

---

### Pitfall 2: Stale Accessibility Refs After DOM Changes

**What goes wrong:** Snapshot returns refs (@e1, @e2). Page navigation or JS rendering invalidates refs. Click on @e5 hits wrong element or fails.

**Why it happens:**
- Single Page Apps continuously update DOM
- Time between snapshot and action allows changes
- LLM reasoning takes seconds, DOM changes in milliseconds

**Prevention:**
1. Re-snapshot before every action (or validate refs)
2. Include snapshot timestamp to detect staleness
3. Return clear error when ref is stale

**Phase:** Address in Phase 2 (Core Actions)

---

### Pitfall 3: Screenshot Resolution Coordinate Mismatch

**What goes wrong:** Screenshots at one resolution, coordinates calculated for different resolution. Clicks miss targets.

**Why it happens:**
- API resizes images automatically
- devicePixelRatio not accounted for

**Evidence:**
- Anthropic docs: "We do not recommend sending screenshots in resolutions above XGA/WXGA...Relying on API image resizing will result in lower model accuracy"

**Prevention:**
1. Standardize on single coordinate system
2. Store viewport dimensions with every screenshot
3. Scale coordinates back before action if image was scaled

**Phase:** Address in Phase 3 (Screenshots)

---

### Pitfall 4: Race Conditions in Parallel Agent Sessions

**What goes wrong:** Multiple agents share browser state. One agent navigates while another is mid-action.

**Evidence:**
- agent-browser issue #214: "parallel agents causing issues"

**Prevention:**
1. One browser context per agent conversation (not per tool call)
2. Implement session isolation via browserContext.newContext()
3. Pass session ID through tool context

**Phase:** Address in Phase 1 (Core Infrastructure)

---

### Pitfall 5: Blocking Operations Without Timeouts

**What goes wrong:** navigate, waitForSelector, networkidle hang indefinitely. Serverless function times out.

**Why it happens:**
- networkidle never settles on SPA sites with websockets
- Default timeouts too long (30s)

**Prevention:**
1. Set aggressive defaults (10s navigate, 5s actions)
2. Use domcontentloaded not networkidle as default
3. Propagate context.abortSignal to all browser operations
4. Return partial results on timeout

**Phase:** Address in Phase 1 (Core Infrastructure)

---

## Moderate Pitfalls

### Pitfall 6: Output Bloat Overwhelming LLM Context

**What goes wrong:** Accessibility snapshot returns entire DOM tree. Large pages produce 100KB+ snapshots. Context window fills up.

**Prevention:**
1. Filter to interactive elements by default
2. Limit snapshot depth (first 100 interactive elements)
3. Return stats: "Page has 500 elements, showing top 50 interactive"

**Phase:** Address in Phase 2 (Snapshot tool)

---

### Pitfall 7: Poor Error Messages for LLM Consumption

**What goes wrong:** Browser errors return stack traces. LLM can't understand or recover.

**Prevention:**
1. Define structured error types with recovery hints
2. Never expose stack traces to LLM
3. Include what action to try next

```typescript
type BrowserToolError = {
  code: 'element_not_found' | 'navigation_failed' | 'timeout' | 'stale_ref';
  message: string;
  recoveryHint: string;
  canRetry: boolean;
};
```

**Phase:** All phases

---

### Pitfall 8: Authentication and Session Persistence

**What goes wrong:** Browser closes, session lost. Agent re-authenticates constantly. Gmail blocks automation.

**Evidence:**
- agent-browser issue #207, #253: "profile flag doesn't persist"
- agent-browser issue #271: "Gmail - This browser may not be secure"

**Prevention:**
1. Implement session persistence via user data dir
2. Document which sites block automation

**Phase:** Address in Phase 4 (Advanced) - v2 scope

---

### Pitfall 9: Platform Binary Incompatibilities

**What goes wrong:** Binary missing for platform. Chromium version mismatch with Playwright.

**Evidence:**
- agent-browser issue #258: "darwin-arm64 binary missing"
- agent-browser issue #244: "Playwright browser revision mismatch"
- agent-browser issue #248: "Chromium Not Available on aarch64"

**Prevention:**
1. Test on all target platforms in CI
2. Pin exact Playwright/Chromium versions
3. Provide fallback to Node.js mode if binary unavailable

**Phase:** Address in Phase 1 (Infrastructure)

---

## Minor Pitfalls

### Pitfall 10: First Character Dropped in Text Input

**Evidence:** browser-use issue #3889

**Prevention:** Add delay after focus, verify focus before typing

**Phase:** Address in Phase 2 (type tool)

---

### Pitfall 11: Shadow DOM Elements Inaccessible

**Evidence:** browser-use issue #3810

**Prevention:** Document limitation, provide coordinate-based fallback

**Phase:** Address in Phase 2 (action tools)

---

### Pitfall 12: Cross-Origin Iframe Interactions

**Evidence:** agent-browser issue #279

**Prevention:** Document limitations, provide clear error messages

**Phase:** Document in v1

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 1: Infrastructure | Memory leaks | Cleanup-on-error from day 1 |
| Phase 1: Infrastructure | Race conditions | One context per conversation |
| Phase 1: Infrastructure | Timeouts | Aggressive defaults |
| Phase 2: Core Actions | Stale refs | Re-snapshot before actions |
| Phase 2: Core Actions | First char drop | Focus verification |
| Phase 3: Screenshots | Resolution mismatch | Track viewport |
| Phase 4: Advanced | Authentication | User data dir persistence |

---

*Research completed: 2026-01-26*
