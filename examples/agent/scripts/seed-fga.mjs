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
 * Run from repo root: node examples/agent/scripts/seed-fga.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from examples/agent
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq);
  const val = trimmed.slice(eq + 1);
  if (!process.env[key]) process.env[key] = val;
}

const apiKey = process.env.WORKOS_API_KEY;
const orgId = process.env.MASTRA_ORGANIZATION_ID;
const membershipId = process.env.WORKOS_MEMBERSHIP_ID;
const orgResourceId = process.env.WORKOS_ORG_RESOURCE_ID;

if (!apiKey || !orgId || !membershipId || !orgResourceId) {
  console.error(
    'Missing required env vars: WORKOS_API_KEY, MASTRA_ORGANIZATION_ID, WORKOS_MEMBERSHIP_ID, WORKOS_ORG_RESOURCE_ID',
  );
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};
const BASE = 'https://api.workos.com';

// Agents this user CAN see and execute
const operatorAgents = ['chef-agent', 'weather-agent', 'dynamic-agent'];

// Agents this user can see but NOT execute
const viewOnlyAgents = ['eval-agent'];

// Agents that exist but user has NO access to
const hiddenAgents = ['agent-that-harasses-you', 'network-agent'];

const allAgents = [...operatorAgents, ...viewOnlyAgents, ...hiddenAgents];

async function apiCall(method, path, body) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(JSON.stringify(json));
    err.status = res.status;
    throw err;
  }
  return json;
}

function isConflict(err) {
  return err.status === 409 || err.message.includes('already exists') || err.message.includes('Conflict') || err.message.includes('duplicate');
}

async function main() {
  console.log(`\nSeeding FGA for org ${orgId}...\n`);

  // Verify the "agent" resource type exists before doing anything
  try {
    await apiCall('GET', `/authorization/resources?resource_type_slug=agent&organization_id=${orgId}&limit=1`);
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

  // ───���─────────────────────────────���────────────────────────
  // Step 1: Create permissions on the "agent" resource type
  // ──────���───────────────────────────────────────────────────
  console.log('Step 1: Creating permissions...\n');
  const permissions = [
    { slug: 'agents:read', name: 'Read agents', resource_type_slug: 'agent' },
    { slug: 'agents:execute', name: 'Execute agents', resource_type_slug: 'agent' },
  ];
  for (const perm of permissions) {
    try {
      await apiCall('POST', '/authorization/permissions', perm);
      console.log(`  ✓ Created permission: ${perm.slug}`);
    } catch (err) {
      if (isConflict(err)) {
        console.log(`  · Already exists: ${perm.slug}`);
      } else {
        console.error(`  ✗ Failed: ${perm.slug}: ${err.message}`);
      }
    }
  }

  // ───��────────────────────��─────────────────────────────────
  // Step 2: Create roles and bind permissions
  // ─────────��──────────────────────────────���─────────────────
  console.log('\nStep 2: Creating roles and binding permissions...\n');
  const roles = [
    { slug: 'agent-viewer', name: 'Agent Viewer', permissions: ['agents:read'] },
    { slug: 'agent-operator', name: 'Agent Operator', permissions: ['agents:read', 'agents:execute'] },
  ];
  for (const role of roles) {
    try {
      await apiCall('POST', `/authorization/organization_roles/${orgId}`, {
        slug: role.slug,
        name: role.name,
      });
      console.log(`  ✓ Created role: ${role.slug}`);
    } catch (err) {
      if (isConflict(err)) {
        console.log(`  · Already exists: ${role.slug}`);
      } else {
        console.error(`  ✗ Failed to create role ${role.slug}: ${err.message}`);
      }
    }

    // Bind permissions to the role (idempotent — overwrites)
    try {
      await apiCall('PUT', `/authorization/organization_roles/${orgId}/${role.slug}/permissions`, {
        permissions: role.permissions,
      });
      console.log(`  ✓ Bound permissions to ${role.slug}: ${role.permissions.join(', ')}`);
    } catch (err) {
      console.error(`  ✗ Failed to bind permissions to ${role.slug}: ${err.message}`);
    }
  }

  // ────��─────────────────────────────────────────────────────
  // Step 3: Create agent resources under the organization
  // ──────────────────────────────────────────────────────────
  console.log('\nStep 3: Creating agent resources...\n');
  for (const agentId of allAgents) {
    try {
      const resource = await apiCall('POST', '/authorization/resources', {
        external_id: agentId,
        name: agentId,
        resource_type_slug: 'agent',
        organization_id: orgId,
        parent_resource_id: orgResourceId,
      });
      console.log(`  ✓ Created resource: agent/${agentId} (${resource.id})`);
    } catch (err) {
      if (isConflict(err)) {
        console.log(`  · Already exists: agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed: agent/${agentId}: ${err.message}`);
      }
    }
  }

  // ────────���──────────────────��──────────────────────────────
  // Step 4: Assign roles to the membership on specific agents
  // ─────���─────────────���────────────────────────────���─────────
  console.log(`\nStep 4: Assigning roles to membership ${membershipId}...\n`);
  for (const agentId of operatorAgents) {
    try {
      await apiCall('POST', `/authorization/organization_memberships/${membershipId}/role_assignments`, {
        role_slug: 'agent-operator',
        resource_external_id: agentId,
        resource_type_slug: 'agent',
      });
      console.log(`  ✓ agent-operator on agent/${agentId}`);
    } catch (err) {
      if (isConflict(err)) {
        console.log(`  · Already assigned: agent-operator on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed on agent/${agentId}: ${err.message}`);
      }
    }
  }

  for (const agentId of viewOnlyAgents) {
    try {
      await apiCall('POST', `/authorization/organization_memberships/${membershipId}/role_assignments`, {
        role_slug: 'agent-viewer',
        resource_external_id: agentId,
        resource_type_slug: 'agent',
      });
      console.log(`  ✓ agent-viewer on agent/${agentId}`);
    } catch (err) {
      if (isConflict(err)) {
        console.log(`  · Already assigned: agent-viewer on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed on agent/${agentId}: ${err.message}`);
      }
    }
  }

  // ────────────��─────────────────────────────────────────────
  // Step 5: Verify authorization checks
  // ────────��─────────────────────────────���───────────────────
  console.log(`\nStep 5: Verifying authorization checks...\n`);
  for (const agentId of allAgents) {
    try {
      const readRes = await apiCall('POST', `/authorization/organization_memberships/${membershipId}/check`, {
        permission_slug: 'agents:read',
        resource_external_id: agentId,
        resource_type_slug: 'agent',
      });
      const execRes = await apiCall('POST', `/authorization/organization_memberships/${membershipId}/check`, {
        permission_slug: 'agents:execute',
        resource_external_id: agentId,
        resource_type_slug: 'agent',
      });
      const read = readRes.authorized ? '✓' : '✗';
      const exec = execRes.authorized ? '✓' : '✗';
      console.log(`  agent/${agentId}: read=${read}  execute=${exec}`);
    } catch (err) {
      console.error(`  ✗ Check failed for agent/${agentId}: ${err.message}`);
    }
  }

  console.log(`
Summary:
  ✓ Can see & execute: ${operatorAgents.join(', ')}
  ✓ Can see only:      ${viewOnlyAgents.join(', ')}
  ✗ Hidden:            ${hiddenAgents.join(', ')}
`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
