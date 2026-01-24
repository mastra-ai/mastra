# LANE 4 - Local Project Source (parallel with other Phase 2 lanes)

Create implementation plan for LANE 4: @mastra/source-local local project source.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete first (for ProjectSourceProvider interface).

This includes:
- sources/local/ package setup
- LocalProjectSource implementing ProjectSourceProvider interface
- Local filesystem operations:
  - Configure base directories where Mastra projects live
  - Scan directories for valid Mastra projects (detect by package.json, mastra config)
  - List discovered projects
  - Validate project accessibility
- Project path resolution:
  - Return local path directly (no cloning needed)
  - Validate path exists and is accessible
- File watching (optional for hot reload):
  - Watch for file changes in project directories
  - Notify runner of changes for dev mode
- MastraProjectDetector helper:
  - isMastraProject(dir) - detect if directory is a Mastra project
  - getProjectMetadata(dir) - get project metadata (name, version, package manager, etc.)

Key interface to implement:
```typescript
export interface ProjectSourceProvider {
  readonly type: 'local' | 'github' | string;
  listProjects(teamId: string): Promise<ProjectSource[]>;
  getProject(projectId: string): Promise<ProjectSource>;
  validateAccess(source: ProjectSource): Promise<boolean>;
  getProjectPath(source: ProjectSource, targetDir: string): Promise<string>;
  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void;
}
```

Save plan to: thoughts/shared/plans/2025-01-23-source-local.md
