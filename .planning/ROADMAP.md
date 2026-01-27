# Roadmap: Mastra Browser Tools

## Overview

This roadmap delivers a browser toolset integration for Mastra agents in three phases. Phase 1 establishes the infrastructure foundation with browser lifecycle management and the navigate tool. Phase 2 builds the core interaction loop (snapshot, click, type, scroll) with ref-based element targeting. Phase 3 adds screenshot capability for debugging and visual verification. Each phase delivers testable, demonstrable value following the snapshot-before-act pattern.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure** - BrowserToolset foundation with lifecycle management and navigation ✓
- [x] **Phase 2: Core Actions** - Snapshot and interaction tools (click, type, scroll) ✓
- [x] **Phase 3: Screenshot** - Visual capture tool for debugging and verification ✓
- [x] **Phase 4: Navigate Error Consistency** - Unify navigate error handling with BrowserToolError (GAP CLOSURE) ✓
- [ ] **Phase 5: Schema Consolidation** - Remove duplicate schemas, single source of truth (GAP CLOSURE) [1/2 plans]
- [ ] **Phase 6: Browser Lifecycle Locking** - Fix race condition in concurrent getBrowser calls (GAP CLOSURE)

## Phase Details

### Phase 1: Infrastructure
**Goal**: Agents can navigate to web pages with proper browser lifecycle management
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02, REQ-09, REQ-10
**Success Criteria** (what must be TRUE):
  1. BrowserToolset can be instantiated and registered with a Mastra agent
  2. Agent can call navigate tool and receive page title/URL in response
  3. Browser launches lazily on first tool use (not at construction)
  4. Browser closes cleanly via close() method with no memory leaks
  5. Navigation operations timeout after 10 seconds with clear error message
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md - Package scaffolding and type definitions
- [x] 01-02-PLAN.md - Navigate tool and BrowserToolset class implementation

### Phase 2: Core Actions
**Goal**: Agents can perceive page structure and interact with elements using refs
**Depends on**: Phase 1
**Requirements**: REQ-03, REQ-04, REQ-05, REQ-06, REQ-08
**Success Criteria** (what must be TRUE):
  1. Agent can capture accessibility snapshot with element refs (@e1, @e2, etc.)
  2. Agent can click on elements using ref identifiers from snapshot
  3. Agent can type text into form fields using ref identifiers
  4. Agent can scroll the page viewport in any direction
  5. All errors include recovery hints without exposing stack traces
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md - Error handling foundation and snapshot tool
- [x] 02-02-PLAN.md - Click and type interaction tools
- [x] 02-03-PLAN.md - Scroll tool and toolset registration

### Phase 3: Screenshot
**Goal**: Agents can capture visual screenshots for debugging and verification
**Depends on**: Phase 2
**Requirements**: REQ-07
**Success Criteria** (what must be TRUE):
  1. Agent can capture screenshot of current viewport
  2. Agent can capture full-page screenshot
  3. Screenshot returns base64 data with dimensions for multimodal use
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md - Screenshot tool with viewport, full-page, and element capture

### Phase 4: Navigate Error Consistency
**Goal**: Navigate tool errors use unified BrowserToolError format
**Depends on**: Phase 3
**Gap Closure**: Audit finding - navigate.ts uses legacy BrowserError instead of BrowserToolError
**Success Criteria** (what must be TRUE):
  1. Navigate tool imports BrowserToolError from errors.ts
  2. Navigate tool uses createError() factory for all error responses
  3. Navigate errors include code, recoveryHint, and canRetry fields
  4. Error response structure matches other 5 tools
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md - Update navigate error handling

### Phase 5: Schema Consolidation
**Goal**: Single source of truth for all Zod schemas in types.ts
**Depends on**: Phase 4
**Gap Closure**: Audit finding - 5 tools have duplicate local + types.ts schemas
**Success Criteria** (what must be TRUE):
  1. snapshot.ts imports schemas from types.ts (no local definitions)
  2. click.ts imports schemas from types.ts (no local definitions)
  3. type.ts imports schemas from types.ts (no local definitions)
  4. scroll.ts imports schemas from types.ts (no local definitions)
  5. screenshot.ts imports schemas from types.ts (no local definitions)
  6. All schema exports from types.ts remain intact
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md - Update types.ts and consolidate snapshot/click
- [ ] 05-02-PLAN.md - Consolidate type/scroll/screenshot

### Phase 6: Browser Lifecycle Locking
**Goal**: Concurrent getBrowser() calls share single browser instance
**Depends on**: Phase 5
**Gap Closure**: Audit finding - race condition when multiple tools call getBrowser() simultaneously
**Success Criteria** (what must be TRUE):
  1. getBrowser() uses promise-based lock to prevent concurrent launches
  2. Second concurrent call awaits first launch (not starts new one)
  3. All tools share same browser instance even when called in parallel
  4. No orphaned browser processes on concurrent execution
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md - Add browser launch locking

## Requirement Coverage

| REQ ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| REQ-01 | BrowserToolset Class | Phase 1 | Complete |
| REQ-02 | Navigate Tool | Phase 1 | Complete |
| REQ-09 | Resource Cleanup | Phase 1 | Complete |
| REQ-10 | Timeout Management | Phase 1 | Complete |
| REQ-03 | Snapshot Tool | Phase 2 | Complete |
| REQ-04 | Click Tool | Phase 2 | Complete |
| REQ-05 | Type Tool | Phase 2 | Complete |
| REQ-06 | Scroll Tool | Phase 2 | Complete |
| REQ-08 | Error Handling | Phase 2 | Complete |
| REQ-07 | Screenshot Tool | Phase 3 | Complete |

**Coverage:** 10/10 requirements mapped

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 2/2 | ✓ Complete | 2026-01-26 |
| 2. Core Actions | 3/3 | ✓ Complete | 2026-01-26 |
| 3. Screenshot | 1/1 | ✓ Complete | 2026-01-26 |
| 4. Navigate Error Consistency | 1/1 | ✓ Complete | 2026-01-27 |
| 5. Schema Consolidation | 1/2 | In Progress | — |
| 6. Browser Lifecycle Locking | 0/1 | Pending | — |

---

*Roadmap created: 2026-01-26*
*Phase 1 planned: 2026-01-26*
*Phase 1 completed: 2026-01-26*
*Phase 2 planned: 2026-01-26*
*Phase 2 completed: 2026-01-26*
*Phase 3 planned: 2026-01-26*
*Phase 3 completed: 2026-01-26*
*Gap closure phases 4-6 added: 2026-01-26*
*Phase 4 completed: 2026-01-27*
*Phase 5 plan 1 completed: 2026-01-27*
