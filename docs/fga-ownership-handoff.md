# FGA Ownership Feature - Handoff Document

## Overview

The FGA Ownership feature automatically registers resources (agents, workflows, etc.) in WorkOS FGA when they're created, and assigns the creator an "owner" role so they have immediate access.

## Current Status

**Branch:** `feat/fga-authorship`  
**PRs:**

- PR #17079: Resource type discovery and `publicByDefault` config
- PR #17080: Ownership pattern with `registerResource()` method

## What Was Built

### 1. `registerResource()` Method

Located in `auth/workos/src/fga-provider.ts`

Automatically called when a stored agent is created. Does:

1. Creates the resource in WorkOS FGA
2. Looks for an owner role to assign to the creator
3. Logs warnings if configuration is missing

### 2. Ownership Configuration

```typescript
// In your FGA provider config
const fgaProvider = new MastraFGAWorkos({
  // ... other config
  ownership: {
    enabled: true,
    ownerRole: 'owner', // Role name to assign (default: 'owner')
    fallbackRoles: ['admin', 'editor'], // Try these if ownerRole not found
  },
})
```

### 3. Server Integration

Located in `packages/server/src/server/handlers/stored-agents.ts`

When a stored agent is created via `POST /api/stored/agents`:

```typescript
if (fgaProvider?.ownership?.enabled && user) {
  const result = await fgaProvider.registerResource({
    user,
    resourceType: 'agent',
    resourceId: id,
    name,
  })
  for (const warning of result.warnings) {
    mastra.getLogger().warn(`[FGA] ${warning}`)
  }
}
```

## The Warning You Saw

```
[FGA] No owner role found for 'agent'. Available roles: agent-viewer, agent-operator.
User will not have automatic access to their created resource.
```

**What this means:**

- The agent WAS created in WorkOS FGA as a resource ✅
- But no owner role was assigned to the creator ❌
- Because WorkOS doesn't have an `owner` role defined for the `agent` resource type
- The fallback roles (`admin`, `editor`) also weren't found
- Only `agent-viewer` and `agent-operator` exist

**Result:** The user can't access their own agent because they have no role on it.

## How to Fix

### Option 1: Create an `owner` role in WorkOS Dashboard

1. Go to WorkOS Dashboard → Authorization → Roles
2. Create a new role:
   - Name: `Owner`
   - Slug: `owner`
   - Resource Type: `agent`
   - Permissions: `agents:read`, `agents:write`, `agents:execute`, `agents:delete`

### Option 2: Use an existing role as the owner role

```typescript
ownership: {
  enabled: true,
  ownerRole: 'agent-operator',  // Use existing role
  fallbackRoles: ['agent-viewer'],
}
```

### Option 3: Add fallback roles that exist

```typescript
ownership: {
  enabled: true,
  ownerRole: 'owner',
  fallbackRoles: ['agent-operator', 'agent-viewer'],  // These exist!
}
```

## Testing the Feature

### Via curl

```bash
curl -X POST http://localhost:4111/api/stored/agents \
  -H "Content-Type: application/json" \
  -H "Cookie: wos-session=<your-session>" \
  -d '{"name": "Test Agent", "instructions": "You are a test agent"}'
```

### Via UI

1. Enable builder in `examples/agent/src/mastra/index.ts`:

```typescript
editor: new MastraEditor({
  builder: {
    enabled: true,
    features: { agent: { tools: true, agents: true, workflows: true, memory: true } },
  },
}),
```

2. Go to http://localhost:4111/agents
3. Click "Create agent"

### Watch the logs

Look for `[FGA]` messages in the dev server console:

- ✅ Success: `Registered resource 'agent:xyz' with owner role 'owner' assigned`
- ⚠️ Warning: `No owner role found for 'agent'. Available roles: ...`
- ⚠️ Warning: `Resource type 'agent' not found in WorkOS`

## Configuration Reference

### Full FGA Provider Config

```typescript
import { MastraFGAWorkos } from '@mastra/auth-workos'

const fgaProvider = new MastraFGAWorkos({
  apiKey: process.env.WORKOS_API_KEY!,
  clientId: process.env.WORKOS_CLIENT_ID!,
  organizationId: process.env.WORKOS_ORGANIZATION_ID!,

  // Resource type mapping (optional - types are now discovered dynamically)
  resourceMapping: {
    agent: { fgaResourceType: 'agent' },
    workflow: { fgaResourceType: 'workflow' },
    tool: { fgaResourceType: 'tool' },
    team: { fgaResourceType: 'team' },
  },

  // Permission mapping
  permissionMapping: {
    'agents:read': 'agents:read',
    'agents:write': 'agents:write',
    'agents:execute': 'agents:execute',
  },

  // Ownership auto-assignment
  ownership: {
    enabled: true,
    ownerRole: 'owner',
    fallbackRoles: ['admin', 'editor'],
  },

  // Public by default (unregistered resources accessible)
  publicByDefault: false, // Set to true to allow access to unregistered resources
})
```

## WorkOS Dashboard Setup (Required)

Before using FGA ownership, you must configure your WorkOS environment with resource types, permissions, and roles.

### Step 1: Create Resource Types

Go to **WorkOS Dashboard → Authorization → Resource Types** and create:

| Resource Type | Slug       | Description                                      |
| ------------- | ---------- | ------------------------------------------------ |
| Agent         | `agent`    | AI agents created in Mastra                      |
| Workflow      | `workflow` | Workflow definitions                             |
| Tool          | `tool`     | Tools available to agents                        |
| Team          | `team`     | For grouping resources hierarchically (optional) |

### Step 2: Create Permissions

Go to **WorkOS Dashboard → Authorization → Permissions** and create:

| Permission     | Slug             | Resource Type | Description        |
| -------------- | ---------------- | ------------- | ------------------ |
| Read Agents    | `agents:read`    | `agent`       | View agent details |
| Write Agents   | `agents:write`   | `agent`       | Edit agent config  |
| Execute Agents | `agents:execute` | `agent`       | Chat with agent    |
| Delete Agents  | `agents:delete`  | `agent`       | Delete agent       |

Repeat for other resource types (`workflows:read`, `workflows:execute`, etc.)

### Step 3: Create Roles

Go to **WorkOS Dashboard → Authorization → Roles** and create:

| Role     | Slug             | Resource Type | Permissions                                                      |
| -------- | ---------------- | ------------- | ---------------------------------------------------------------- |
| Owner    | `owner`          | `agent`       | `agents:read`, `agents:write`, `agents:execute`, `agents:delete` |
| Operator | `agent-operator` | `agent`       | `agents:read`, `agents:execute`                                  |
| Viewer   | `agent-viewer`   | `agent`       | `agents:read`                                                    |

**Important:** The `owner` role (or your configured `ownerRole`) is what gets auto-assigned to creators.

### Setup Script (Coming Soon)

We're exploring a `mastra fga setup` CLI command that would automate this setup:

```bash
# Future: Automatically create resource types, permissions, and roles
mastra fga setup --provider workos
```

**Current limitation:** WorkOS doesn't expose a public API for creating resource types or the FGA schema. These must be created manually in the Dashboard. However, permissions and roles CAN be created via API, so a partial automation script is possible.

### Potential Script for Permissions & Roles

```typescript
// scripts/setup-fga-roles.ts
import WorkOS from '@workos-inc/node'

const workos = new WorkOS(process.env.WORKOS_API_KEY)

// Create permissions (if they don't exist)
const permissions = [
  { slug: 'agents:read', name: 'Read Agents', resourceTypeSlug: 'agent' },
  { slug: 'agents:write', name: 'Write Agents', resourceTypeSlug: 'agent' },
  { slug: 'agents:execute', name: 'Execute Agents', resourceTypeSlug: 'agent' },
  { slug: 'agents:delete', name: 'Delete Agents', resourceTypeSlug: 'agent' },
]

for (const perm of permissions) {
  try {
    await workos.fga.createPermission(perm)
    console.log(`Created permission: ${perm.slug}`)
  } catch (e) {
    console.log(`Permission ${perm.slug} already exists`)
  }
}

// Create roles
const roles = [
  {
    slug: 'owner',
    name: 'Owner',
    resourceTypeSlug: 'agent',
    permissions: ['agents:read', 'agents:write', 'agents:execute', 'agents:delete'],
  },
  {
    slug: 'agent-operator',
    name: 'Agent Operator',
    resourceTypeSlug: 'agent',
    permissions: ['agents:read', 'agents:execute'],
  },
  {
    slug: 'agent-viewer',
    name: 'Agent Viewer',
    resourceTypeSlug: 'agent',
    permissions: ['agents:read'],
  },
]

for (const role of roles) {
  try {
    const created = await workos.fga.createOrganizationRole({
      slug: role.slug,
      name: role.name,
      resourceTypeSlug: role.resourceTypeSlug,
    })
    await workos.fga.setOrganizationRolePermissions({
      roleId: created.id,
      permissions: role.permissions,
    })
    console.log(`Created role: ${role.slug}`)
  } catch (e) {
    console.log(`Role ${role.slug} already exists`)
  }
}
```

Run with: `npx tsx scripts/setup-fga-roles.ts`

**Note:** You still need to manually create the `agent` resource type in WorkOS Dashboard first.

## Files Changed

| File                                                   | Description                                         |
| ------------------------------------------------------ | --------------------------------------------------- |
| `auth/workos/src/fga-provider.ts`                      | Added `registerResource()` method, ownership config |
| `auth/workos/src/types.ts`                             | Added `FGAOwnershipConfig` interface                |
| `packages/core/src/auth/ee/interfaces/fga.ts`          | Added `registerResource` to `IFGAManager`           |
| `packages/server/src/server/handlers/stored-agents.ts` | Integrated FGA registration on agent create         |

## Next Steps

### Immediate

1. **Merge PRs** - #17079 first, then #17080
2. **Create owner role in WorkOS** - Or configure to use existing roles
3. **Test end-to-end** - Create agent as User A, verify User B can't see it

### Short Term: Share UI

Add the ability for resource owners to share access with other users.

**What it looks like:**

1. Owner clicks "Share" button on agent header
2. Modal opens showing:
   - Current access list (who has what role)
   - "Add people" section with user search + role dropdown
3. Owner searches for `alice@acme.com`, assigns `agent-operator`
4. Alice can now see and chat with the agent

**Backend already exists:**

```typescript
// Assign a role to another user on a resource
await fgaProvider.assignRole({
  user: targetUser,
  resourceType: 'agent',
  resourceId: 'my-agent-id',
  roleSlug: 'agent-operator',
})

// List who has access to a resource
const assignments = await fgaProvider.listRoleAssignments({
  resourceType: 'agent',
  resourceId: 'my-agent-id',
})
```

**What's missing:**

- UI component: Share modal with user picker and role picker
- User search: Endpoint to search org members
- The API endpoints exist, just need the UI to wire them up

### Medium Term

1. **Extend to other resources** - Workflows, skills, threads need same treatment
2. **Hierarchical sharing** - Share a "team" folder, all agents inside inherit access
3. **Bulk operations** - Share multiple agents at once
4. **Add to documentation** - User-facing docs on setting up FGA ownership

### Long Term

1. **`mastra fga setup` CLI** - Automate WorkOS setup (blocked on WorkOS schema API)
2. **Visibility settings** - Public/Team/Private toggles per resource
3. **Transfer ownership** - Let owners transfer to another user
4. **Audit log** - Track who shared what with whom
