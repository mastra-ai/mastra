/**
 * Seed script for WorkOS FGA resources.
 *
 * Creates authorization resources for agents and assigns roles
 * to a user's org membership so they can only see/execute specific agents.
 *
 * Prerequisites (already done via API):
 *   - Resource type "agent" exists (child of Organization)
 *   - Permissions: "agents:read", "agents:execute" on "agent" resource type
 *   - Roles: "agent-viewer" (read), "agent-operator" (read+execute) on "agent"
 *
 * Usage:
 *   cd examples/agent && npx tsx scripts/seed-fga.ts
 */

import 'dotenv/config';
import { WorkOS } from '@workos-inc/node';

const apiKey = process.env.WORKOS_API_KEY!;
const orgId = process.env.MASTRA_ORGANIZATION_ID!;
const membershipId = process.env.WORKOS_MEMBERSHIP_ID;

if (!apiKey || !orgId || !membershipId) {
  console.error('Missing required env vars: WORKOS_API_KEY, MASTRA_ORGANIZATION_ID, WORKOS_MEMBERSHIP_ID');
  process.exit(1);
}

const workos = new WorkOS(apiKey);

// The org's authorization resource ID (parent for agent resources)
const orgResourceId = 'authz_resource_01KFE9Q1KGK87RN8DW4X65BARM';

// Agents this user CAN see and execute
const operatorAgents = ['chef-agent', 'weather-agent', 'dynamic-agent'];

// Agents this user can see but NOT execute
const viewOnlyAgents = ['eval-agent'];

// Agents that exist but user has NO access to (won't appear in listing)
const hiddenAgents = ['agent-that-harasses-you', 'network-agent'];

const allAgents = [...operatorAgents, ...viewOnlyAgents, ...hiddenAgents];

async function main() {
  console.log(`\nSeeding FGA resources for org ${orgId}...\n`);

  // Step 1: Create agent resources under the organization
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
      if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('conflict')) {
        console.log(`  · Resource already exists: agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed to create: agent/${agentId}:`, msg);
      }
    }
  }

  // Step 2: Assign "agent-operator" role (read + execute) on specific agents
  console.log(`\nAssigning "agent-operator" role to membership ${membershipId}...\n`);
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
      const msg = err?.message || JSON.stringify(err);
      if (msg.includes('already assigned') || msg.includes('duplicate')) {
        console.log(`  · Role already assigned on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed to assign on agent/${agentId}:`, msg);
      }
    }
  }

  // Step 3: Assign "agent-viewer" role (read only) on view-only agents
  console.log(`\nAssigning "agent-viewer" role...\n`);
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
      const msg = err?.message || JSON.stringify(err);
      if (msg.includes('already assigned') || msg.includes('duplicate')) {
        console.log(`  · Role already assigned on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed to assign on agent/${agentId}:`, msg);
      }
    }
  }

  // Step 4: Verify with an authorization check
  console.log(`\nVerifying authorization checks...\n`);
  for (const agentId of [...operatorAgents, ...viewOnlyAgents, ...hiddenAgents]) {
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
