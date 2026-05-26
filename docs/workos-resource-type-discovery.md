# WorkOS Resource Type Discovery Workaround

From Alida @ WorkOS (May 22, 2026)

## Problem

We need to dynamically discover FGA resource types, relations, and hierarchy from WorkOS. There's no direct `GET /fga/resource-types` or `getSchema()` API.

## Workaround

Union two existing endpoints to derive resource types:

1. **`authorization.listOrganizationRoles(organizationId)`** — Returns all roles visible to the org (env-wide + custom). Each role has `slug`, `resourceTypeSlug`, and `type` field (`"EnvironmentRole"` or `"OrganizationRole"`). Grouping by `resourceTypeSlug` gives role slugs per type, which maps to relations.

2. **`authorization.listResources({ organizationId })`** — Returns resource instances for the org, each with `resourceTypeSlug` and `parentResourceId`. Resolving parent IDs back to their type slugs derives `parent_resource_type_slugs` per type.

## Implementation

```typescript
import { WorkOS } from '@workos-inc/node'

const workos = new WorkOS(process.env.WORKOS_API_KEY!)

async function getAllResources(organizationId: string) {
  const all = []
  let after: string | undefined
  do {
    const { data, listMetadata } = await workos.authorization.listResources({
      organizationId,
      limit: 100,
      after,
    })
    all.push(...data)
    after = listMetadata.after ?? undefined
  } while (after)
  return all
}

export async function describeResourceTypes(organizationId: string) {
  const [resources, { data: roles }] = await Promise.all([
    getAllResources(organizationId),
    workos.authorization.listOrganizationRoles(organizationId),
  ])

  const types = new Map<
    string,
    {
      slug: string
      relations: Set<string>
      custom_relations: Set<string>
      parent_resource_type_slugs: Set<string>
      has_instances: boolean
    }
  >()

  const ensure = (slug: string) => {
    if (!types.has(slug)) {
      types.set(slug, {
        slug,
        relations: new Set(),
        custom_relations: new Set(),
        parent_resource_type_slugs: new Set(),
        has_instances: false,
      })
    }
    return types.get(slug)!
  }

  // Derive resource types and relations from roles
  for (const role of roles) {
    const entry = ensure(role.resourceTypeSlug)
    entry.relations.add(role.slug)
    if (role.type === 'OrganizationRole') {
      entry.custom_relations.add(role.slug)
    }
  }

  // Derive parent types from resource instances
  const idToTypeSlug = new Map(resources.map(r => [r.id, r.resourceTypeSlug]))
  for (const r of resources) {
    const entry = ensure(r.resourceTypeSlug)
    entry.has_instances = true
    if (r.parentResourceId) {
      const parentSlug = idToTypeSlug.get(r.parentResourceId)
      if (parentSlug) entry.parent_resource_type_slugs.add(parentSlug)
    }
  }

  return [...types.values()].map(t => ({
    slug: t.slug,
    relations: [...t.relations],
    custom_relations: [...t.custom_relations],
    parent_resource_type_slugs: [...t.parent_resource_type_slugs],
    has_instances: t.has_instances,
  }))
}
```

## Example Response

```json
[
  {
    "slug": "organization",
    "relations": ["member", "engineering", "admin"],
    "custom_relations": [],
    "parent_resource_type_slugs": [],
    "has_instances": true
  },
  {
    "slug": "team",
    "relations": ["viewer", "editor", "admin"],
    "custom_relations": ["editor"],
    "parent_resource_type_slugs": ["organization"],
    "has_instances": true
  },
  {
    "slug": "agent",
    "relations": ["viewer", "operator"],
    "custom_relations": [],
    "parent_resource_type_slugs": ["team"],
    "has_instances": true
  }
]
```

## Caveats

1. **Types with no roles AND no instances won't appear** — Both endpoints read observed state, not the schema itself.

2. **Parent type derivation depends on instances** — A valid parent type that hasn't been used yet won't show in `parent_resource_type_slugs`.

3. **Relations are role slugs, not OpenFGA-style tuples** — This is the closest analogue WorkOS exposes today.

## Integration with Mastra

This workaround enables:

- ✅ Dynamically populating resource type dropdowns in FGA UI
- ✅ Validating `resourceMapping` config against actual WorkOS state
- ✅ Understanding hierarchy for proper FGA enforcement
- ⚠️ Partial — won't show unused resource types or parent relationships

## Next Steps

Consider adding `describeResourceTypes()` method to `IFGAManager` interface and implementing in WorkOS provider. This would allow:

```typescript
// In Mastra config validation
const types = await fga.describeResourceTypes(organizationId)
for (const [key, mapping] of Object.entries(resourceMapping)) {
  const type = types.find(t => t.slug === mapping.fgaResourceType)
  if (!type) {
    console.warn(`Resource type '${mapping.fgaResourceType}' not found in WorkOS`)
  }
}
```
