# Roadmap: Mastra Browser Tools

## Milestones

- [x] **v1.0 Browser Toolset** - Phases 1-6 (shipped 2026-01-27)
- [x] **v1.1 Browser Live View** - Phases 7-9 (shipped 2026-01-28)

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

<details>
<summary>v1.1 Browser Live View (Phases 7-9) - SHIPPED 2026-01-28</summary>

### Phase 7: Screencast API
**Goal**: BrowserToolset exposes methods to control CDP screencast capture and input injection
**Plans**: 1 plan

Plans:
- [x] 07-01: Screencast types, ScreencastStream class, and BrowserToolset integration

### Phase 8: Transport Layer
**Goal**: WebSocket server endpoint relays screencast frames to connected Studio clients
**Plans**: 2 plans

Plans:
- [x] 08-01: Browser-stream module with types, ViewerRegistry, and WebSocket route setup
- [x] 08-02: Server integration with deployer createNodeServer

### Phase 9: Studio UI
**Goal**: BrowserViewPanel component renders live screencast inline with agent chat
**Plans**: 2 plans

Plans:
- [x] 09-01: useBrowserStream hook with BrowserViewFrame and BrowserViewHeader components
- [x] 09-02: BrowserViewPanel assembly and AgentLayout browserSlot integration

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | 2/2 | Complete | 2026-01-26 |
| 2. Core Actions | v1.0 | 3/3 | Complete | 2026-01-26 |
| 3. Screenshot | v1.0 | 1/1 | Complete | 2026-01-26 |
| 4. Error Consistency | v1.0 | 1/1 | Complete | 2026-01-27 |
| 5. Schema Consolidation | v1.0 | 2/2 | Complete | 2026-01-27 |
| 6. Lifecycle Locking | v1.0 | 1/1 | Complete | 2026-01-27 |
| 7. Screencast API | v1.1 | 1/1 | Complete | 2026-01-27 |
| 8. Transport Layer | v1.1 | 2/2 | Complete | 2026-01-27 |
| 9. Studio UI | v1.1 | 2/2 | Complete | 2026-01-28 |

---
*Roadmap created: 2026-01-27*
*Last updated: 2026-01-28 — v1.1 milestone archived*
