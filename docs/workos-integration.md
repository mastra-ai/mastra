# WorkOS Integration for Auth v2

This document explains how Mastra integrates with WorkOS for authentication and authorization, including current limitations and workarounds.

## Overview

Mastra Auth v2 uses WorkOS for:

- **Authentication** — User login via AuthKit (SSO, OAuth, passwords, magic links)
- **RBAC** — Organization-level role-based access control
- **FGA** — Fine-grained authorization with hierarchical resource access

## WorkOS CLI Integration

The WorkOS CLI can automate parts of your auth setup. Install it:

```bash
# Install via npm
npm install -g @workos-inc/cli

# Or use npx
npx workos@latest
```

### What the CLI Can Do

#### 1. Seed Permissions and Roles

Create a `workos-seed.yml` file:

```yaml
# workos-seed.yml
permissions:
  - name: Read Agents
    slug: agents:read
  - name: Execute Agents
    slug: agents:execute
  - name: Write Agents
    slug: agents:write
  - name: Read Workflows
    slug: workflows:read
  - name: Execute Workflows
    slug: workflows:execute
  - name: Read Memory
    slug: memory:read
  - name: Write Memory
    slug: memory:write

roles:
  - name: Viewer
    slug: viewer
    description: Can view agents and workflows
    permissions:
      - agents:read
      - workflows:read
      - memory:read
  - name: Operator
    slug: operator
    description: Can view and execute agents and workflows
    permissions:
      - agents:read
      - agents:execute
      - workflows:read
      - workflows:execute
      - memory:read
  - name: Admin
    slug: admin
    description: Full access to all resources
    permissions:
      - agents:read
      - agents:execute
      - agents:write
      - workflows:read
      - workflows:execute
      - memory:read
      - memory:write

organizations:
  - name: Acme Corp
    domains:
      - acme.com

config:
  redirect_uris:
    - http://localhost:3000/auth/callback
    - http://localhost:4111/auth/callback
  cors_origins:
    - http://localhost:3000
    - http://localhost:4111
```

Apply it:

```bash
workos seed --file=workos-seed.yml
```

#### 2. Manage Permissions

```bash
# List permissions
workos permission list

# Create a permission
workos permission create --slug=agents:delete --name="Delete Agents"

# Delete a permission
workos permission delete agents:delete
```

#### 3. Manage Roles

```bash
# List roles
workos role list

# Create a role
workos role create --slug=team-viewer --name="Team Viewer"

# Set permissions on a role
workos role set-permissions team-viewer agents:read workflows:read

# Delete an org-scoped role
workos role delete team-viewer --org-id=org_123
```

## What Requires Manual Dashboard Setup

### Resource Types (FGA Schema)

**Resource types CANNOT be created via CLI or API.** You must create them manually in the WorkOS Dashboard:

1. Go to **Authorization → Resource Types**
2. Click **Model resource types**
3. Create each resource type:

| Resource Type | Parent                   | Description                      |
| ------------- | ------------------------ | -------------------------------- |
| `team`        | `organization`           | Groups agents/workflows together |
| `agent`       | `team` or `organization` | Individual AI agents             |
| `workflow`    | `team` or `organization` | Workflow definitions             |
| `tool`        | `organization`           | Tool definitions                 |
| `memory`      | `organization`           | Memory/thread access             |

4. For each resource type, define relations (e.g., `owner`, `editor`, `viewer`)

### Why This Matters

The FGA schema defines:

- What resource types exist (agent, workflow, team, etc.)
- How they relate hierarchically (team contains agents)
- What relations are possible (owner, editor, viewer)

Without this schema, Mastra can create permissions and roles, but can't:

- Register resources with proper types
- Use hierarchical permission inheritance
- Support the authorship pattern (owner → editor → viewer)

## Current Limitations

### 1. No Get Environment Multi-Role Config API

**Gap:** Cannot programmatically check if environment supports multi-role assignment.

**Impact:** UI can't dynamically show checkboxes (multi-role) vs radio buttons (single-role).

**Workaround:** Assume multi-role support or add config flag in Mastra.

### 2. No List Resource Types API

**Gap:** Cannot fetch what resource types are defined in WorkOS.

**Impact:**

- Can't validate that Mastra `resourceMapping` matches WorkOS Dashboard
- Can't warn users about misconfigurations
- Resource type dropdowns rely on hardcoded config

**Workaround:** Extract resource types from existing roles/permissions via `listEnvironmentRoles()` and `listPermissions()`. Falls back to `resourceMapping` config.

### 3. No Create/Update Resource Types API

**Gap:** Cannot programmatically create resource types.

**Impact:** Users must manually create resource types in Dashboard before using FGA features.

**Workaround:** Document required manual setup steps.

### 4. No Delete Environment Roles API

**Gap:** Can only delete organization-scoped roles, not environment-wide roles.

**Impact:** Environment roles must be deleted via Dashboard.

**Workaround:** Show "delete in Dashboard" message in UI.

### 5. No Get/Update Schema API

**Gap:** Cannot fetch or update the full FGA schema programmatically.

**Impact:** Cannot implement `mastra migrate --fga` to sync schema from code.

**Workaround:** None — schema must be managed manually in Dashboard.

## Recommended Setup Flow

### Initial Setup (One-Time)

1. **Create WorkOS account** and get API key + Client ID

2. **Define resource types in Dashboard:**
   - organization (built-in)
   - team (parent: organization)
   - agent (parent: team)
   - workflow (parent: team)
   - tool (parent: organization)
   - memory (parent: organization)

3. **Create seed file** with permissions and roles:

   ```bash
   workos seed --init  # Creates workos-seed.yml template
   # Edit the file with your permissions/roles
   workos seed --file=workos-seed.yml
   ```

4. **Configure Mastra** with matching `resourceMapping`:
   ```typescript
   const fga = new MastraFGAWorkos({
     workos,
     organizationId: 'org_xxx',
     resourceMapping: {
       organization: { fgaResourceType: 'organization' },
       team: { fgaResourceType: 'team' },
       agent: { fgaResourceType: 'agent' },
       workflow: { fgaResourceType: 'workflow' },
       tool: { fgaResourceType: 'tool' },
       memory: { fgaResourceType: 'memory' },
     },
   })
   ```

### Ongoing Maintenance

When adding new features that need new permissions:

1. **Add to seed file:**

   ```yaml
   permissions:
     - name: Execute MCP
       slug: mcp:execute
   ```

2. **Re-run seed:**

   ```bash
   workos seed --file=workos-seed.yml
   ```

   (Existing resources are skipped, new ones created)

3. **Update Mastra config** if adding new resource types (requires Dashboard first)

## Future: `mastra migrate` Integration

When/if WorkOS adds resource type APIs, `mastra migrate` could:

1. Generate FGA schema from Mastra config
2. Validate config matches WorkOS Dashboard
3. Sync permissions and roles automatically
4. Warn on drift between code and Dashboard

For now, use `workos seed` for permissions/roles and manual Dashboard for resource types.

## Validation Checklist

Before deploying, verify:

- [ ] Resource types created in WorkOS Dashboard
- [ ] `resourceMapping` in Mastra matches Dashboard types
- [ ] Permissions created via `workos seed` or Dashboard
- [ ] Roles created and assigned permissions
- [ ] At least one user has admin role for testing
- [ ] FGA check returns expected results for test cases

## Troubleshooting

### "Resource type 'X' does not exist"

The resource type isn't defined in WorkOS Dashboard. Create it manually.

### Permissions not appearing in role creation UI

Run `workos permission list` to verify permissions exist. If not, run `workos seed`.

### FGA check always returns false

1. Verify resource is registered: `GET /api/auth/fga/resources`
2. Verify role assignment exists on resource
3. Verify role includes the permission being checked
4. Check hierarchy — permission might be inherited from parent

### Multi-role assignment not working

Environment may be configured for single-role. Check WorkOS Dashboard → Authorization → Settings.
