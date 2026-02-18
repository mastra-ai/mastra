---
'@mastra/core': minor
'@mastra/editor': minor
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mongodb': minor
'@mastra/server': minor
'@mastra/e2b': patch
'@mastra/gcs': patch
'@mastra/s3': minor
'@mastra/clickhouse': patch
---

Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution.

**Filesystem-native skill versioning (draft → publish model):**

Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:

- `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
- Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
- Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

**Agent skill resolution strategies:**

Agents can reference skills with different resolution strategies:
- `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
- `pin: '<versionId>'` — Pins to a specific version, immune to publishes
- `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

**Blob storage infrastructure:**

- `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
- `InMemoryBlobStore` for testing
- LibSQL, Postgres, and MongoDB implementations
- `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
- `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
- `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

**New storage types:**

- `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
- `StorageWorkspaceRef` for ID-based or inline workspace references on agents
- `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
- `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
- `StorageBlobEntry` for content-addressable blob entries
- `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

**New editor namespaces:**

- `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
- `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

**Provider registries:**

- `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
- Built-in `local` filesystem and sandbox providers are auto-registered
- `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
- Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

**Storage adapter support:**

- LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
- Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
- MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
- All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

**Server endpoints:**

- `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
- `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
- `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

```ts
import { MastraEditor } from '@mastra/editor';
import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
import { e2bSandboxProvider } from '@mastra/e2b';

const editor = new MastraEditor({
  filesystems: { s3: s3FilesystemProvider },
  sandboxes: { e2b: e2bSandboxProvider },
  blobStores: { s3: s3BlobStoreProvider },
});

// Create a skill and publish it
const skill = await editor.skill.create({
  name: 'Code Review',
  description: 'Reviews code for best practices',
  instructions: 'Analyze the code and provide feedback...',
});
await editor.skill.publish(skill.id, source, 'skills/code-review');

// Agents resolve skills by strategy
await editor.agent.create({
  name: 'Dev Assistant',
  model: { provider: 'openai', name: 'gpt-4' },
  workspace: { type: 'id', workspaceId: workspace.id },
  skills: { [skill.id]: { strategy: 'latest' } },
  skillsFormat: 'xml',
});
```
