import { resolve } from 'node:path';
import { BillingError } from '../../contracts/core.js';
import { billingDatabaseUrl } from '../../configuration/environment.js';
import { readLocalProfiles } from './profiles.js';

/** Resolve prepared development identities into generic local credit seeds, without accessing SQL. */
export async function localDemoAccounts(environment: NodeJS.ProcessEnv, credits: number) {
  if ((environment.BILLING_PROVIDER ?? 'local') !== 'local' || environment.BILLING_IDENTITY_CONFIG_FILE !== undefined)
    return [];
  const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
  const profiles = await readLocalProfiles(root);
  if (!profiles?.ready || profiles.databaseUrl !== (await billingDatabaseUrl(environment)))
    throw new BillingError('state_unavailable');
  return Object.values(profiles.profiles).map(profile => ({
    workspaceId: profile!.workspaceId,
    meters: [{ key: 'credits', funding: 'prepaid' as const, balance: credits }],
  }));
}
