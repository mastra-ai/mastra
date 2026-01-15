# Unified Workspace Example

This example demonstrates the unified Workspace API that combines filesystem access, skills discovery, and content search into a single, cohesive interface.

## Overview

The **Workspace** class provides:

- **Filesystem**: Read/write files in a structured workspace
- **Skills**: Discover and access SKILL.md files for domain expertise
- **Search**: BM25 keyword search (and optional vector search) across indexed content
- **Inheritance**: Agents can inherit global skills AND add their own

## Structure

```
examples/unified-workspace/
├── skills/                    # Global skills (code-review, api-design, customer-support)
│   ├── api-design/
│   │   └── SKILL.md
│   ├── code-review/
│   │   └── SKILL.md
│   └── customer-support/
│       └── SKILL.md
├── docs-skills/               # Agent-specific skills (brand-guidelines)
│   └── brand-guidelines/
│       └── SKILL.md
├── .mastra-knowledge/         # FAQ content (auto-indexed for search)
│   └── knowledge/support/default/
│       ├── password-reset
│       ├── billing-cycle
│       └── ...
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   ├── skills-agent.ts     # Docs agent (inherits global + has brand-guidelines)
│   │   │   ├── developer-agent.ts  # Dev agent (uses global workspace)
│   │   │   └── knowledge-agent.ts  # Support agent (uses global workspace + search)
│   │   ├── workspaces.ts           # Workspace definitions
│   │   └── index.ts                # Mastra + exports
│   ├── demo.ts                     # Full demo
│   └── demo-workspace.ts           # Workspace API demo
└── package.json
```

## Running the Demos

```bash
# Install dependencies
pnpm install

# Run full demo (agents + workspace inheritance)
pnpm demo

# Run workspace API demo
pnpm demo:workspace

# Start Mastra dev server
pnpm mastra:dev
```

## Key Concepts

### Global vs Agent Workspace

```typescript
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';

// Global workspace - has global skills only
const globalWorkspace = new Workspace({
  id: 'global-workspace',
  filesystem: new LocalFilesystem({ basePath: '.' }),
  skillsPaths: ['/skills'], // code-review, api-design, customer-support
});

// Agent workspace - inherits global skills + adds agent-specific
const docsAgentWorkspace = new Workspace({
  id: 'docs-agent-workspace',
  filesystem: new LocalFilesystem({ basePath: '.' }),
  skillsPaths: ['/skills', '/docs-skills'], // All global + brand-guidelines
});
```

### Agent with Own Workspace

```typescript
import { Agent } from '@mastra/core/agent';
import { docsAgentWorkspace } from './workspaces';

const docsAgent = new Agent({
  id: 'docs-agent',
  // ...
  // Agent has its own workspace with inherited + agent-specific skills
  workspace: docsAgentWorkspace,
});
```

### Workspace Inheritance Patterns

| Pattern           | skillsPaths                   | Skills Available                          |
| ----------------- | ----------------------------- | ----------------------------------------- |
| Global only       | `['/skills']`                 | code-review, api-design, customer-support |
| Inherited + Agent | `['/skills', '/docs-skills']` | All global + brand-guidelines             |
| Agent only        | `['/docs-skills']`            | brand-guidelines only                     |

### Skills API

```typescript
// List all discovered skills
const skills = await workspace.skills?.list();

// Get a specific skill
const skill = await workspace.skills?.get('code-review');
console.log(skill.instructions);

// Search across skill content
const results = await workspace.skills?.search('best practices', { topK: 3 });
```

### Search API

```typescript
// Index content for search
await workspace.index('/docs/guide.md', 'This is a guide about...');

// Search indexed content
const results = await workspace.search('guide', { topK: 5 });

// Check search capabilities
workspace.canBM25; // true if BM25 enabled
workspace.canVector; // true if vector search configured
```

### Using with Mastra

```typescript
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  agents: {
    docsAgent, // Has own workspace (inherited + brand-guidelines)
    supportAgent, // Uses global workspace
    developerAgent, // Uses global workspace
  },
  workspace: globalWorkspace, // Global workspace
  storage,
});
```

## Workspace vs Old Primitives

| Old Approach                            | New Unified Workspace                |
| --------------------------------------- | ------------------------------------ |
| `Skills` class from `@mastra/skills`    | `workspace.skills` property          |
| `Knowledge` class from `@mastra/skills` | `workspace.search()` + auto-indexing |
| Agent `skills` property                 | Agent `workspace` property           |
| Separate `/api/skills/*` routes         | Unified `/api/workspace/*` routes    |
| Separate UI pages                       | Single `/workspace` page with tabs   |

## Benefits of Unified Workspace

1. **Single API**: One class for files, skills, and search
2. **Skill inheritance**: Agents can inherit global skills + add their own
3. **Automatic discovery**: Skills found from `skillsPaths`
4. **Auto-indexing**: Content indexed on `init()` from `autoIndexPaths`
5. **Simpler configuration**: No need for separate Skills/Knowledge instances
6. **Better UI**: Single Workspace page shows files and skills together
