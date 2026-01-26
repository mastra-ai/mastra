# Project Research Summary

**Project:** Mastra Browser Tools
**Domain:** Browser automation toolset for AI agents
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

This project is a browser automation toolset for Mastra AI agents built on top of agent-browser. The recommended approach uses agent-browser's accessibility tree with element references as the primary navigation mechanism, avoiding fragile coordinate-based or vision-only approaches. The toolset will provide six core tools (navigate, snapshot, click, type, scroll, screenshot) that cover 90%+ of web automation needs while maintaining simplicity and reliability.

The critical technical insight is that accessibility refs (@e1, @e2, etc.) must be treated as snapshot-scoped. Each DOM snapshot generates fresh refs, and all refs become stale after the next snapshot or DOM change. This creates a natural agent workflow: snapshot first, reason about the accessibility tree, then act using refs. The toolset should enforce this pattern through lazy browser initialization, shared browser state across tool calls, and structured error handling that guides agents toward correct usage.

Key risks center on resource management (browser memory leaks), timing issues (stale refs, race conditions), and LLM context management (output bloat). Mitigation strategies include aggressive cleanup-on-error patterns, browser context isolation per agent conversation, and filtering snapshot output to interactive elements only. The v1 scope deliberately excludes multi-tab support, vision-only navigation, and automatic retry logic to maintain simplicity and avoid scope creep.

## Key Findings

### Recommended Stack

The stack is minimal and well-defined. agent-browser (^0.8.0) is the core dependency, providing BrowserManager with accessibility snapshots and ref-based element targeting designed for LLM workflows. Zod (^3.25.0 or ^4.0.0) handles schema validation following Mastra conventions. TypeScript (^5.9.3) and tsup (^8.5.1) are the build toolchain standards from the Mastra monorepo.

**Core technologies:**
- agent-browser: Browser automation wrapper — provides accessibility trees with LLM-friendly element references
- zod: Schema validation — Mastra standard for all tool inputSchema/outputSchema definitions
- TypeScript/tsup: Build tooling — monorepo standards for strict type checking and dual ESM/CJS output

**Critical decisions:**
- Do NOT use Playwright directly (bypasses agent-browser's AI optimizations)
- Do NOT use coordinate-based clicking (fragile, resolution-dependent)
- Do NOT use vision-only navigation (expensive, slow, unreliable)

### Expected Features

The feature landscape has strong consensus on the minimum viable set. Six tools form the "table stakes" that users expect from any browser automation toolset. Research shows these six features align exactly with v1 scope and enable 90%+ of common web automation tasks.

**Must have (table stakes):**
- navigate — entry point for all web interactions
- snapshot — core perception mechanism using accessibility tree
- click — primary interaction method using refs from snapshot
- type — text input for forms, search, data entry
- scroll — viewport management for content beyond initial view
- screenshot — debugging, verification, optional vision integration

**Should have (differentiators for v1.5):**
- waitForElement — robust handling of dynamic content
- extractText / extractAttribute — structured data extraction from specific elements
- getCurrentUrl / getPageTitle — navigation verification and debugging

**Defer (v2+):**
- Multi-tab support — complexity explosion, single tab focus for v1
- Session persistence — user data dir, authentication workflows
- hover / selectOption — extended interaction patterns

**Anti-features (explicitly avoid):**
- Coordinate-based clicking — fragile, breaks with layout changes
- Vision-only navigation — expensive tokens, slow analysis
- Automatic retries — hides failures, agents should decide strategy
- Built-in CAPTCHA solving — legal gray area, scope creep

### Architecture Approach

The architecture follows Mastra's class-based toolset pattern with lazy initialization and shared state management. BrowserToolset owns a single BrowserManager instance created on first tool use and shared across all subsequent tool calls within a conversation. Refs are managed in snapshot-scoped registry that gets cleared on each new snapshot.

**Major components:**
1. BrowserToolset — tool collection, lifecycle management, browser instance ownership
2. BrowserManager (from agent-browser) — Playwright wrapper, accessibility tree generation, element interaction
3. Individual Tools — single-purpose operations with Zod schemas (navigate, snapshot, click, type, scroll, screenshot)
4. Element Refs Registry — maps @e1, @e2 to DOM elements, scoped to current snapshot

**Key patterns:**
- Lazy browser initialization (browser starts on first tool use, not construction)
- Ref-based element targeting (use @e1 not CSS selectors)
- Snapshot-before-act (always capture fresh snapshot before interactions)
- Tool independence (each tool handles missing dependencies gracefully)
- Structured error returns (return error objects, don't throw for recoverable cases)

**Data flow:**
1. Agent calls navigate → toolset launches browser → navigation completes
2. Agent calls snapshot → accessibility tree with refs returned
3. Agent reasons about page structure from tree
4. Agent calls click/type with ref (@e5) → toolset resolves ref → action executes
5. Next snapshot invalidates all previous refs

### Critical Pitfalls

Research identified five critical pitfalls that must be addressed in core infrastructure and tool implementation. These represent the difference between a working prototype and a production-ready toolset.

1. **Browser instance memory leaks** — Each Chromium instance consumes 100-500MB. Errors during tool execution bypass cleanup. Prevention: try/finally in ALL tool execute functions, context.abortSignal handlers, automatic cleanup on error.

2. **Stale accessibility refs after DOM changes** — Single Page Apps continuously update DOM. Time between snapshot and action allows invalidation. Click on @e5 hits wrong element. Prevention: re-snapshot before every action, include timestamps, return clear errors when refs are stale.

3. **Screenshot resolution coordinate mismatch** — Screenshots at one resolution, coordinates calculated for different resolution. API image resizing reduces accuracy. Prevention: standardize coordinate system, store viewport dimensions with screenshots.

4. **Race conditions in parallel agent sessions** — Multiple agents sharing browser state. One navigates while another is mid-action. Prevention: one browser context per agent conversation (not per tool call), session isolation via browserContext.newContext().

5. **Blocking operations without timeouts** — navigate/waitForSelector hang indefinitely on slow pages or sites with websockets. Serverless functions timeout. Prevention: aggressive defaults (10s navigate, 5s actions), use domcontentloaded not networkidle, propagate context.abortSignal.

**Additional moderate risks:**
- Output bloat (100KB+ snapshots) — filter to interactive elements by default
- Poor error messages — provide structured errors with recovery hints for LLM consumption
- Platform binary incompatibilities — test on all platforms, pin exact versions

## Implications for Roadmap

Based on research, the project naturally divides into four phases following dependency order and risk mitigation requirements.

### Phase 1: Core Infrastructure
**Rationale:** Browser lifecycle and resource management must be rock-solid before building tools. Memory leaks and race conditions are critical pitfalls that affect all subsequent phases.

**Delivers:** BrowserToolset class skeleton, lazy initialization, cleanup mechanisms, session isolation per conversation

**Addresses:**
- Critical pitfall #1 (memory leaks)
- Critical pitfall #4 (race conditions)
- Critical pitfall #5 (timeout handling)

**Key decision:** One browser context per agent conversation, aggressive cleanup-on-error from day 1

### Phase 2: Core Actions (navigate, snapshot, click, type)
**Rationale:** These four tools form the minimal dependency chain. Navigate is the entry point, snapshot provides refs, click/type consume refs. Must implement together as a unit.

**Delivers:** The core interaction loop (navigate → snapshot → act using refs)

**Addresses:**
- Table stakes features: navigate, snapshot, click, type
- Critical pitfall #2 (stale refs)
- Moderate pitfall #6 (output bloat via filtered snapshots)

**Uses:** BrowserManager from agent-browser, zod schemas, ref registry pattern

**Implements:** Snapshot-before-act pattern, ref lifecycle management

### Phase 3: Viewport and Debugging (scroll, screenshot)
**Rationale:** These tools are independent of the ref system and can be built after core actions are stable. Both are table stakes but don't block the fundamental interaction pattern.

**Delivers:** Complete v1 feature set (all six table stakes tools)

**Addresses:**
- Table stakes features: scroll, screenshot
- Critical pitfall #3 (screenshot resolution)

**Uses:** Viewport manipulation APIs, image capture with dimension tracking

### Phase 4: Integration and Polish
**Rationale:** Package the toolset following Mastra conventions, ensure proper monorepo integration, write documentation.

**Delivers:** Published integration at `integrations/agent-browser/`, README with usage examples, tests

**Addresses:**
- Monorepo structure and build configuration
- Moderate pitfall #9 (platform binaries)
- Documentation of limitations (shadow DOM, iframes, auth)

**Avoids:** No automatic retries, no vision-only mode, no multi-tab — keep v1 simple

### Phase Ordering Rationale

- Phase 1 must come first because all tools depend on browser lifecycle management
- Phase 2 delivers the core value (web navigation and interaction) as early as possible
- Phase 3 completes table stakes but doesn't block testing of core interaction pattern
- Phase 4 ensures production-ready packaging but doesn't add features

This ordering front-loads risk mitigation (memory leaks, race conditions) while enabling rapid validation of the core snapshot → ref → action workflow. Each phase delivers testable, demonstrable value.

### Research Flags

**Needs deeper research during planning:**
- Phase 1: Session isolation strategy — how to pass conversation ID through tool context, whether to use browser contexts or separate browser instances
- Phase 2: Ref staleness detection — whether to re-snapshot automatically or return errors, performance tradeoffs

**Standard patterns (skip research-phase):**
- Phase 3: Scroll and screenshot are well-documented Playwright operations
- Phase 4: Monorepo integration follows established Mastra patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | agent-browser is project requirement, versions verified in repo, Mastra conventions well-documented |
| Features | HIGH | Strong consensus on six table stakes tools, competitive analysis confirms approach |
| Architecture | HIGH | Follows existing Mastra toolset patterns, agent-browser usage patterns documented |
| Pitfalls | HIGH | Evidence from agent-browser issues, Anthropic docs, and community projects |

**Overall confidence:** HIGH

The research drew from official agent-browser documentation, Mastra codebase conventions, Anthropic computer-use guidance, and empirical evidence from agent-browser GitHub issues. The core technical approach (accessibility refs over coordinates) is well-validated. The six-tool v1 scope has strong consensus across browser automation projects.

### Gaps to Address

Minor gaps that need resolution during implementation:

- **Browser instance lifetime:** Auto-cleanup after N seconds of inactivity vs. explicit cleanup() only — decision needed based on typical agent usage patterns
- **Headless mode:** Configurable per toolset instance vs. always headless — clarify requirement with product owner
- **Screenshot format:** Base64 PNG for immediate LLM consumption vs. file path for storage efficiency — depends on typical usage (debugging vs. vision analysis)
- **First character drop bug:** Needs empirical validation in agent-browser (browser-use issue #3889) — test during Phase 2 implementation

These gaps are implementation details, not fundamental design questions. They can be resolved during phase planning or through early prototyping.

## Sources

### Primary (HIGH confidence)
- agent-browser official documentation — API patterns, accessibility tree structure
- Mastra codebase (`packages/core/src/`, `integrations/`) — toolset patterns, zod usage
- agent-browser GitHub issues (#212, #214, #207, #253, #258, #244, #248, #271, #279) — empirical pitfall evidence
- Anthropic computer-use documentation — screenshot resolution guidance

### Secondary (MEDIUM confidence)
- browser-use GitHub issues (#3889, #3810) — input bugs, shadow DOM limitations
- Competitive analysis (browser-use, Stagehand) — feature comparison

### Tertiary (LOW confidence)
- None — all findings backed by primary or secondary sources

---
*Research completed: 2026-01-26*
*Ready for roadmap: yes*
