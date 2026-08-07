---
'@mastra/factory': patch
---

Added a durable filesystem slot to MastraFactory. Passing a WorkspaceFilesystem as the new `filesystem` config (PlatformFilesystem on deployments, LocalFilesystem for local development) mounts a durable, factory-wide filesystem at /factory inside every Factory session workspace. Files written there through the workspace file tools survive sandbox teardown and are shared across sessions — useful for plans, notes, handoffs, or anything else that doesn't belong in version control. Each session sees the org-wide /factory/shared directory and its own project's directory only — other projects and other orgs stay invisible. The factory web UI gains a read-only "File System" page backed by new `/web/factory/fs/*` routes, where signed-in org members can browse the whole org tree with the current project's directory open by default.
