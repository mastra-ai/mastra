import { privateDirectory } from '../src/billing/storage/private-files.js';
import { constants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { configuredOrganizations, applicationMode, billingDatabaseUrl } from '../src/billing/environment.js';
import { BillingError } from '../src/billing/contracts.js';
import { initializeBilling } from '../src/billing/setup.js';
import { billingConfigurationSchema } from '../src/billing/policy-configuration.js';
import { localPaths, readLocalProfiles, writeLocalProfiles } from '../src/billing/local-profiles.js';
import type { LocalProfiles } from '../src/billing/local-profiles.js';

export async function setupLocal(environment: NodeJS.ProcessEnv) {
  const root = environment.MASTRA_PROJECT_ROOT!;
  if (
    applicationMode(environment) !== 'local' ||
    environment.BILLING_PROVIDER !== 'local' ||
    environment.BILLING_JWT_CONFIGURATION ||
    environment.BILLING_CONFIGURATION
  )
    throw new BillingError('invalid_configuration');
  const paths = localPaths(root);
  await privateDirectory(paths.directory);
  const lock = await open(
    paths.lock,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  ).catch(error => {
    if (error?.code !== 'EEXIST') throw error;
    const failure = new Error(
      `Setup lock exists at ${paths.lock}. Confirm that no setup process is running before removing only this lock file, then rerun npm run setup. Existing profiles and balances will be preserved.`,
    );
    failure.name = 'SetupLockError';
    throw failure;
  });
  try {
    await lock.writeFile(`${process.pid}\n`);
    const databaseUrl = await billingDatabaseUrl(environment);
    const organizations = await configuredOrganizations(environment);
    try {
      let manifest: LocalProfiles = (await readLocalProfiles(root, false)) ?? {
        version: 1,
        databaseUrl,
        ready: false,
        profiles: {},
      };
      if (manifest.databaseUrl !== databaseUrl) throw new BillingError('conflict');
      const people = { owner: 'John', member: 'Emma', outsider: 'Alex' } as const;
      for (const name of ['owner', 'member', 'outsider'] as const) {
        if (!manifest.profiles[name]) {
          if (manifest.ready) throw new BillingError('state_unavailable');
          const provisioned = await organizations.provisionLocal({
            profileId: `demo-${name}`,
            displayName: people[name],
          });
          if (!provisioned.credential) throw new BillingError('state_unavailable');
          manifest.profiles[name] = {
            name: people[name],
            organizationName: `${people[name]}'s Org`,
            actorId: provisioned.identity.id,
            workspaceId: provisioned.workspaceId,
            credential: provisioned.credential,
          };
          await writeLocalProfiles(root, manifest);
        }
        const profile = manifest.profiles[name]!;
        const context = await organizations.context({
          credential: profile.credential,
          workspaceId: profile.workspaceId,
        });
        if (context.actorId !== profile.actorId) throw new BillingError('conflict');
      }
      const initialized = await initializeBilling({
        configuration: billingConfigurationSchema.parse({
          provider: 'local',
          resourcePolicies: [],
          billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
          localAccounts: Object.values(manifest.profiles).map(profile => ({
            workspaceId: profile!.workspaceId,
            meters: [{ key: 'credits', funding: 'prepaid', balance: 30 }],
          })),
        }),
        storage: { url: databaseUrl },
      });
      try {
        for (const profile of Object.values(manifest.profiles))
          await initialized.provider.ensureAccount({ workspaceId: profile!.workspaceId });
      } finally {
        initialized.close();
      }
      if (!manifest.ready) {
        manifest = { ...manifest, ready: true };
        await writeLocalProfiles(root, manifest);
      }
      return manifest;
    } finally {
      organizations.close();
    }
  } finally {
    await lock.close();
    await unlink(paths.lock);
  }
}
