# Roadmap: Mastra Browser Tools

## Milestones

- [x] **v1.0 Browser Toolset** - Phases 1-6 (shipped 2026-01-27)
- [ ] **v1.1 Browser Live View** - Phases 7-9 (in progress)

## Phases

<details>
<summary>v1.0 Browser Toolset (Phases 1-6) - SHIPPED 2026-01-27</summary>

### Phase 1: Infrastructure Setup
**Goal**: Project scaffolding with build, test, and type infrastructure
**Plans**: 2 plans

Plans:
- [x] 01-01: Package structure and build configuration
- [x] 01-02: Test infrastructure and CI setup

### Phase 2: Core Actions
**Goal**: Core browser interaction tools (navigate, snapshot, click, type, scroll)
**Plans**: 3 plans

Plans:
- [x] 02-01: Navigate and snapshot tools
- [x] 02-02: Click and type tools
- [x] 02-03: Scroll tool

### Phase 3: Screenshot
**Goal**: Visual capture tool for agent documentation
**Plans**: 1 plan

Plans:
- [x] 03-01: Screenshot tool with viewport/full-page/element modes

### Phase 4: Navigate Error Consistency
**Goal**: Unified error handling across all tools
**Plans**: 1 plan

Plans:
- [x] 04-01: BrowserToolError unification

### Phase 5: Schema Consolidation
**Goal**: Single source of truth for tool schemas
**Plans**: 2 plans

Plans:
- [x] 05-01: Types.ts as schema source
- [x] 05-02: Schema migration and validation

### Phase 6: Browser Lifecycle Locking
**Goal**: Thread-safe browser initialization
**Plans**: 1 plan

Plans:
- [x] 06-01: Singleton Promise pattern for getBrowser

</details>

### v1.1 Browser Live View (In Progress)

**Milestone Goal:** Users can watch browser agents work in real-time from within Mastra Studio

- [x] **Phase 7: Screencast API** - Extend BrowserToolset with CDP screencast controls
- [ ] **Phase 8: Transport Layer** - WebSocket endpoint for frame delivery to Studio
- [ ] **Phase 9: Studio UI** - Browser view panel rendering inline with agent chat

## Phase Details

### Phase 7: Screencast API
**Goal**: BrowserToolset exposes methods to control CDP screencast capture and input injection
**Depends on**: Phase 6 (browser lifecycle must be stable)
**Requirements**: CAST-01, CAST-02, CAST-03, CAST-04, CAST-05
**Success Criteria** (what must be TRUE):
  1. Calling `startScreencast()` on BrowserToolset begins receiving CDP frames
  2. Calling `stopScreencast()` stops frame delivery and releases resources
  3. Each received frame triggers CDP `screencastFrameAck` to prevent memory exhaustion
  4. Input injection methods exist (passthrough for future use)
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md — Screencast types, ScreencastStream class, and BrowserToolset integration

### Phase 8: Transport Layer
**Goal**: WebSocket server endpoint relays screencast frames to connected Studio clients
**Depends on**: Phase 7 (needs screencast API)
**Requirements**: XPORT-01, XPORT-02, XPORT-03, XPORT-04
**Success Criteria** (what must be TRUE):
  1. WebSocket connection can be established at `/browser/:agentId/stream`
  2. Connected clients receive CDP frames as they are captured
  3. Disconnecting clients are cleaned up without memory leaks
  4. Screencast only runs when at least one viewer is connected (no wasted CPU)
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — Browser-stream module with types, ViewerRegistry, and WebSocket route setup
- [ ] 08-02-PLAN.md — Server integration with deployer createNodeServer

### Phase 9: Studio UI
**Goal**: BrowserViewPanel component renders live screencast inline with agent chat
**Depends on**: Phase 8 (needs working WebSocket endpoint)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. Browser panel renders screencast frames inline with agent chat
  2. Frame updates do not cause visible UI lag or freezing
  3. Connection status indicator shows connected/connecting/disconnected states
  4. Empty state displays when no browser is active for the agent
  5. Loading state displays during browser initialization
**Plans**: TBD

Plans:
- [ ] 09-01: TBD (BrowserViewPanel component)
- [ ] 09-02: TBD (connection status and states)
- [ ] 09-03: TBD (agent layout integration)

## Progress

**Execution Order:** Phases 7 -> 8 -> 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | 2/2 | Complete | 2026-01-26 |
| 2. Core Actions | v1.0 | 3/3 | Complete | 2026-01-26 |
| 3. Screenshot | v1.0 | 1/1 | Complete | 2026-01-26 |
| 4. Error Consistency | v1.0 | 1/1 | Complete | 2026-01-27 |
| 5. Schema Consolidation | v1.0 | 2/2 | Complete | 2026-01-27 |
| 6. Lifecycle Locking | v1.0 | 1/1 | Complete | 2026-01-27 |
| 7. Screencast API | v1.1 | 1/1 | Complete | 2026-01-27 |
| 8. Transport Layer | v1.1 | 0/2 | Planned | - |
| 9. Studio UI | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-27*
*Last updated: 2026-01-27 after Phase 8 planning*
