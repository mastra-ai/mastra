/**
 * Seed script for WorkOS FGA resources.
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
// Ryan's Organization where the test membership lives
const orgId = 'org_01KJAYPVYBVZA7YMZ7EKX6JXQ1';
const membershipId = 'om_01KJBA2EPHH6QTYN703HMMBWEJ';

if (!apiKey) {
  console.error('Missing required env var: WORKOS_API_KEY');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};
const BASE = 'https://api.workos.com';

// Ryan's Organization authorization resource ID
const orgResourceId = 'authz_resource_01KJAYPVZ6G1Q3MARCJFPG8D8T';

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

async function main() {
  console.log(`\nSeeding FGA resources for org ${orgId}...\n`);

  // Step 1: Create agent resources
  console.log('Step 1: Creating agent resources...\n');
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
      if (err.status === 409 || err.message.includes('already exists') || err.message.includes('Conflict')) {
        console.log(`  · Already exists: agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed: agent/${agentId}: ${err.message}`);
      }
    }
  }

  // Step 2: Assign "agent-operator" role on specific agents
  // Endpoint: POST /authorization/organization_memberships/{membershipId}/role_assignments
  // Body: { role_slug, resource_external_id, resource_type_slug }
  console.log(`\nStep 2: Assigning "agent-operator" role to membership ${membershipId}...\n`);
  for (const agentId of operatorAgents) {
    try {
      await apiCall('POST', `/authorization/organization_memberships/${membershipId}/role_assignments`, {
        role_slug: 'agent-operator',
        resource_external_id: agentId,
        resource_type_slug: 'agent',
      });
      console.log(`  ✓ agent-operator on agent/${agentId}`);
    } catch (err) {
      if (err.status === 409 || err.message.includes('already') || err.message.includes('Conflict')) {
        console.log(`  · Already assigned: agent-operator on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed on agent/${agentId}: ${err.message}`);
      }
    }
  }

  // Step 3: Assign "agent-viewer" role on view-only agents
  console.log(`\nStep 3: Assigning "agent-viewer" role...\n`);
  for (const agentId of viewOnlyAgents) {
    try {
      await apiCall('POST', `/authorization/organization_memberships/${membershipId}/role_assignments`, {
        role_slug: 'agent-viewer',
        resource_external_id: agentId,
        resource_type_slug: 'agent',
      });
      console.log(`  ✓ agent-viewer on agent/${agentId}`);
    } catch (err) {
      if (err.status === 409 || err.message.includes('already') || err.message.includes('Conflict')) {
        console.log(`  · Already assigned: agent-viewer on agent/${agentId}`);
      } else {
        console.error(`  ✗ Failed on agent/${agentId}: ${err.message}`);
      }
    }
  }

  // Step 4: Verify authorization checks
  // Endpoint: POST /authorization/organization_memberships/{membershipId}/check
  // Body: { permission_slug, resource_external_id, resource_type_slug }
  console.log(`\nStep 4: Verifying authorization checks...\n`);
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
