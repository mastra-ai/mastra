import * as p from '@clack/prompts';
import { fetchOrgs } from './api.js';
import { getToken, getCurrentOrgId, setCurrentOrgId } from './credentials.js';

/**
 * Resolve the current org, auto-selecting if only one exists.
 * If multiple orgs exist and none is currently set, prompts the user.
 */
export async function resolveCurrentOrg(token: string): Promise<{ orgId: string; orgName: string }> {
  const currentOrgId = await getCurrentOrgId();
  const orgs = await fetchOrgs(token);

  if (currentOrgId) {
    const match = orgs.find(o => o.id === currentOrgId);
    if (match) return { orgId: match.id, orgName: match.name };
  }

  if (orgs.length === 1) {
    return { orgId: orgs[0]!.id, orgName: orgs[0]!.name };
  }

  if (orgs.length === 0) {
    throw new Error('No organizations found.');
  }

  const selected = await p.select({
    message: 'Select an organization',
    options: orgs.map(o => ({ value: o.id, label: `${o.name} (${o.id})` })),
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  const org = orgs.find(o => o.id === selected)!;
  return { orgId: org.id, orgName: org.name };
}

export async function listOrgsAction() {
  const token = await getToken();
  const currentOrgId = await getCurrentOrgId();
  const orgs = await fetchOrgs(token);

  if (orgs.length === 0) {
    console.info('\nNo organizations found.\n');
    return;
  }

  console.info('\nOrganizations:\n');
  for (const org of orgs) {
    const marker = org.id === currentOrgId ? ' (current)' : '';
    const role = org.role ? ` [${org.role}]` : '';
    console.info(`  ${org.name}${role}${marker}`);
    console.info(`    ID: ${org.id}`);
  }
  console.info('');
}

export async function switchOrgAction() {
  if (process.env.MASTRA_API_TOKEN) {
    console.error('\nCannot switch org when using MASTRA_API_TOKEN. Unset it and log in with: mastra auth login\n');
    process.exit(1);
  }
  if (process.env.MASTRA_ORG_ID) {
    console.error('\nCannot switch org when MASTRA_ORG_ID is set. Unset it to use persistent org selection.\n');
    process.exit(1);
  }

  const token = await getToken();
  const currentOrgId = await getCurrentOrgId();
  const orgs = await fetchOrgs(token);

  if (orgs.length === 0) {
    console.info('\nNo organizations found.\n');
    return;
  }

  if (orgs.length === 1) {
    console.info(`\nYou only have one organization: ${orgs[0]!.name}\n`);
    return;
  }

  const selected = await p.select({
    message: 'Switch to organization',
    options: orgs.map(o => ({
      value: o.id,
      label: `${o.name}${o.id === currentOrgId ? ' (current)' : ''}`,
    })),
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  await setCurrentOrgId(selected as string);
  const org = orgs.find(o => o.id === selected)!;
  console.info(`\nSwitched to ${org.name} (${org.id})\n`);
}
