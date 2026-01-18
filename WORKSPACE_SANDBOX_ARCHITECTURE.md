# Workspace Sandbox Architecture

Design exploration for how filesystem and sandbox components should interact within a Workspace.

---

## Current State

Workspace components are currently independent:

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  skillsPaths: ['/skills'],
  bm25: true,
});
```

**Issues:**

- `LocalSandbox` writes temp script files to `/tmp`, so `__dirname` doesn't work
- Filesystem and sandbox paths must be manually aligned
- No automatic context sharing between components

---

## Component Dependencies

| Component  | Requires            | Notes                                                 |
| ---------- | ------------------- | ----------------------------------------------------- |
| Skills     | Filesystem          | Skills ARE SKILL.md files - must read from filesystem |
| Sandbox    | Nothing (currently) | Can execute code independently                        |
| Search     | Nothing             | Can index arbitrary content                           |
| Filesystem | Nothing             | Core storage primitive                                |

**Proposed:**

- Skills should throw an error if configured without filesystem
- Sandbox should be aware of filesystem when both are present

---

## Context Compatibility

### Same-Context Combinations

These naturally share the same execution environment:

| Filesystem        | Sandbox        | Context            |
| ----------------- | -------------- | ------------------ |
| `LocalFilesystem` | `LocalSandbox` | Same machine       |
| `E2BFilesystem`   | `E2BSandbox`   | Same E2B container |

For same-context combinations:

- Sandbox should share filesystem's basePath
- `__dirname` and `process.cwd()` should both work
- No sync operations needed

### Cross-Context Combinations

These have isolated environments:

| Filesystem               | Sandbox        | Context                           |
| ------------------------ | -------------- | --------------------------------- |
| `AgentFS` (SQLite/Turso) | `LocalSandbox` | Files in DB, execution on host    |
| `LocalFilesystem`        | `ComputeSDK`   | Files on disk, execution in cloud |
| `AgentFS`                | `ComputeSDK`   | Both remote but separate          |

For cross-context combinations:

- Must use `syncToSandbox()` / `syncFromSandbox()` to transfer files
- Code executes in sandbox's isolated environment
- Results synced back after execution

---

## Proposed Architecture

### 1. Context Detection

Workspace should detect if filesystem and sandbox share the same context:

```typescript
class Workspace {
  private contextsAreCompatible(): boolean {
    // LocalFilesystem + LocalSandbox = compatible (same machine)
    // E2BFilesystem + E2BSandbox = compatible (same container)
    // Otherwise = incompatible (need sync)
  }
}
```

### 2. LocalSandbox Fix

When LocalFilesystem and LocalSandbox are both present:

```typescript
// Current - writes to /tmp (breaks __dirname)
const tempFile = path.join(os.tmpdir(), `mastra-code-${id}`);

// Proposed - writes to workspace
const tempFile = path.join(this.workingDirectory, `.mastra/sandbox/code-${id}`);
```

This ensures:

- `__dirname` = workspace directory
- `process.cwd()` = workspace directory
- Script files live in the workspace (can be gitignored)

### 3. Automatic Context Sharing

When creating a Workspace with compatible components:

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  sandbox: true, // Auto-create LocalSandbox with filesystem's basePath
  skillsPaths: ['/skills'],
});

// Or explicit but validated:
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  sandbox: new LocalSandbox(), // Inherits basePath from filesystem
  skillsPaths: ['/skills'],
});
```

### 4. Cross-Context Workflow

For incompatible contexts, explicit sync is required:

```typescript
// Sync files to sandbox before execution
await workspace.syncToSandbox(['/src', '/package.json']);

// Execute code in sandbox
const result = await workspace.executeCode(`
  const pkg = require('./package.json');
  console.log(pkg.name);
`);

// Sync results back
await workspace.syncFromSandbox(['/dist', '/output.json']);
```

---

## Validation Rules

### Skills Validation ✅ Implemented

Skills require filesystem - throws error if misconfigured:

```typescript
if (config.skillsPaths && !config.filesystem) {
  throw new WorkspaceError(
    'Skills require a filesystem provider. Configure filesystem or remove skillsPaths.',
    'SKILLS_REQUIRE_FILESYSTEM',
  );
}
```

This validation is enforced in the `Workspace` constructor.

### Sandbox Validation

Sandbox can work without filesystem, but warn about limitations:

```typescript
if (config.sandbox && !config.filesystem) {
  // Valid but limited - no persistent file storage
  // executeCode works but files are ephemeral
}
```

---

## Provider Matrix

| Provider            | Package                      | Type       | Compatible With   |
| ------------------- | ---------------------------- | ---------- | ----------------- |
| `LocalFilesystem`   | `@mastra/core`               | Filesystem | `LocalSandbox`    |
| `AgentFS`           | `@mastra/filesystem-agentfs` | Filesystem | (requires sync)   |
| `LocalSandbox`      | `@mastra/core`               | Sandbox    | `LocalFilesystem` |
| `ComputeSDKSandbox` | `@mastra/sandbox-computesdk` | Sandbox    | (requires sync)   |
| `E2BFilesystem`     | `@mastra/filesystem-e2b`     | Filesystem | `E2BSandbox`      |
| `E2BSandbox`        | `@mastra/sandbox-e2b`        | Sandbox    | `E2BFilesystem`   |

---

## Design Decisions

### Sandbox Directory ✅ Implemented

The sandbox temp/script directory is **configurable** via the `scriptDirectory` option:

```typescript
const sandbox = new LocalSandbox({
  workingDirectory: './workspace',
  scriptDirectory: './.mastra/sandbox', // Optional, defaults to os.tmpdir()
});
```

**Implementation details:**

- If `scriptDirectory` not provided, uses `os.tmpdir()` (default behavior)
- If provided, script files are written there (enables `__dirname` to resolve within workspace)
- The directory is automatically created on `sandbox.start()` if it doesn't exist
- `getInfo()` includes `scriptDirectory` in metadata
- Should be gitignored if within the workspace (e.g., add `.mastra/` to `.gitignore`)

**Example with workspace context:**

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace',
    scriptDirectory: './workspace/.mastra/sandbox',
  }),
});

// Now __dirname in executed code resolves to ./workspace/.mastra/sandbox
const result = await workspace.executeCode('console.log(__dirname)');
// Output: ./workspace/.mastra/sandbox
```

### Filesystem Awareness

Sandbox should be **aware** of filesystem when both are configured, but doesn't need to share the same path:

```typescript
// Filesystem and sandbox can have different paths
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  sandbox: new LocalSandbox({ workingDirectory: './sandbox' }),
});

// Sandbox knows about filesystem for sync operations
await workspace.syncToSandbox(['/files/to/sync']);
await workspace.executeCode(code);
await workspace.syncFromSandbox(['/output']);
```

This allows:

- Sandbox to act on filesystem when needed (sync, read files)
- Flexibility for different storage locations
- Clear separation when desired

---

## Open Questions

1. **Auto-sync option**: Should Workspace auto-sync before/after executeCode for cross-context?

   ```typescript
   await workspace.executeCode(code, { autoSync: true });
   ```

2. **Context detection API**: Should providers expose a `contextId` for compatibility checking?

3. **Skills from external sources**: Future feature - skills from npm packages, URLs, etc.?

---

## Related Documents

- [UNIFIED_WORKSPACE_DESIGN.md](./UNIFIED_WORKSPACE_DESIGN.md) - Overall workspace architecture
- [WORKSPACE_UI_DESIGN.md](./WORKSPACE_UI_DESIGN.md) - UI visualization options
