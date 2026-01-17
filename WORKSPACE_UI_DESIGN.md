# Workspace UI Design

Design document for Workspace UI visualization in the Mastra Playground.

---

## Current State

The Workspace UI (`/workspace` page) currently displays:

- **Files tab** - File browser with read/write/delete operations
- **Skills tab** - Skills table with details view
- **Search panel** - BM25/vector search across files and skills

**Missing:** Sandbox visualization - the `hasSandbox` capability is exposed but not rendered.

---

## Provider Architecture

Both filesystem and sandbox follow a **provider pattern** allowing different backends:

### Filesystem Providers

| Provider          | Package                      | Storage      | Use Case        |
| ----------------- | ---------------------------- | ------------ | --------------- |
| `LocalFilesystem` | `@mastra/core`               | Local disk   | Development     |
| `AgentFilesystem` | `@mastra/filesystem-agentfs` | SQLite/Turso | Portable, cloud |
| `RamFilesystem`   | (exploration)                | In-memory    | Testing         |

### Sandbox Providers

| Provider            | Package                      | Execution                | Use Case    |
| ------------------- | ---------------------------- | ------------------------ | ----------- |
| `LocalSandbox`      | `@mastra/core`               | Host machine             | Development |
| `ComputeSDKSandbox` | `@mastra/sandbox-computesdk` | Cloud (E2B, Modal, etc.) | Production  |

---

## UI Enhancement Options

### Option 1: Capabilities Badges

**Complexity:** Low
**Value:** Shows users what's available at a glance

Add capability indicators to the workspace header:

```
Workspace
├── [Filesystem ✓] [Sandbox ✓] [BM25 ✓] [Vector ✗] [Skills ✓]
```

**Implementation:**

- Add badges to `PageHeader` component
- Read from `workspaceInfo.capabilities`
- Color-code: green for enabled, gray for disabled

**Component structure:**

```tsx
<div className="flex gap-2">
  <Badge variant={hasFilesystem ? 'success' : 'muted'}>Filesystem</Badge>
  <Badge variant={hasSandbox ? 'success' : 'muted'}>Sandbox</Badge>
  <Badge variant={canBM25 ? 'success' : 'muted'}>BM25</Badge>
  <Badge variant={canVector ? 'success' : 'muted'}>Vector</Badge>
  <Badge variant={hasSkills ? 'success' : 'muted'}>Skills</Badge>
</div>
```

---

### Option 2: Sandbox Info Panel

**Complexity:** Low
**Value:** Shows sandbox status and metadata

A collapsible panel showing sandbox details:

```
┌─────────────────────────────────────┐
│ Sandbox                        [▼]  │
├─────────────────────────────────────┤
│ Status:     ● Running               │
│ Provider:   local                   │
│ Runtimes:   node, python, bash      │
│ Directory:  /path/to/workspace      │
│ Timeout:    30s                     │
└─────────────────────────────────────┘
```

**API additions needed:**

```typescript
// GET /api/workspace/sandbox/info
interface SandboxInfoResponse {
  status: 'stopped' | 'starting' | 'running' | 'error';
  provider: string;
  supportedRuntimes: string[];
  workingDirectory?: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

---

### Option 3: Code Execution Panel

**Complexity:** Medium
**Value:** Interactive code execution (REPL-like experience)

A panel for executing code snippets:

```
┌─────────────────────────────────────────────────────────┐
│ Execute Code                                            │
├─────────────────────────────────────────────────────────┤
│ Runtime: [Node.js ▼]  [Python]  [Bash]                  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ console.log("Hello, World!");                       │ │
│ │ const sum = [1,2,3].reduce((a,b) => a+b, 0);        │ │
│ │ console.log("Sum:", sum);                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                        [▶ Execute]      │
├─────────────────────────────────────────────────────────┤
│ Output                                    ✓ 0.042s      │
├─────────────────────────────────────────────────────────┤
│ Hello, World!                                           │
│ Sum: 6                                                  │
└─────────────────────────────────────────────────────────┘
```

**Features:**

- Runtime selector (based on `supportedRuntimes`)
- Code editor with syntax highlighting (Monaco or CodeMirror)
- Execute button
- Output display with:
  - stdout (normal text)
  - stderr (red text)
  - Exit code indicator
  - Execution time

**API additions needed:**

```typescript
// POST /api/workspace/sandbox/execute
interface ExecuteCodeRequest {
  code: string;
  runtime: 'node' | 'python' | 'bash' | 'ruby';
  timeout?: number;
  env?: Record<string, string>;
}

interface ExecuteCodeResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
}
```

**Component structure:**

```tsx
<CodeExecutionPanel
  supportedRuntimes={sandboxInfo.supportedRuntimes}
  onExecute={(code, runtime) => executeCode.mutate({ code, runtime })}
  result={executeCode.data}
  isExecuting={executeCode.isPending}
/>
```

---

### Option 4: Terminal Tab

**Complexity:** High
**Value:** Full shell access for power users

Add a "Terminal" tab alongside "Files" and "Skills":

```
[Files] [Skills] [Terminal]

┌─────────────────────────────────────────────────────────┐
│ $ ls -la                                                │
│ total 24                                                │
│ drwxr-xr-x  5 user  staff   160 Jan 15 10:30 .          │
│ drwxr-xr-x  3 user  staff    96 Jan 15 10:30 ..         │
│ -rw-r--r--  1 user  staff  1024 Jan 15 10:30 config.json│
│ drwxr-xr-x  2 user  staff    64 Jan 15 10:30 skills     │
│                                                         │
│ $ npm install lodash                                    │
│ added 1 package in 1.2s                                 │
│                                                         │
│ $ _                                                     │
└─────────────────────────────────────────────────────────┘
```

**Features:**

- Command input with history (up/down arrows)
- Output log with scrollback
- Support for interactive commands (limited)
- Environment variable display
- Working directory indicator

**API additions needed:**

```typescript
// POST /api/workspace/sandbox/command
interface ExecuteCommandRequest {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

interface ExecuteCommandResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
}
```

**Considerations:**

- Security: Limit dangerous commands in cloud deployments
- Streaming: Consider SSE for long-running commands
- State: Commands run in isolated executions (no persistent shell)

---

### Option 5: Package Manager Panel

**Complexity:** Medium
**Value:** Visual package installation

A panel for managing packages:

```
┌─────────────────────────────────────────────────────────┐
│ Packages                                                │
├─────────────────────────────────────────────────────────┤
│ Manager: [npm ▼]  [yarn]  [pnpm]  [pip]                 │
├─────────────────────────────────────────────────────────┤
│ Install: [lodash________________] [+ Install]           │
├─────────────────────────────────────────────────────────┤
│ Installed:                                              │
│   lodash@4.17.21                              [Remove]  │
│   express@4.18.2                              [Remove]  │
└─────────────────────────────────────────────────────────┘
```

**API additions needed:**

```typescript
// POST /api/workspace/sandbox/install
interface InstallPackageRequest {
  packageName: string;
  version?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip';
  global?: boolean;
}

// GET /api/workspace/sandbox/packages
interface ListPackagesResponse {
  packages: Array<{
    name: string;
    version: string;
    manager: string;
  }>;
}
```

---

## Implementation Priority

| Priority | Option                | Effort | Impact |
| -------- | --------------------- | ------ | ------ |
| 1        | Capabilities Badges   | Low    | Medium |
| 2        | Sandbox Info Panel    | Low    | Low    |
| 3        | Code Execution Panel  | Medium | High   |
| 4        | Terminal Tab          | High   | High   |
| 5        | Package Manager Panel | Medium | Medium |

**Recommended approach:**

1. Start with **Capabilities Badges** (quick win, improves discoverability)
2. Add **Code Execution Panel** (demonstrates sandbox value)
3. Consider **Terminal Tab** for power users later

---

## File Structure

```
packages/playground-ui/src/domains/workspace/
├── components/
│   ├── capabilities-badges.tsx      # Option 1
│   ├── sandbox-info-panel.tsx       # Option 2
│   ├── code-execution-panel.tsx     # Option 3
│   ├── terminal-panel.tsx           # Option 4
│   └── package-manager-panel.tsx    # Option 5
├── hooks/
│   ├── use-workspace.ts             # Existing
│   ├── use-sandbox-info.ts          # New
│   ├── use-execute-code.ts          # New
│   └── use-execute-command.ts       # New
└── index.ts
```

---

## Server Route Additions

```typescript
// packages/server/src/server/handlers/workspace/sandbox.ts

// GET /api/workspace/sandbox/info
export const WORKSPACE_SANDBOX_INFO_ROUTE = { ... };

// POST /api/workspace/sandbox/execute
export const WORKSPACE_SANDBOX_EXECUTE_ROUTE = { ... };

// POST /api/workspace/sandbox/command
export const WORKSPACE_SANDBOX_COMMAND_ROUTE = { ... };

// POST /api/workspace/sandbox/install
export const WORKSPACE_SANDBOX_INSTALL_ROUTE = { ... };
```

---

## Security Considerations

1. **Local sandbox**: Full access to host machine - development only
2. **Cloud sandbox**: Isolated execution - safe for production
3. **Rate limiting**: Prevent abuse of execution endpoints
4. **Timeout enforcement**: Kill long-running processes
5. **Output limits**: Truncate large stdout/stderr
6. **Command allowlist**: Consider restricting dangerous commands

---

## References

- PR #11567: Skills/Knowledge Infrastructure (filesystem/sandbox design)
- `packages/core/src/workspace/local-sandbox.ts`: LocalSandbox implementation
- `sandbox/computesdk/README.md`: ComputeSDK cloud sandbox
- `filesystem/agentfs/README.md`: AgentFS SQLite filesystem
