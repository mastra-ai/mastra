# MastraAdmin Implementation Retrospective - Attempt 1

**Date**: 2026-01-26
**Branch**: `mastra-admin-example`
**Base Branch**: `mastra-admin-rph`
**Commits**: 28 commits, ~8,700 lines added, ~500 lines removed

## Overview

This retrospective documents the gap between the original PRD (master plan) and what was actually required during implementation of the MastraAdmin example application. The goal is to capture learnings that will improve future PRDs.

---

## What Was Planned vs What Was Implemented

### 1. Planned Architecture Assumptions

The master plan assumed a clean separation:
- **Build Logs** → PostgreSQL → REST API
- **Server Observability** → File Storage → ClickHouse → Query API

**Reality**: This separation required significant "glue code" that wasn't anticipated:

| Planned | Actually Required |
|---------|------------------|
| Build logs go to PostgreSQL | Build logs needed WebSocket streaming + file flush + in-memory buffering |
| Server logs work automatically | Required manual wiring: LogCollector → callback → ServerLogStreamer → WebSocket |
| Routes call providers | Routes returned hardcoded empty results - needed full implementation |
| Source provider lists projects | Worked for listing, but `getProjectPath()` ignored `targetDir` parameter |

### 2. UI Wiring Gaps

**Planned**: UI components exist and work when backend is ready

**Reality**: UI components existed but were not wired up:

| Component | Missing Wiring |
|-----------|---------------|
| Deploy button | `onClick` handler not connected to mutation hook |
| Project creation | Form required manual path input instead of using source picker |
| Sources list | `useSources()` hook didn't exist |
| Build logs | Line breaks not preserved in display |

**Learning**: PRDs should include a "UI Integration Checklist" verifying all buttons/actions are wired to API calls.

### 3. Build Queue Persistence

**Planned**: BuildOrchestrator manages queue, BuildWorker processes

**Reality**: In-memory queue lost on server restart

The plan showed:
```
orchestrator.queueBuild(buildId) → in-memory queue → BuildWorker polls
```

Missing from plan:
```
server restart → in-memory queue = empty → builds stuck in "queued" status forever
```

**Solution Added**: `listQueuedBuilds()` method + server startup recovery loop

**Learning**: PRDs should explicitly address "what happens on restart/crash" for any stateful components.

### 4. LocalProjectSource Copy Behavior

**Planned**: Source provider copies project to temp directory for isolated builds

**Reality**: `getProjectPath()` ignored `targetDir` parameter entirely:

```typescript
async getProjectPath(source: ProjectSource, _targetDir: string): Promise<string> {
  // _targetDir intentionally ignored - builds in-place
  return source.path;
}
```

**Problems from building in-place**:
- No fresh `node_modules` installs
- Build artifacts pollute source directory
- No isolated observability directory
- Can't run concurrent builds of same project

**Learning**: PRDs should include explicit test cases like "verify project source copies to temp dir when targetDir provided."

### 5. Observability Injection Gap

**Planned**: Deployed servers automatically emit traces to file storage

**Reality**: Major missing piece - how do deployed servers know where to write observability data?

The plan showed:
```
Mastra Server → ObservabilityWriter → FileStorage → ClickHouse
```

Missing from plan:
```
How does the server know about ObservabilityWriter?
Where does FileStorage config come from?
How is this injected at build/deploy time?
```

**Solution Added**: `AdminBundler` class that injects `FileExporter` during bundling:

```typescript
// AdminBundler generates entry code that includes:
import { FileExporter } from '@mastra/observability';

const fileExporter = new FileExporter({
  outputPath: '${observabilityPath}',
  projectId: '${projectId}',
  deploymentId: '${deploymentId}',
});

// Adds to Mastra config:
observability: {
  exporters: [fileExporter],
}
```

**Learning**: PRDs should trace data flow end-to-end, especially for config/dependency injection across process boundaries.

### 6. WebSocket Setup for Real-time Features

**Planned**: WebSocket infrastructure exists

**Reality**: Manual HTTP server creation required for WebSocket upgrade support

```typescript
// Hono's built-in serve() doesn't support WebSocket upgrade
// Had to manually create HTTP server:
const httpServer = createServer(/* ... */);
const wsServer = new WebSocketServer({ server: httpServer });
```

**Learning**: PRDs should verify framework capabilities for advanced features (WebSocket, SSE, etc.) - don't assume framework handles everything.

### 7. CORS and Multi-Port Development

**Planned**: Not mentioned

**Reality**: Multiple ports needed explicit CORS configuration:

- Admin Server: port 3001
- Admin UI: port 3002 (Vite)
- Proxy: port 3100
- Deployed servers: ports 4100+

Required CORS config update:
```typescript
cors: {
  origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'],
  credentials: true,
}
```

**Learning**: PRDs should include a "Development Environment Setup" section with port allocations and CORS requirements.

### 8. Subdomain vs Path-based Routing

**Planned**: Subdomain-based routing (`my-agent.mastra.local`)

**Reality**: Required `/etc/hosts` editing, wildcard DNS, or custom proxy

Added path-based alternative:
```
http://localhost:3100/my-agent/api/...
```

**Learning**: PRDs should offer multiple routing strategies for different environments (local dev without DNS vs production with DNS).

---

## Key Technical Challenges Encountered

### Challenge 1: TypeScript Build Issues

**Problem**: `runners/local` package not generating `.d.ts` files

**Root Cause**: Missing `declaration: true` in tsconfig.build.json

**Time Spent**: 2+ iterations to diagnose and fix

**Learning**: Build configuration should be verified early with "does it export types correctly?" test.

### Challenge 2: Dynamic Import Bundling

**Problem**: `http-proxy` package bundled by tsup instead of being external

**Root Cause**: tsup.config.ts didn't list optional dependencies as external

**Solution**:
```typescript
// routers/local/tsup.config.ts
export default defineConfig({
  external: ['http-proxy', 'selfsigned'],
});
```

**Learning**: Optional/dynamic imports need explicit `external` configuration in bundlers.

### Challenge 3: Database Schema Assumptions

**Problem**: `envVarOverrides` assumed to always be an array, but JSONB could be null or empty object

**Error**: `deployment.envVarOverrides.map is not a function`

**Solution**: Defensive array check:
```typescript
envVarOverrides: Array.isArray(deployment.envVarOverrides)
  ? deployment.envVarOverrides.map(...)
  : []
```

**Learning**: PRDs should specify exact data shapes for JSONB/JSON columns with validation rules.

### Challenge 4: Missing Slug Generation

**Problem**: Project creation required `slug` field but UI didn't generate it

**Solution**: Auto-generate from name:
```typescript
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}
```

**Learning**: PRDs should specify which fields are auto-generated vs user-provided.

---

## Documentation Created During Implementation

Implementation required creating several research documents to understand gaps:

| Document | Purpose |
|----------|---------|
| `CLAUDE_LEARNINGS.md` | Accumulated session knowledge |
| `2025-01-25-admin-example-observability-alignment.md` | Gap analysis: plan vs implementation |
| `2025-01-25-observability-data-flow-gaps.md` | Runner logs vs spans data flow |
| `2025-01-25-observability-injection-patterns.md` | How to inject exporters |
| `2025-01-25-admin-deployer-implementation-pattern.md` | Bundler architecture study |
| `2025-01-25-cloud-deployer-bundling-observability-injection.md` | Reference implementation study |
| `2025-01-25-observability-architecture-refinement.md` | Refined architecture plan |
| `2025-01-25-admin-bundler-implementation.md` | AdminBundler implementation plan |

**Learning**: The need to create 8 supplementary documents suggests the original plan lacked sufficient detail in these areas.

---

## Testing Gaps Identified

The implementation revealed testing gaps:

### Missing Integration Tests

1. Server restart with builds in DB queue
2. Full BuildWorker → DB → Orchestrator flow
3. End-to-end deploy flow (source → build → deploy → health check)
4. WebSocket connection lifecycle
5. AdminBundler → FileExporter → JSONL output validation

### Missing Unit Tests

1. `LocalProjectSource.getProjectPath()` with targetDir
2. `BuildLogWriter` flush behavior
3. `FileExporter` JSONL format compatibility with ClickHouse ingestion

**Learning**: PRDs should include "Test Cases" section with specific scenarios to verify.

---

## Recommendations for Future PRDs

### 1. Include Data Flow Diagrams with Process Boundaries

The master plan had good architecture diagrams but didn't show:
- How config is passed between processes
- What happens when processes restart
- Where data is buffered vs persisted

**Recommendation**: Add sequence diagrams showing data flow across process boundaries.

### 2. Add "State Recovery" Section

Every stateful component should have explicit documentation for:
- What state is lost on restart?
- How is state recovered?
- What happens to in-flight operations?

### 3. Add "UI Integration Checklist"

For each UI component, explicitly list:
- [ ] Button wired to API call
- [ ] Loading state handled
- [ ] Error state displayed
- [ ] Success feedback shown
- [ ] Form validation implemented

### 4. Specify All Environment Variables

Create exhaustive list of environment variables with:
- Variable name
- Default value
- Required vs optional
- Which component uses it

### 5. Include Port Allocation Table

| Component | Port | Purpose |
|-----------|------|---------|
| Admin Server | 3001 | HTTP API + WebSocket |
| Admin UI | 3002 | Vite dev server |
| Proxy | 3100 | Reverse proxy for deployments |
| Deployed servers | 4100-4199 | Individual deployment ports |

### 6. Add "Known Limitations" Section

Be explicit about what is NOT included:
- MVP limitations
- Features deferred to future phases
- Known workarounds required

### 7. Include "Verification Steps" Per Phase

Instead of just implementation steps, add verification:
```
Phase 1: Build Logs
- [ ] Implement BuildLogWriter
- [ ] VERIFY: Logs appear in file storage after build completes
- [ ] VERIFY: Logs stream in real-time during build via WebSocket
- [ ] VERIFY: Logs retrievable via REST API after build
```

### 8. Document Framework Assumptions

When relying on a framework feature, verify it works:
```
Assumption: Hono supports WebSocket upgrade
Verification needed: Test WebSocket handshake with Hono serve()
Fallback plan: Manual HTTP server creation
```

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Original plan documents | 14 files |
| Research documents created | 8 files |
| Commits | 28 |
| Lines added | ~8,700 |
| Lines removed | ~500 |
| Packages modified | 14 |
| New files created | 40+ |
| Issues fixed post-plan | 10+ |

---

## Conclusion

The master plan provided a solid architectural foundation but underestimated:

1. **Integration complexity** - Wiring components together required more code than the components themselves
2. **UI-to-API wiring** - UI components existed but weren't connected
3. **State management** - In-memory state needed persistence/recovery strategies
4. **Build-time injection** - Getting config into deployed servers was a major gap
5. **Development environment** - CORS, ports, routing needed explicit configuration

For the next iteration, the PRD should include:
- End-to-end data flow with process boundaries
- State recovery procedures
- UI integration checklists
- Explicit verification steps
- Development environment setup

The documentation created during implementation (`CLAUDE_LEARNINGS.md` and research docs) should be consolidated into the next PRD to prevent re-discovery of the same gaps.
