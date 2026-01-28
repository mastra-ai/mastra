# Unified Workspace Example

Demonstrates the unified Workspace API that combines filesystem, sandbox, skills, and search.

## Quick Start

```bash
pnpm install
pnpm mastra:dev
```

Open <http://localhost:4111> to use the Playground UI.

## Structure

```text
examples/unified-workspace/
├── content/                   # FAQ content (auto-indexed for BM25 search)
│   ├── faq-account.md
│   ├── faq-billing.md
│   └── faq-technical.md
├── skills/                    # Global skills
│   ├── api-design/
│   ├── code-review/
│   └── customer-support/
├── docs-skills/               # Agent-specific skills
│   └── brand-guidelines/
├── src/
│   ├── demo/
│   │   └── index.ts           # Consolidated demo script
│   └── mastra/
│       ├── agents/            # Agent definitions
│       ├── workspaces.ts      # Workspace configurations
│       └── index.ts
└── package.json
```

## Running Demos

```bash
# Run all demos
pnpm demo

# Run specific demo
pnpm demo:filesystem    # Read, write, list, delete, mkdir
pnpm demo:skills        # Discovery, search, CRUD, assets
pnpm demo:workspace     # Init, info, BM25 search/index
pnpm demo:agents        # Workspace inheritance, tools
pnpm demo:safety        # Readonly, requireReadBeforeWrite, approval
```

## Workspaces

| Workspace | Features |
|-----------|----------|
| globalWorkspace | Full access, global skills, BM25 search |
| docsAgentWorkspace | Global + agent-specific skills (brand-guidelines) |
| isolatedDocsWorkspace | Agent-specific skills only |
| readonlyWorkspace | `readOnly: true` - blocks all writes |
| safeWriteWorkspace | `requireReadBeforeWrite` on write/edit tools |
| supervisedSandboxWorkspace | `requireApproval` on execute_command |
| fsWriteApprovalWorkspace | `requireApproval` on write operations |
| fsAllApprovalWorkspace | `requireApproval` on all operations |
| testAgentWorkspace | Different basePath (/agent-files) |
| skillsOnlyWorkspace | No filesystem/sandbox, only skills |

## Agents

| Agent | Workspace | Purpose |
|-------|-----------|---------|
| developerAgent | globalWorkspace | Full access baseline |
| docsAgent | docsAgentWorkspace | Skill inheritance demo |
| supportAgent | isolatedDocsWorkspace | Agent-specific skills |
| researchAgent | readonlyWorkspace | Readonly safety |
| editorAgent | safeWriteWorkspace | Read-before-write |
| automationAgent | supervisedSandboxWorkspace | Sandbox approval |
| fsWriteApprovalAgent | fsWriteApprovalWorkspace | Write approval |
| fsAllApprovalAgent | fsAllApprovalWorkspace | All ops approval |
| testAgent | testAgentWorkspace | Different basePath |
| skillsOnlyAgent | skillsOnlyWorkspace | Minimal workspace |

## Key Concepts

### Workspace Configuration

```typescript
const workspace = new Workspace({
  id: 'my-workspace',
  filesystem: new LocalFilesystem({ basePath: '.', readOnly: false }),
  sandbox: new LocalSandbox({ workingDirectory: '.' }),
  skills: ['/skills'],
  bm25: true,
  autoIndexPaths: ['/content'],
  tools: {
    requireApproval: false,
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
  },
});
```

### Skill Inheritance

```typescript
// Global workspace - has global skills only
const global = new Workspace({ skills: ['/skills'] });

// Agent workspace - inherits global + adds own
const agent = new Workspace({ skills: ['/skills', '/agent-skills'] });
```

### Safety Features

- **readOnly**: Block all filesystem write operations
- **requireReadBeforeWrite**: Must read file before writing (per-tool)
- **requireApproval**: Show approval dialog before execution (per-tool or global)

## Testing

See `/WORKSPACE_TESTS.md` in the repo root for manual test cases.
