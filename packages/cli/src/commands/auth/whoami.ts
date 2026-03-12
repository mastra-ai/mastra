import { fetchOrgs } from './api.js';
import { loadCredentials, getCurrentOrgId } from './credentials.js';

export async function whoamiAction() {
  const creds = await loadCredentials();
  if (!creds) {
    console.info('\nNot logged in. Run: mastra auth login\n');
    process.exit(1);
  }

  const orgId = await getCurrentOrgId();

  let orgName: string | null = null;
  try {
    const orgs = await fetchOrgs(creds.token);
    const match = orgs.find(o => o.id === orgId);
    if (match) orgName = match.name;
  } catch {
    // Couldn't fetch org name — that's fine, we'll show the ID
  }

  console.info(`\n  ${creds.user.email}`);
  console.info(`   User ID: ${creds.user.id}`);
  if (orgName) {
    console.info(`   Org: ${orgName} (${orgId})`);
  } else {
    console.info(`   Org: ${orgId}`);
  }
  console.info('');
}
