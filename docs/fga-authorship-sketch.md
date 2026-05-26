# FGA Authorship & Auto-Registration Sketch

## Current State vs Proposed

### Current: Manual `resourceMapping`

```typescript
const fga = new MastraFGAWorkos({
  resourceMapping: {
    agent: { fgaResourceType: 'agent' },
    workflow: { fgaResourceType: 'workflow' },
    // Must manually keep in sync with WorkOS Dashboard
  },
  permissionMapping: {
    [MastraFGAPermissions.AGENTS_READ]: 'agents:read',
    // Must manually map every permission
  },
})
```

**Problems:**

- Hardcoded, must stay in sync with WorkOS Dashboard
- No validation that config matches reality
- No auto-registration of resources
- No authorship support

### Proposed: Dynamic Discovery + Auto-Registration

```typescript
const fga = new MastraFGAWorkos({
  // No resourceMapping needed — discovered from WorkOS

  authorship: {
    enabled: true,
    // Role to assign to creator (discovered from WorkOS roles)
    authorRole: 'author', // or 'owner', 'editor' — whatever exists
    // Optionally derive parent for hierarchy
    deriveParent: async (resource, user) => {
      // For Agent Builder: agent belongs to user's default team
      if (resource.type === 'agent') {
        return { type: 'team', id: user.defaultTeamId }
      }
      return null // No parent (flat/standalone)
    },
  },

  // Optional: warn or error on startup if WorkOS schema is missing types
  validation: {
    requireResourceTypes: ['agent', 'workflow'], // Warn if missing
    onMissingType: 'warn', // 'warn' | 'error' | 'ignore'
  },
})
```

---

## Core Interface Changes

### New `IFGAManager` Methods

```typescript
export interface IFGAManager<TUser = unknown> extends IFGAProvider<TUser> {
  // ... existing methods ...

  /**
   * Discover resource types from the FGA provider.
   * Returns observed state: types with roles or instances.
   */
  describeResourceTypes(organizationId: string): Promise<FGAResourceTypeInfo[]>

  /**
   * Register a Mastra resource in FGA and optionally assign author role.
   * This is the main entry point for authorship support.
   *
   * @returns The created FGA resource and role assignment (if authorship enabled)
   */
  registerResource(params: FGARegisterResourceParams): Promise<FGARegistrationResult>

  /**
   * Check if a resource type exists in the FGA schema.
   * Uses cached describeResourceTypes() result.
   */
  hasResourceType(organizationId: string, resourceTypeSlug: string): Promise<boolean>
}

export interface FGAResourceTypeInfo {
  slug: string
  relations: string[] // All role slugs for this type
  customRelations: string[] // Org-specific custom roles
  parentResourceTypeSlugs: string[] // Derived from instances
  hasInstances: boolean
}

export interface FGARegisterResourceParams {
  /** The user creating the resource */
  user: TUser
  /** Mastra resource type (agent, workflow, thread) */
  resourceType: string
  /** Resource ID */
  resourceId: string
  /** Human-readable name */
  name: string
  /** Optional parent resource for hierarchy */
  parentResource?: { type: string; id: string }
  /** Override: skip author role assignment */
  skipAuthorship?: boolean
}

export interface FGARegistrationResult {
  /** The created FGA resource (null if type doesn't exist in WorkOS) */
  resource: FGAResource | null
  /** The author role assignment (null if authorship disabled or no author role) */
  authorAssignment: FGARoleAssignment | null
  /** Warnings (e.g., "resource type not found") */
  warnings: string[]
}
```

---

## Agent Builder Integration

### Creating an Agent in Agent Builder

```typescript
// packages/agent-builder/src/create-agent.ts

async function createStoredAgent(mastra: Mastra, agentConfig: StoredAgentConfig, user: EEUser): Promise<StoredAgent> {
  // 1. Create the agent in storage
  const agent = await mastra.storage.createAgent(agentConfig)

  // 2. Register in FGA with authorship
  const fga = mastra.getServer()?.fga
  if (fga && 'registerResource' in fga) {
    const result = await fga.registerResource({
      user,
      resourceType: 'agent',
      resourceId: agent.id,
      name: agent.name,
      // Optional: derive parent from user's team
      parentResource: user.defaultTeamId ? { type: 'team', id: user.defaultTeamId } : undefined,
    })

    // Log warnings but don't fail
    for (const warning of result.warnings) {
      console.warn(`[FGA] ${warning}`)
    }

    // Agent is now:
    // - Registered as FGA resource (if 'agent' type exists in WorkOS)
    // - User has 'author' role assigned (if authorship enabled)
  }

  return agent
}
```

### What Happens Under the Hood

```typescript
// Inside MastraFGAWorkos.registerResource()

async registerResource(params: FGARegisterResourceParams): Promise<FGARegistrationResult> {
  const { user, resourceType, resourceId, name, parentResource, skipAuthorship } = params;
  const warnings: string[] = [];

  // 1. Check if resource type exists in WorkOS
  const types = await this.describeResourceTypes(user.organizationId);
  const typeInfo = types.find(t => t.slug === resourceType);

  if (!typeInfo) {
    warnings.push(
      `Resource type '${resourceType}' not found in WorkOS. ` +
      `Resource '${name}' will be publicly accessible (no FGA protection). ` +
      `To enable protection, create '${resourceType}' resource type in WorkOS Dashboard.`
    );
    return { resource: null, authorAssignment: null, warnings };
  }

  // 2. Resolve parent resource ID if hierarchical
  let parentResourceId: string | undefined;
  if (parentResource) {
    const parentTypeInfo = types.find(t => t.slug === parentResource.type);
    if (parentTypeInfo) {
      // Look up the parent's FGA resource ID
      const parentResources = await this.listResources({
        organizationId: user.organizationId,
        resourceTypeSlug: parentResource.type,
      });
      const parent = parentResources.find(r => r.externalId === parentResource.id);
      parentResourceId = parent?.id;

      if (!parentResourceId) {
        warnings.push(
          `Parent ${parentResource.type} '${parentResource.id}' not found in FGA. ` +
          `Resource will be created without parent hierarchy.`
        );
      }
    }
  }

  // 3. Create the FGA resource
  const resource = await this.createResource({
    resourceTypeSlug: resourceType,
    externalId: resourceId,
    name,
    organizationId: user.organizationId,
    parentResourceId,
  });

  // 4. Auto-assign author role (if enabled and role exists)
  let authorAssignment: FGARoleAssignment | null = null;

  if (!skipAuthorship && this.config.authorship?.enabled) {
    const authorRoleName = this.config.authorship.authorRole || 'author';
    const hasAuthorRole = typeInfo.relations.includes(authorRoleName);

    if (hasAuthorRole) {
      authorAssignment = await this.assignRole({
        organizationMembershipId: user.organizationMembershipId,
        resourceId: resource.id,
        resourceTypeSlug: resourceType,
        roleSlug: authorRoleName,
      });
    } else {
      // Try fallback roles
      const fallbackRoles = ['owner', 'admin', 'editor'];
      const fallbackRole = fallbackRoles.find(r => typeInfo.relations.includes(r));

      if (fallbackRole) {
        authorAssignment = await this.assignRole({
          organizationMembershipId: user.organizationMembershipId,
          resourceId: resource.id,
          resourceTypeSlug: resourceType,
          roleSlug: fallbackRole,
        });
        warnings.push(
          `Role '${authorRoleName}' not found for '${resourceType}'. ` +
          `Using '${fallbackRole}' instead.`
        );
      } else {
        warnings.push(
          `No author/owner role found for '${resourceType}'. ` +
          `User will not have automatic access to their created resource.`
        );
      }
    }
  }

  return { resource, authorAssignment, warnings };
}
```

---

## Startup Validation & Warnings

```typescript
// On Mastra server startup

async function validateFGAConfiguration(mastra: Mastra) {
  const fga = mastra.getServer()?.fga
  if (!fga || !('describeResourceTypes' in fga)) return

  // Get the org ID from somewhere (env var, first org, etc.)
  const organizationId = process.env.WORKOS_DEFAULT_ORG_ID
  if (!organizationId) return

  const types = await fga.describeResourceTypes(organizationId)
  const typesSlugs = new Set(types.map(t => t.slug))

  // Check for expected Mastra resource types
  const expectedTypes = ['agent', 'workflow', 'thread', 'tool']
  const missingTypes = expectedTypes.filter(t => !typesSlugs.has(t))

  if (missingTypes.length > 0) {
    console.warn(
      `[FGA] Missing resource types in WorkOS: ${missingTypes.join(', ')}\n` +
        `These Mastra resources will be publicly accessible.\n` +
        `To enable FGA protection, create these resource types in WorkOS Dashboard.`,
    )
  }

  // Check for authorship role on agent type (for Agent Builder)
  if (fga.config?.authorship?.enabled) {
    const authorRole = fga.config.authorship.authorRole || 'author'
    const agentType = types.find(t => t.slug === 'agent')

    if (agentType && !agentType.relations.includes(authorRole)) {
      console.warn(
        `[FGA] Authorship enabled but '${authorRole}' role not found on 'agent' type.\n` +
          `Available roles: ${agentType.relations.join(', ')}\n` +
          `Create '${authorRole}' role in WorkOS Dashboard or set authorship.authorRole to an existing role.`,
      )
    }
  }
}
```

---

## Comparison: Current vs Proposed

| Aspect                | Current (`resourceMapping`) | Proposed (Discovery + Authorship) |
| --------------------- | --------------------------- | --------------------------------- |
| Configuration         | Manual mapping required     | Zero-config by default            |
| Sync with WorkOS      | Must manually keep in sync  | Dynamically discovered            |
| Validation            | None (silent failures)      | Startup warnings on gaps          |
| Resource registration | Manual                      | Automatic on create               |
| Authorship            | Not supported               | Built-in auto-assignment          |
| Agent Builder         | Must wire up FGA manually   | Just works™                       |

---

## Agent Builder Specific Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT BUILDER FLOW                          │
└─────────────────────────────────────────────────────────────────┘

  User clicks "Create Agent" in Agent Builder
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  1. Create agent in Mastra storage  │
  │     (name, config, instructions)    │
  └─────────────────────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  2. Check: FGA configured?          │
  │     - fga = mastra.getServer()?.fga │
  └─────────────────────────────────────┘
                    │
            ┌───────┴───────┐
            │ No            │ Yes
            ▼               ▼
  ┌──────────────┐  ┌─────────────────────────────────────┐
  │ Agent is     │  │  3. describeResourceTypes(orgId)    │
  │ public       │  │     - Check if 'agent' type exists  │
  └──────────────┘  └─────────────────────────────────────┘
                                    │
                            ┌───────┴───────┐
                            │ Not found     │ Found
                            ▼               ▼
                  ┌──────────────┐  ┌─────────────────────────────────────┐
                  │ Log warning: │  │  4. createResource()                │
                  │ "No FGA      │  │     - type: 'agent'                 │
                  │ protection"  │  │     - externalId: agent.id          │
                  │ Agent public │  │     - parentResourceId: team (opt)  │
                  └──────────────┘  └─────────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌─────────────────────────────────────┐
                                    │  5. Check: authorship.enabled?      │
                                    │     - Find 'author' role on type    │
                                    └─────────────────────────────────────┘
                                                    │
                                            ┌───────┴───────┐
                                            │ No role       │ Role found
                                            ▼               ▼
                                  ┌──────────────┐  ┌─────────────────────────────────────┐
                                  │ Log warning: │  │  6. assignRole()                    │
                                  │ "No author   │  │     - user's membershipId           │
                                  │ role found"  │  │     - resourceId: agent FGA ID      │
                                  └──────────────┘  │     - roleSlug: 'author'            │
                                                    └─────────────────────────────────────┘
                                                                    │
                                                                    ▼
                                                    ┌─────────────────────────────────────┐
                                                    │  ✅ RESULT:                         │
                                                    │  - Agent exists in storage          │
                                                    │  - Agent registered in FGA          │
                                                    │  - User has 'author' role           │
                                                    │  - User can edit/delete their agent │
                                                    │  - Others need explicit access      │
                                                    └─────────────────────────────────────┘
```

---

## Is This Better?

**Yes, for these reasons:**

1. **Zero-config default** — No `resourceMapping` needed if WorkOS is set up correctly
2. **Actionable warnings** — Instead of silent failures, users get clear guidance
3. **Authorship built-in** — Agent Builder doesn't need custom FGA wiring
4. **Dynamic adaptation** — Mastra adapts to user's WorkOS schema, not the other way around
5. **Graceful degradation** — If WorkOS isn't set up, things work (public), with warnings

**Tradeoffs:**

1. **Requires WorkOS setup first** — Resource types with roles must exist before authorship works
2. **API calls on startup** — `describeResourceTypes()` adds latency (cache mitigates)

---

## Why "Observed State" Is Sufficient

A concern: `describeResourceTypes()` only returns types that have roles or instances (observed state, not schema). What about empty resource types?

| WorkOS State           | Discovered? | Warning                | Accurate?                  |
| ---------------------- | ----------- | ---------------------- | -------------------------- |
| Type doesn't exist     | ❌ No       | See below              | ✅ Yes                     |
| Type exists, no roles  | ❌ No       | See below              | ✅ Yes — need roles anyway |
| Type exists, has roles | ✅ Yes      | None, authorship works | ✅ Yes                     |

**Key insight:** An empty resource type (no roles) is useless for authorship anyway. You can't assign an `author` role if it doesn't exist.

The moment they create an `author` role on the `agent` type, `describeResourceTypes()` will discover it, and authorship will work automatically.

### Warning Messages

The warning must be precise about what's missing:

**Type not found (no roles defined):**

```
[FGA] Resource type 'agent' not found in WorkOS (or has no roles defined).
Agent 'Lead Qualifier' will be publicly accessible.

To enable FGA protection with authorship:
1. Create an 'agent' resource type in WorkOS Dashboard
2. Define roles on it (e.g., 'author', 'editor', 'viewer')
3. Restart your Mastra server
```

**Type found but author role missing:**

```
[FGA] Resource type 'agent' exists but no 'author' role found.
Available roles: viewer, operator

To enable authorship:
- Create an 'author' role on the 'agent' resource type in WorkOS Dashboard
- Or set authorship.authorRole to an existing role (e.g., 'operator')
```

**Type found, author role found, authorship works:**

```
[FGA] Registered agent 'Lead Qualifier' with author role assigned to user.
```

---

## Migration Path

1. **Keep `resourceMapping` as optional override** — For edge cases where mapping differs
2. **Add `describeResourceTypes()` using Alida's workaround** — Immediate unblock
3. **Add `registerResource()` with authorship support** — Core new capability
4. **Wire into Agent Builder create flow** — Enable authorship for stored agents
5. **Add startup validation** — Warn on missing types/roles
6. **Deprecate manual `resourceMapping`** — Once discovery is proven stable
