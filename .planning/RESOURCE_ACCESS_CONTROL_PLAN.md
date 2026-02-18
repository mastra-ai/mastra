# Generalized Resource Access Control Implementation Plan

## Overview

Add RBAC permissions to control access to providers, models, tools, and MCP servers. Enforcement happens at two levels:
1. **Creation-time** - Prevent creating/updating agents with unauthorized resources
2. **Execution-time** - Prevent using unauthorized resources during agent execution

## Requirements

- **Resources**: Providers, models, tools, MCP servers
- **Actions**: Full CRUD - read, write, execute, delete
- **Architecture**: Single generalized `AgentAccessProcessor`
- **Tool behavior**: Filter unauthorized tools silently (don't error)
- **Default**: Allow all when RBAC not configured (non-breaking)
- **Integration**: Global enforcement with per-agent opt-out

## Permission Format

```
# Providers
providers:read                 # View available providers
providers:write                # Create agents with any provider
providers:write:openai         # Create agents with OpenAI
providers:execute              # Use any provider at runtime
providers:execute:anthropic    # Use Anthropic at runtime

# Models
models:read                    # View available models
models:write                   # Create agents with any model
models:write:gpt-4o            # Create agents with gpt-4o
models:execute                 # Use any model at runtime
models:execute:claude-3-opus   # Use Claude Opus at runtime

# Tools
tools:read                     # View available tools
tools:write                    # Assign any tool to agents
tools:write:web-search         # Assign web-search tool
tools:execute                  # Execute any tool
tools:execute:file-write       # Execute file-write tool

# MCP Servers
mcp:read                       # View MCP servers
mcp:write                      # Configure MCP servers
mcp:execute                    # Use MCP server tools
mcp:execute:filesystem         # Use filesystem MCP

# Wildcards
providers:*                    # Full provider access
*:execute                      # Execute anything
*                              # Admin - full access
```

---

## Implementation

### Part 1: Creation-Time Enforcement (Write Actions)

Add permission checks in stored-agents handlers before persisting.

**File**: `/packages/server/src/server/handlers/stored-agents.ts`

#### 1.1 Create validation helper

```typescript
// New helper function
async function validateResourceAccess(
  mastra: Mastra,
  requestContext: RequestContext,
  config: { model?: ModelConfig; tools?: string[]; mcp?: string[] }
): Promise<void> {
  const rbac = mastra.getRBAC?.();
  if (!rbac) return; // No RBAC = allow all

  const user = requestContext.get('user');
  if (!user) return;

  // Check provider write permission
  if (config.model?.provider) {
    const hasAccess = await rbac.hasAnyPermissions(user, [
      'providers:write',
      `providers:write:${config.model.provider}`,
      'providers:*',
      '*'
    ]);
    if (!hasAccess) {
      throw new HTTPException(403, {
        message: `No permission to use provider: ${config.model.provider}`
      });
    }
  }

  // Check model write permission
  if (config.model?.name) {
    const hasAccess = await rbac.hasAnyPermissions(user, [
      'models:write',
      `models:write:${config.model.name}`,
      'models:*',
      '*'
    ]);
    if (!hasAccess) {
      throw new HTTPException(403, {
        message: `No permission to use model: ${config.model.name}`
      });
    }
  }

  // Check tool write permissions
  for (const tool of config.tools ?? []) {
    const hasAccess = await rbac.hasAnyPermissions(user, [
      'tools:write',
      `tools:write:${tool}`,
      'tools:*',
      '*'
    ]);
    if (!hasAccess) {
      throw new HTTPException(403, {
        message: `No permission to assign tool: ${tool}`
      });
    }
  }
}
```

#### 1.2 Add checks to CREATE handler

**Location**: `CREATE_STORED_AGENT_ROUTE` handler (~line 155)

```typescript
// Before createAgent() call
await validateResourceAccess(mastra, requestContext, {
  model: body.model,
  tools: body.tools,
  mcp: body.mcp
});
```

#### 1.3 Add checks to UPDATE handler

**Location**: `UPDATE_STORED_AGENT_ROUTE` handler (~line 260)

```typescript
// Before updateAgent() call, only check changed fields
await validateResourceAccess(mastra, requestContext, {
  model: body.model,  // Only if model changed
  tools: body.tools,  // Only if tools changed
  mcp: body.mcp       // Only if mcp changed
});
```

---

### Part 2: Execution-Time Enforcement (AgentAccessProcessor)

Single generalized processor that handles all resource types.

**New file**: `/packages/core/src/processors/processors/agent-access.ts`

```typescript
export interface AgentAccessProcessorConfig {
  /** Get user permissions from request context */
  getPermissions?: (ctx: RequestContext) => string[] | undefined;

  /** Resource types to check */
  resources?: {
    providers?: boolean;  // default: true
    models?: boolean;     // default: true
    tools?: boolean;      // default: true
    mcp?: boolean;        // default: true
  };

  /** How to handle unauthorized tools */
  toolBehavior?: 'filter' | 'reject';  // default: 'filter'

  /** Enable/disable processor */
  enabled?: boolean;  // default: true
}

export class AgentAccessProcessor extends BaseProcessor<'agent-access'> {
  readonly id = 'agent-access' as const;
  readonly name = 'Agent Resource Access Control';

  processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult | void {
    const { model, tools, requestContext, abort } = args;
    const permissions = this.getPermissions(requestContext);

    if (!permissions) return; // No RBAC = allow all

    // Check provider/model execute permissions
    if (this.config.resources?.providers !== false) {
      if (!this.hasPermission(permissions, 'providers:execute', model.provider)) {
        abort(`Access denied: provider ${model.provider}`);
      }
    }

    if (this.config.resources?.models !== false) {
      if (!this.hasPermission(permissions, 'models:execute', model.modelId)) {
        abort(`Access denied: model ${model.modelId}`);
      }
    }

    // Filter unauthorized tools (silent removal)
    if (this.config.resources?.tools !== false && tools) {
      const filteredTools = this.filterTools(tools, permissions);
      return { tools: filteredTools };
    }
  }

  private filterTools(tools: Record<string, Tool>, permissions: string[]) {
    return Object.fromEntries(
      Object.entries(tools).filter(([name]) =>
        this.hasPermission(permissions, 'tools:execute', name)
      )
    );
  }

  private hasPermission(perms: string[], action: string, resource?: string) {
    return hasPermission(perms, action) ||
           hasPermission(perms, `${action}:${resource}`) ||
           hasPermission(perms, '*');
  }
}
```

---

### Part 3: Global Enforcement

**File**: `/packages/core/src/mastra/index.ts`

Add to `MastraOptions`:
```typescript
interface MastraOptions {
  // ... existing

  /** Agent resource access control configuration */
  accessControl?: AgentAccessProcessorConfig | boolean;
}
```

When RBAC is configured and `accessControl !== false`:
- Auto-inject `AgentAccessProcessor` into agent executions
- Pass config from Mastra options

---

### Part 4: Ensure Permissions in RequestContext

**File**: `/packages/server/src/server/auth/helpers.ts`

Verify/add middleware that populates:
```typescript
requestContext.set('permissions', await rbac.getPermissions(user));
requestContext.set('user', user);
```

---

## Critical Files

| File | Action |
|------|--------|
| `/packages/core/src/processors/processors/agent-access.ts` | **Create** - AgentAccessProcessor |
| `/packages/core/src/processors/processors/index.ts` | Modify - export AgentAccessProcessor |
| `/packages/core/src/processors/index.ts` | Modify - re-export |
| `/packages/server/src/server/handlers/stored-agents.ts` | Modify - add write checks |
| `/packages/core/src/mastra/index.ts` | Modify - add accessControl config |
| `/packages/server/src/server/auth/helpers.ts` | Verify - permissions in context |
| `/packages/core/src/auth/defaults/roles.ts` | Reference - hasPermission() |

---

## Usage Examples

### Role Configuration
```typescript
const rbac = new StaticRBACProvider({
  roleMapping: {
    // Enterprise - full access
    'enterprise': ['*'],

    // Standard - OpenAI only, no expensive models
    'standard': [
      'providers:*:openai',
      'models:write:gpt-4o-mini',
      'models:execute:gpt-4o-mini',
      'tools:*',
    ],

    // Free tier - limited
    'free-tier': [
      'providers:execute:openai',
      'models:execute:gpt-3.5-turbo',
      'tools:execute:web-search',
    ],
  }
});
```

### Per-Agent Opt-Out
```typescript
const agent = new Agent({
  name: 'internal-agent',
  model: 'anthropic/claude-3-opus',
  accessControl: false,  // Disable checks for this agent
});
```

---

## Behavior Summary

| Scenario | Provider Check | Model Check | Tool Check |
|----------|---------------|-------------|------------|
| Create agent | `providers:write:X` | `models:write:X` | `tools:write:X` |
| Update agent | `providers:write:X` | `models:write:X` | `tools:write:X` |
| Execute agent | `providers:execute:X` | `models:execute:X` | `tools:execute:X` |
| Read agent config | `providers:read` | `models:read` | `tools:read` |

---

## Testing

1. Unit tests for `AgentAccessProcessor` with various permission configs
2. Unit tests for `validateResourceAccess` helper
3. Integration tests - create agent with/without permissions
4. Integration tests - execute agent with/without permissions
5. Test tool filtering (unauthorized tools removed silently)
6. Test per-agent opt-out
7. Test default allow-all when RBAC not configured
