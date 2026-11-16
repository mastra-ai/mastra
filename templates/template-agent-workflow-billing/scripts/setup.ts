import { privateDirectory } from '../src/billing/storage/private-files.js';
import { constants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import {
  configuredOrganizations,
  applicationMode,
  billingDatabaseUrl,
  readBillingConfiguration,
} from '../src/billing/configuration/environment.js';
import { BillingError } from '../src/billing/contracts/core.js';
import { initializeBilling } from '../src/billing/configuration/providers.js';
import { billingConfigurationSchema } from '../src/billing/configuration/policy.js';
import { localPaths, readLocalProfiles, writeLocalProfiles } from '../src/billing/providers/local/profiles.js';
import type { LocalProfiles } from '../src/billing/providers/local/profiles.js';

export async function setupLocal(environment: NodeJS.ProcessEnv) {
  const root = environment.MASTRA_PROJECT_ROOT!;
  if (
    applicationMode(environment) !== 'local' ||
    environment.BILLING_PROVIDER !== 'local' ||
    environment.BILLING_IDENTITY_CONFIG_FILE !== undefined
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
      const savedManifest = await readLocalProfiles(root, false);
      let manifest: LocalProfiles = savedManifest ?? {
        version: 1,
        databaseUrl,
        ready: false,
        profiles: {},
      };
      if (manifest.databaseUrl !== databaseUrl) throw new BillingError('conflict');
      const people = { owner: 'John', member: 'Emma', outsider: 'Alex' } as const;
      const profileNames = ['owner', 'member', 'outsider'] as const;
      if (!savedManifest) {
        for (const name of profileNames)
          if (await organizations.hasLocalProfile(`demo-${name}`)) throw new BillingError('state_unavailable');
        // Persist recovery intent before the first principal can be committed.
        await writeLocalProfiles(root, manifest);
      }
      for (const name of profileNames) {
        if (!manifest.profiles[name]) {
          if (manifest.ready) throw new BillingError('state_unavailable');
          // Only an unfinished manifest may recover a credential lost after principal commit.
          const provisioned = await organizations.provisionLocal(
            {
              profileId: `demo-${name}`,
              displayName: people[name],
            },
            { recoverCredential: true },
          );
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
        configuration:
          readBillingConfiguration(environment) ??
          billingConfigurationSchema.parse({
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
