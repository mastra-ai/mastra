import { constants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { configuredOrganizations, applicationMode, billingDatabaseUrl } from '../src/mastra/environment.js';
import { BillingError } from '../src/billing/contracts.js';
import { initializeBilling } from '../src/billing/setup.js';
import { weatherConfiguration } from '../src/weather/configuration.js';
import { localPaths, privateDirectory, readLocalProfiles, writeLocalProfiles } from '../src/local/profiles.js';
import type { LocalProfiles, ProfileName } from '../src/local/profiles.js';

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
  );
  try {
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
      for (const name of ['owner', 'member', 'outsider'] as const) {
        if (!manifest.profiles[name]) {
          if (manifest.ready) throw new BillingError('state_unavailable');
          const provisioned = await organizations.provisionLocal({
            profileId: `weather-${name}`,
            displayName: `Weather ${name}`,
          });
          if (!provisioned.credential) throw new BillingError('state_unavailable');
          manifest.profiles[name] = {
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
      const owner = manifest.profiles.owner!;
      const member = manifest.profiles.member!;
      const ownerContext = await organizations.context({
        credential: owner.credential,
        workspaceId: owner.workspaceId,
      });
      if (!manifest.ready) {
        await organizations.convert(ownerContext, 'weather-setup-convert');
        let joined = false;
        try {
          joined =
            (await organizations.context({ credential: member.credential, workspaceId: owner.workspaceId })).role ===
            'member';
        } catch (error) {
          if (!(error instanceof BillingError) || error.code !== 'forbidden') throw error;
        }
        if (!joined) {
          if (!manifest.invitation) {
            const expiresAt = new Date(Date.now() + 86400000).toISOString();
            const invitation = await organizations.invite(ownerContext, 'weather-setup-invite', {
              recipientId: member.actorId,
              role: 'member',
              expiresAt,
            });
            if (!invitation.token) throw new BillingError('state_unavailable');
            manifest.invitation = { token: invitation.token, expiresAt };
            await writeLocalProfiles(root, manifest);
          }
          await organizations.acceptInvitation({
            credential: member.credential,
            key: 'weather-setup-accept',
            token: manifest.invitation.token,
          });
        }
      }
      if (ownerContext.role !== 'owner') throw new BillingError('forbidden');
      const shared = await organizations.context({ credential: owner.credential, workspaceId: owner.workspaceId });
      const joined = await organizations.context({ credential: member.credential, workspaceId: owner.workspaceId });
      if (shared.kind !== 'shared' || joined.role !== 'member') throw new BillingError('forbidden');
      const initialized = await initializeBilling({
        configuration: weatherConfiguration(owner.workspaceId),
        storage: { url: databaseUrl },
      });
      try {
        await initialized.provider.ensureAccount({ workspaceId: owner.workspaceId });
      } finally {
        initialized.close();
      }
      if (!manifest.ready) {
        manifest = { ...manifest, ready: true };
        delete manifest.invitation;
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
