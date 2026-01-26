# Roadmap: Mastra Browser Tools

## Overview

This roadmap delivers a browser toolset integration for Mastra agents in three phases. Phase 1 establishes the infrastructure foundation with browser lifecycle management and the navigate tool. Phase 2 builds the core interaction loop (snapshot, click, type, scroll) with ref-based element targeting. Phase 3 adds screenshot capability for debugging and visual verification. Each phase delivers testable, demonstrable value following the snapshot-before-act pattern.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure** - BrowserToolset foundation with lifecycle management and navigation
- [ ] **Phase 2: Core Actions** - Snapshot and interaction tools (click, type, scroll)
- [ ] **Phase 3: Screenshot** - Visual capture tool for debugging and verification

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
**Plans**: TBD

Plans:
- [ ] 01-01: [TBD - defined during plan-phase]

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
**Plans**: TBD

Plans:
- [ ] 02-01: [TBD - defined during plan-phase]

### Phase 3: Screenshot
**Goal**: Agents can capture visual screenshots for debugging and verification
**Depends on**: Phase 2
**Requirements**: REQ-07
**Success Criteria** (what must be TRUE):
  1. Agent can capture screenshot of current viewport
  2. Agent can capture full-page screenshot
  3. Screenshot returns base64 data with dimensions for multimodal use
**Plans**: TBD

Plans:
- [ ] 03-01: [TBD - defined during plan-phase]

## Requirement Coverage

| REQ ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| REQ-01 | BrowserToolset Class | Phase 1 | Pending |
| REQ-02 | Navigate Tool | Phase 1 | Pending |
| REQ-09 | Resource Cleanup | Phase 1 | Pending |
| REQ-10 | Timeout Management | Phase 1 | Pending |
| REQ-03 | Snapshot Tool | Phase 2 | Pending |
| REQ-04 | Click Tool | Phase 2 | Pending |
| REQ-05 | Type Tool | Phase 2 | Pending |
| REQ-06 | Scroll Tool | Phase 2 | Pending |
| REQ-08 | Error Handling | Phase 2 | Pending |
| REQ-07 | Screenshot Tool | Phase 3 | Pending |

**Coverage:** 10/10 requirements mapped

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 0/TBD | Not started | - |
| 2. Core Actions | 0/TBD | Not started | - |
| 3. Screenshot | 0/TBD | Not started | - |

---

*Roadmap created: 2026-01-26*
