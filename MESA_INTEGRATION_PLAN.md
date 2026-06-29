# Mesa workspace integration plan

## Status

Planning document for review before implementation.

## Goal

Add a Mesa-backed filesystem provider for Mastra workspaces so agents can read,
write, list, move, copy, and delete files stored in Mesa repos through the
standard `WorkspaceFilesystem` interface.

The first milestone should focus on filesystem behavior only. Mesa also exposes
an in-process Bash runtime, but command execution maps better to a later
workspace sandbox integration after file semantics are stable.

## Background

Mastra workspace filesystem providers implement the `WorkspaceFilesystem`
interface from `@mastra/core/workspace`. Existing provider packages live under
`workspaces/*` and expose:

- a filesystem class, such as `S3Filesystem` or `FilesSDKFilesystem`
- a `MastraEditor` provider descriptor, such as `s3FilesystemProvider`
- package metadata, build config, README, tests, docs, and a changeset

Mesa's TypeScript SDK package is `@mesadev/sdk`. Its filesystem API exposes a
`MesaFileSystem` implementation with methods that closely match Mastra's
filesystem contract:

- `readFile`
- `readFileBuffer`
- `writeFile`
- `appendFile`
- `exists`
- `stat`
- `mkdir`
- `readdir`
- `readdirWithFileTypes`
- `rm`
- `cp`
- `mv`
- `realpath`

It also exposes Mesa-specific versioning APIs:

- `change.new`
- `change.edit`
- `change.list`
- `change.current`
- `bookmark.create`
- `bookmark.move`
- `bookmark.list`

Those versioning APIs should remain available through an escape hatch on the
provider instance. They should not be forced into Mastra's generic filesystem
interface, but exposing direct provider helpers such as `filesystem.change`,
`filesystem.bookmark`, and `filesystem.bash()` is useful and keeps callers from
digging through private state.

## Recommended package shape

Create a new package:

```text
workspaces/mesa/
```

Published package name:

```text
@mastra/mesa
```

Initial file structure:

```text
workspaces/mesa/
  CHANGELOG.md
  README.md
  eslint.config.js
  lint-staged.config.js
  package.json
  tsconfig.json
  tsconfig.build.json
  tsup.config.ts
  vitest.config.ts
  src/
    index.ts
    provider.ts
    filesystem/
      index.ts
      index.test.ts
      index.integration.test.ts
```

Use `workspaces/files-sdk` as the main implementation template because it wraps
an external filesystem-like adapter. Use `workspaces/s3` as the template for
package metadata, provider descriptors, and docs conventions.

## Public API

### Basic usage

```ts
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { MesaFilesystem } from '@mastra/mesa';

const workspace = new Workspace({
  filesystem: new MesaFilesystem({
    apiKey: process.env.MESA_API_KEY,
    org: 'acme',
    repos: [{ name: 'docs', bookmark: 'main' }],
  }),
});

const agent = new Agent({
  name: 'file-agent',
  model: '__GATEWAY_ANTHROPIC_MODEL_OPUS__',
  workspace,
});
```

### Constructor options

Use one constructor option shape. The provider creates the Mesa client and
mounts repos during `init()`:

```ts
new MesaFilesystem({
  apiKey: process.env.MESA_API_KEY,
  org: 'acme',
  repos: [{ name: 'docs', bookmark: 'main' }],
});
```

Proposed options:

```ts
interface MesaFilesystemOptions extends MastraFilesystemOptions {
  id?: string;
  displayName?: string;
  icon?: FilesystemIcon;
  description?: string;
  readOnly?: boolean;

  apiKey?: string;
  apiUrl?: string;
  vcsUrl?: string;
  org?: string;
  repos: RepoConfig[];
  cache?: {
    diskCache?: {
      path: string;
      maxSizeBytes?: number;
    };
  };
  ttl?: number;
  telemetry?: TelemetryConfig;
}
```

Validation rule:

- `repos` should be required.
- `apiKey` can be optional if the Mesa SDK's `MESA_API_KEY` fallback is enough.
- If `readOnly` is set on the Mastra provider, Mastra write operations should be
  blocked even if the Mesa repo config is writable.
- The raw mounted `MesaFileSystem` can still be exposed as a read-only property
  after initialization for advanced SDK access.

### Exports

```ts
export {
  MesaFilesystem,
  type MesaFilesystemOptions,
} from './filesystem';

export { mesaFilesystemProvider } from './provider';
```

Optional type exports from Mesa can be re-exported only if they improve the
Mastra API. Prefer importing Mesa types from `@mesadev/sdk` unless there is a
clear ergonomic reason to re-export them.

## Implementation details

### Class metadata

`MesaFilesystem` should extend `MastraFilesystem`.

Expected properties:

```ts
readonly name = 'MesaFilesystem';
readonly provider = 'mesa';
readonly icon = 'mesa';
readonly displayName = 'Mesa';
```

`status` should start as `'pending'`.

### Lifecycle

Initialize lazily through `MastraFilesystem.ensureReady()`.

`init()` behavior:

- construct `new Mesa({ apiKey, apiUrl, vcsUrl, org })`
- call `mesa.fs.mount({ repos, cache, ttl, telemetry })`
- store the returned `MesaFileSystem`

`destroy()` can be a no-op unless the Mesa SDK later exposes an explicit close
or unmount API for app mounts.

### Path normalization

Use POSIX-style paths. Keep normalization narrow:

- convert empty path, `.`, and `/` to `/`
- preserve leading `/` because Mesa mounts expose repos at absolute-style paths
- do not implement local-disk containment; Mesa is remote and scoped by org,
  mounted repos, bookmarks, and change IDs
- Mesa filesystem paths include both the org and repo name, such as
  `/acme/docs/README.md`

Confirm path examples during implementation with a real Mesa mount. The Mesa
examples repo uses `/<org>/<repo>` as the working directory shape, so document
that clearly in `getInstructions()`.

### Operation mapping

| Mastra method | Mesa method | Notes |
| --- | --- | --- |
| `readFile(path)` | `readFileBuffer(path)` | Return `Buffer` by default. |
| `readFile(path, { encoding })` | `readFile(path, { encoding })` | Return string when encoding is requested. |
| `writeFile` | `writeFile` | Convert `Buffer` to `Uint8Array`. |
| `appendFile` | `appendFile` | Convert `Buffer` to `Uint8Array`. |
| `deleteFile` | `rm` | Reject directories with `IsDirectoryError`. Honor `force`. |
| `copyFile` | `cp` | Use `recursive` for directories. |
| `moveFile` | `mv` | Preflight `overwrite: false` best-effort. |
| `mkdir` | `mkdir` | Pass `recursive`. |
| `rmdir` | `rm` | Pass `recursive` and `force`. |
| `readdir` | `readdirWithFileTypes` | Support recursive, extension, maxDepth. |
| `exists` | `exists` | Delegate. |
| `stat` | `stat` | Map `FsStat` to Mastra `FileStat`. |
| `realpath` | `realpath` | Delegate. |

### Content conversion

Mastra accepts:

```ts
string | Buffer | Uint8Array
```

Mesa accepts:

```ts
string | Uint8Array
```

Convert with:

```ts
function toMesaContent(content: FileContent): string | Uint8Array {
  if (typeof content === 'string') return content;
  if (Buffer.isBuffer(content)) return new Uint8Array(content);
  return content;
}
```

### Stat mapping

Mesa's `FsStat` includes:

- `isFile`
- `isDirectory`
- `isSymbolicLink`
- `mode`
- `size`
- `mtime`

Mastra's `FileStat` requires:

- `name`
- `path`
- `type`
- `size`
- `createdAt`
- `modifiedAt`
- optional `mimeType`

Use `mtime` for both `createdAt` and `modifiedAt` unless Mesa exposes creation
time in a later SDK version.

### Error mapping

Implement a small error normalization layer that maps Mesa/just-bash errors to
Mastra workspace errors where possible:

- missing file: `FileNotFoundError`
- missing directory: `DirectoryNotFoundError`
- existing file on `overwrite: false`: `FileExistsError`
- directory passed to file operation: `IsDirectoryError`
- file passed to directory operation: `NotDirectoryError`
- non-empty directory: `DirectoryNotEmptyError`
- read-only operation: `WorkspaceReadOnlyError`

The exact Mesa error shape needs to be verified during implementation. Start
with conservative detection by error code/name/message and keep the helper
private to the package.

### Read-only handling

Mirror existing provider behavior:

- expose `readonly readOnly?: boolean`
- call `assertWritable(operation)` before all write operations
- throw `WorkspaceReadOnlyError`

Write operations:

- `writeFile`
- `appendFile`
- `deleteFile`
- `copyFile`
- `moveFile`
- `mkdir`
- `rmdir`

### Concurrency and atomicity

Mastra supports `WriteOptions.expectedMtime` and `overwrite: false`.

Unless Mesa exposes native conditional writes, implement these as best-effort
preflight checks:

- `overwrite: false`: check `exists(path)` before writing or moving
- `expectedMtime`: `stat(path)` and compare `mtime` before writing

Document that these are not atomic in the Mesa provider reference.

### Provider descriptor

Add `src/provider.ts`:

```ts
import type { FilesystemProvider } from '@mastra/core/editor';

export const mesaFilesystemProvider: FilesystemProvider<MesaFilesystemOptions> = {
  id: 'mesa',
  name: 'Mesa',
  description: 'Versioned Mesa filesystem for workspace files',
  configSchema: {
    type: 'object',
    required: ['repos'],
    properties: {
      apiKey: { type: 'string', description: 'Mesa API key' },
      org: { type: 'string', description: 'Mesa org slug' },
      repos: {
        type: 'array',
        description: 'Mesa repos to mount',
        items: { type: 'object' },
      },
      cache: { type: 'object', description: 'Mesa filesystem cache configuration' },
      ttl: { type: 'number', description: 'Mesa mount token lifetime in seconds' },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
    },
  },
  createFilesystem: config => new MesaFilesystem(config),
};
```

Avoid putting non-serializable `filesystem` instances in the editor config
schema.

### Instructions

Implement `getInstructions()` with concise path semantics:

- identify the mounted Mesa org
- list repo names when available
- explain whether paths start at `/` and include the repo name
- mention read-only mode when enabled
- mention versioned storage when useful

Example:

```text
Mesa filesystem mounted for org "acme". Paths are rooted at the Mesa mount and
include the org and repo name, for example "/acme/docs/README.md". Files are
versioned by Mesa. Mounted read-only.
```

## Tests

### Unit tests

Mock the Mesa SDK constructor and `mesa.fs.mount()` return value.

Cover:

- constructor metadata and generated IDs
- lazy `init()` through `ensureReady()`
- Mesa client creation and repo mount options
- read with and without encoding
- write content conversion
- append content conversion
- delete file behavior
- copy and move behavior
- mkdir and rmdir behavior
- readdir filtering and recursion
- exists and stat mapping
- read-only mode blocks writes
- `bash()`, `change`, and `bookmark` delegate to the mounted Mesa filesystem
- `getInfo()`
- `getInstructions()`
- provider descriptor shape

### Integration tests

Add `index.integration.test.ts`, skipped unless required env vars exist.

Suggested env vars:

```text
MESA_API_KEY
MESA_ORG
MESA_TEST_REPO
MESA_TEST_BOOKMARK
```

Integration coverage:

- mount a repo
- create a unique test directory
- write/read text file
- write/read binary file
- list directory
- copy file
- move file
- delete file
- clean up test directory

Do not make integration tests part of the default package `test:unit` path.

## Docs

Add:

```text
docs/src/content/en/reference/workspace/mesa-filesystem.mdx
```

Update:

```text
docs/src/content/en/docs/workspace/filesystem.mdx
```

Reference page should include:

- installation
- basic usage
- constructor parameters
- properties
- methods
- path semantics
- Mesa versioning escape hatch
- read-only mode
- concurrency/atomicity caveats
- related links

Docs examples must use placeholder model tokens, not concrete model names, per
repo guidance.

## Changeset

After implementation, create a changeset with the repo CLI:

```bash
pnpm changeset -s -m "Added a Mesa filesystem provider for Mastra workspaces." --minor @mastra/mesa
```

If docs-only package metadata requires a separate package bump, decide that at
implementation time. The likely primary bump is the new `@mastra/mesa` package.

## Validation commands

Prefer narrow checks:

```bash
pnpm --filter ./workspaces/mesa test:unit
pnpm --filter ./workspaces/mesa build
pnpm --filter ./workspaces/mesa lint
```

If integration credentials are configured:

```bash
pnpm --filter ./workspaces/mesa test
```

If docs are edited:

```bash
pnpm --filter ./docs build
```

Avoid repo-wide builds or tests unless narrow checks expose cross-package
issues that require broader validation.

## Open questions

1. Should `MesaFilesystem` require explicit `org`, or rely on the Mesa SDK's
   default org inference when omitted?
2. Should the default mounted repo revision use a bookmark, a change ID, or
   whatever Mesa chooses when neither is provided?
3. Should phase 2 add a `MesaSandbox` that wraps Mesa's `bash()` runtime more
   deeply than the provider-level `bash()` helper?
4. Does Mesa expose atomic conditional write operations that can implement
   `overwrite: false` and `expectedMtime` without race windows?

## Out of scope for the first milestone

- A Mesa sandbox or process manager
- FUSE mounting Mesa into other sandbox providers
- UI-specific custom forms beyond the generic editor provider schema
- First-class Mastra abstractions for Mesa changes, bookmarks, diffs, or
  webhooks
- Migration tooling from other workspace filesystems
