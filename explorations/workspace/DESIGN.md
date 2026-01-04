# Agent Workspace Design

A **Workspace** is composed of two core abstractions:
1. **Filesystem (FS)** - Where the agent stores and retrieves files and state
2. **Executor** - Where the agent runs code and commands

Both are optional but at least one must be present for a workspace to be useful.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Workspace                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │      Filesystem         │  │       Executor          │   │
│  │                         │  │                         │   │
│  │  ┌─────────────────┐    │  │  ┌─────────────────┐    │   │
│  │  │   AgentFS       │    │  │  │   E2B           │    │   │
│  │  │   LocalFS       │    │  │  │   Modal         │    │   │
│  │  │   S3            │    │  │  │   Docker        │    │   │
│  │  │   Memory        │    │  │  │   Local         │    │   │
│  │  └─────────────────┘    │  │  └─────────────────┘    │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Provider Agnostic** - Interfaces don't assume implementation details
2. **Composable** - Mix any FS provider with any Executor provider
3. **Optional Components** - Workspace can have just FS, just Executor, or both
4. **Syncable** - When both exist, files can sync between them
5. **Auditable** - Operations can be logged/tracked

