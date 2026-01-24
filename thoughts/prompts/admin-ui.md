# LANE 9 - Admin UI (after Phase 2)

Create implementation plan for LANE 9: @mastra/admin-ui Admin Dashboard.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**:
- LANES 1-5 (Backend complete)
- LANE 4 (Local Source for project listing)

This includes:
- packages/admin-ui/ package setup
- Tech stack (Next.js/React, likely reuse playground-ui patterns)
- Authentication flow (integrates with Supabase Auth)
- Dashboard pages:
  - Login/signup
  - Dashboard home (overview of teams, projects)
  - Team management (create, settings, members)
  - Team member management (invite, roles, remove)
  - Project list and detail
  - Project creation (with source picker)
  - Deployment management (create, start, stop, view)
  - Build logs and status (real-time streaming)
  - Environment variables management
  - Observability dashboard (traces, logs, metrics)
  - RBAC role assignment
- Project Source flows:
  - ProjectSourcePicker component (lists projects from ProjectSourceProvider.listProjects())
  - Source type indicator (local vs GitHub when available)
  - Project validation status
- API client for admin backend
- Real-time updates (WebSocket or polling):
  - Build progress
  - Server health status
  - Log streaming

Key components:
```typescript
// Project Source Picker
function ProjectSourcePicker({ teamId, onSelect });

// Source type indicator
function SourceTypeIcon({ type }: { type: string });

// Build log viewer
function BuildLogViewer({ buildId });

// Deployment status card
function DeploymentCard({ deployment });
```

Save plan to: thoughts/shared/plans/2025-01-23-admin-ui.md
