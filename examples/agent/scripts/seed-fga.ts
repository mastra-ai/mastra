/**
 * Seed script for WorkOS FGA resources.
 *
 * Sets up the full authorization model (permissions, roles, resources, assignments)
 * for the example agent app. Safe to re-run — all operations are idempotent.
 *
 * Prerequisites (dashboard only — cannot be done via API):
 *   - Resource type "agent" exists as a child of Organization
 *
 * Everything else (permissions, roles, resources, assignments) is created by this script.
 *
 * Usage:
 *   cd examples/agent && npx tsx scripts/seed-fga.ts
 */

import 'dotenv/config';
import { WorkOS } from '@workos-inc/node';

const apiKey = process.env.WORKOS_API_KEY!;
const orgId = process.env.MASTRA_ORGANIZATION_ID!;
const membershipId = process.env.WORKOS_MEMBERSHIP_ID;
const orgResourceId = process.env.WORKOS_ORG_RESOURCE_ID;

if (!apiKey || !orgId || !membershipId || !orgResourceId) {
  console.error(
    'Missing required env vars: WORKOS_API_KEY, MASTRA_ORGANIZATION_ID, WORKOS_MEMBERSHIP_ID, WORKOS_ORG_RESOURCE_ID',
  );
  process.exit(1);
}

const workos = new WorkOS(apiKey);

// Agents this user CAN see and execute
const operatorAgents = ['chef-agent', 'weather-agent', 'dynamic-agent'];

// Agents this user can see but NOT execute
const viewOnlyAgents = ['eval-agent'];

// Agents that exist but user has NO access to (won't appear in listing)
const hiddenAgents = ['agent-that-harasses-you', 'network-agent'];

const allAgents = [...operatorAgents, ...viewOnlyAgents, ...hiddenAgents];

function isConflict(err: any): boolean {
  const msg = err?.message || JSON.stringify(err);
  return err?.status === 409 || msg.includes('already exists') || msg.includes('duplicate') || msg.includes('conflict');
}

async function main() {
  console.log(`\nSeeding FGA for org ${orgId}...\n`);

  // Verify the "agent" resource type exists before doing anything
  try {
    await workos.authorization.listResources({ resourceTypeSlug: 'agent', organizationId: orgId, limit: 1 });
  } catch {
    console.error(
`Error: The "agent" resource type does not exist in your WorkOS environment.

Create it in your WorkOS dashboard before running this script:
  1. Go to Authorization > Resource Types
  2. Create a resource type with slug "agent" as a child of Organization

This is the one step that cannot be done via API.`
    );
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────
  // Step 1: Create permissions on the "agent" resource type
  // ──────────────────────────────────────────────────────────
  console.log('Step 1: Creating permissions...\n');
  const permissions = [
    { slug: 'agents:read', name: 'Read agents', resourceTypeSlug: 'agent' },
    { slug: 'agents:execute', name: 'Execute agents', resourceTypeSlug: 'agent' },
  ];
  for (const perm of permissions) {
    try {
      await workos.authorization.createPermission(perm);
      console.log(`  ✓ Created permission: ${perm.slug}`);
    } catch (err: any) {
      if (isConflict(err)) {
        console.log(`  · Already exists: ${perm.slug}`);
      } else {
        console.error(`  ✗ Failed: ${perm.slug}:`, err?.message);
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // Step 2: Create roles and bind permissions
  // ──────────────────────────────────────────────────────────
  console.log('\nStep 2: Creating roles and binding permissions...\n');
  const roles = [
    { slug: 'agent-viewer', name: 'Agent Viewer', permissions: ['agents:read'] },
    { slug: 'agent-operator', name: 'Agent Operator', permissions: ['agents:read', 'agents:execute'] },
  ];
  for (const role of roles) {
    try {
      await workos.authorization.createOrganizationRole(orgId, {
        slug: role.slug,
        name: role.name,
      });
      console.log(`  ✓ Created role: ${role.slug}`);
    } catch (err: any) {
      if (isConflict(err)) {
        console.log(`  · Already exists: ${role.slug}`);
      } else {
        console.error(`  ✗ Failed to create role ${role.slug}:`, err?.message);
      }
    }

    // Bind permissions to the role (idempotent — overwrites)
    try {
      await workos.authorization.setOrganizationRolePermissions(orgId, role.slug, {
        permissions: role.permissions,
      });
      console.log(`  ✓ Bound permissions to ${role.slug}: ${role.permissions.join(', ')}`);
    } catch (err: any) {
      console.error(`  ✗ Failed to bind permissions to ${role.slug}:`, err?.message);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Step 3: Create agent resources under the organization
  // ──────────────────────────────────────────────────────────
  console.log('\nStep 3: Creating agent resources...\n');
  for (const agentId of allAgents) {
    try {
      const resource = await workos.authorization.createResource({
        externalId: agentId,
        name: agentId,
        resourceTypeSlug: 'agent',
        organizationId: orgId,
        parentResourceId: orgResourceId,
      });
      console.log(`  ✓ Created resource: agent/${agentId} (${resource.id})`);
    } catch (err: any) {
      const msg = err?.message || JSON.stringify(err);
      if (isConflict(err)) {
        console.log(`  · Already exists: agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed to create: agent/${agentId}:`, msg);
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // Step 4: Assign roles to the membership on specific agents
  // ──────────────────────────────────────────────────────────
  console.log(`\nStep 4: Assigning roles to membership ${membershipId}...\n`);
  for (const agentId of operatorAgents) {
    try {
      await workos.authorization.assignRole({
        organizationMembershipId: membershipId,
        roleSlug: 'agent-operator',
        resourceExternalId: agentId,
        resourceTypeSlug: 'agent',
      });
      console.log(`  ✓ agent-operator on agent/${agentId}`);
    } catch (err: any) {
      if (isConflict(err)) {
        console.log(`  · Already assigned: agent-operator on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed on agent/${agentId}:`, err?.message);
      }
    }
  }

  for (const agentId of viewOnlyAgents) {
    try {
      await workos.authorization.assignRole({
        organizationMembershipId: membershipId,
        roleSlug: 'agent-viewer',
        resourceExternalId: agentId,
        resourceTypeSlug: 'agent',
      });
      console.log(`  ✓ agent-viewer on agent/${agentId}`);
    } catch (err: any) {
      if (isConflict(err)) {
        console.log(`  · Already assigned: agent-viewer on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed on agent/${agentId}:`, err?.message);
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // Step 5: Verify authorization checks
  // ──────────────────────────────────────────────────────────
  console.log(`\nStep 5: Verifying authorization checks...\n`);
  for (const agentId of allAgents) {
    try {
      const readResult = await workos.authorization.check({
        organizationMembershipId: membershipId,
        permissionSlug: 'agents:read',
        resourceExternalId: agentId,
        resourceTypeSlug: 'agent',
      });
      const execResult = await workos.authorization.check({
        organizationMembershipId: membershipId,
        permissionSlug: 'agents:execute',
        resourceExternalId: agentId,
        resourceTypeSlug: 'agent',
      });
      const read = readResult.authorized ? '✓' : '✗';
      const exec = execResult.authorized ? '✓' : '✗';
      console.log(`  agent/${agentId}: read=${read}  execute=${exec}`);
    } catch (err: any) {
      console.error(`  ✗ Check failed for agent/${agentId}:`, err?.message);
    }
  }

  console.log(`
Summary:
  ✓ Can see & execute: ${operatorAgents.join(', ')}
  ✓ Can see only:      ${viewOnlyAgents.join(', ')}
  ✗ Hidden:            ${hiddenAgents.join(', ')}
`);
}

main().catch(console.error);
