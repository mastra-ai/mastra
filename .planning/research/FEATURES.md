# Feature Landscape: Browser Toolset for AI Agents

**Domain:** Browser automation toolset for Mastra AI agents
**Researched:** 2026-01-26
**Confidence:** HIGH

## Table Stakes

Features users expect. Missing = agents cannot perform basic web tasks.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **navigate** | Agents must open URLs to access web content | Low | None |
| **snapshot** | Agents need to "see" page content to make decisions | Medium | None |
| **click** | Most web interaction requires clicking elements | Low | snapshot (needs refs) |
| **type** | Form filling, search input, data entry | Low | snapshot (needs refs) |
| **scroll** | Pages often require scrolling to reveal content | Low | None |
| **screenshot** | Visual verification, debugging, multimodal analysis | Low | None |

### Rationale

These six features form the **minimum viable browser toolset**:

1. **Navigation** is the entry point
2. **Snapshot** is how agents perceive the page — agent-browser's accessibility tree with refs is the key pattern
3. **Click + Type** cover 90%+ of user interactions
4. **Scroll** is essential because most pages don't fit in viewport
5. **Screenshot** enables debugging and optional vision model integration

**V1 scope aligns exactly with table stakes.**

## Differentiators

Features that set the toolset apart. Not expected, but valued.

| Feature | Value Proposition | Complexity |
|---------|-------------------|------------|
| **waitForElement** | Robust automation - wait for dynamic content | Medium |
| **extractText** | Structured data extraction from specific elements | Low |
| **extractAttribute** | Get href, src, data attributes | Low |
| **hover** | Reveal tooltips, dropdown menus | Low |
| **selectOption** | Dropdown selection | Low |
| **pressKey** | Keyboard shortcuts, Enter to submit | Low |
| **goBack/goForward** | Browser history navigation | Low |
| **getCurrentUrl** | Check navigation success, detect redirects | Low |
| **getPageTitle** | Quick page identification | Low |

### Prioritized Differentiators

**High Value, Low Complexity (v1.5 candidates):**
1. `waitForElement` - Critical for reliability
2. `extractText` / `extractAttribute` - Core scraping need
3. `getCurrentUrl` / `getPageTitle` - Basic verification

**Medium Value (v2 candidates):**
1. `hover`, `selectOption` - Extended interaction
2. `manageCookies` - Session management

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Coordinate-based clicking** | Fragile, breaks with layout changes | Use accessibility refs from snapshot |
| **Vision-only navigation** | Expensive (tokens), slow, unreliable | Use accessibility tree as primary |
| **Raw DOM parsing** | Overwhelming data for LLM | Use accessibility tree with semantic structure |
| **Automatic retries** | Hides failures, agents should decide | Return errors, let agent decide retry strategy |
| **Built-in CAPTCHA solving** | Legal gray area, scope creep | Document limitation |
| **Multi-tab in v1** | Complexity explosion | Single tab focus; multi-tab is v2+ |

### Anti-Feature Rationale

**Coordinate-based clicking** is the most critical anti-feature:
- Resolution-dependent (breaks across devices)
- Layout-dependent (breaks with CSS changes)
- agent-browser's accessibility refs solve this

**Vision-only navigation** problems:
- Screenshot tokens are expensive
- Visual analysis is slow
- Precision is poor for small elements

## Feature Dependencies

```
navigate (standalone)
    |
    v
snapshot (requires navigated page)
    |
    +---> click (requires ref from snapshot)
    +---> type (requires ref from snapshot)
    +---> extractText (requires ref from snapshot)

scroll (standalone)
screenshot (standalone)
```

**Key insight:** `snapshot` is the hub. Most interaction tools depend on accessibility refs from a snapshot.

## MVP Recommendation

For v1, the six table stakes:

1. **navigate** - Entry point
2. **snapshot** - Core perception
3. **click** - Primary interaction
4. **type** - Text input
5. **scroll** - Viewport management
6. **screenshot** - Debugging/verification

## Competitive Landscape

| Feature | agent-browser | Browser-use | Stagehand | Our Toolset |
|---------|--------------|-------------|-----------|-------------|
| Accessibility refs | Yes | No (vision-primary) | No | Yes (via agent-browser) |
| Natural language actions | No | Yes | Yes | No - explicit tools |
| Cloud browser support | Yes | Yes | Yes | Future (v2) |

**Our positioning:** Explicit, predictable tool-based automation. Agents compose tools rather than relying on AI-interpreted natural language. This trades convenience for reliability and debuggability.

---

*Research completed: 2026-01-26*
