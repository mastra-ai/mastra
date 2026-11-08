import { BillingRecovery } from '../billing/recovery.js';
import { RecoveryStorage } from '../billing/storage/recovery.js';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { ServerConfig } from '@mastra/core/server';
import { BillingError } from '../billing/contracts.js';
import { JwtIdentityAdapter } from '../billing/identity.js';
import type { JwtIdentityOptions } from '../billing/identity.js';
import { OrganizationService } from '../billing/organizations.js';
import { OrganizationStorage } from '../billing/storage/organizations.js';
import { initializeBilling } from '../billing/setup.js';
import { CommercialService } from '../billing/commercial.js';
import { CommercialStorage } from '../billing/storage/commercial.js';
import { billingContactSchema } from '../billing/providers/polar-contract.js';
import { billingOnlyServer } from '../server/security.js';

export async function configuredOrganizations(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<OrganizationService> {
  let url = environment.BILLING_DATABASE_URL;
  if (!url) {
    // Mastra dev changes cwd to its public directory. Keep private SQL at the project root.
    const directory = resolve(environment.MASTRA_PROJECT_ROOT ?? '.', 'data');
    await mkdir(directory, { recursive: true });
    url = pathToFileURL(resolve(directory, 'billing.db')).href;
  }
  const storage = await OrganizationStorage.open({ url });
  try {
    let identity;
    if (environment.BILLING_JWT_CONFIGURATION) {
      let options: JwtIdentityOptions;
      try {
        options = JSON.parse(environment.BILLING_JWT_CONFIGURATION) as JwtIdentityOptions;
      } catch {
        throw new BillingError('invalid_configuration');
      }
      identity = new JwtIdentityAdapter(storage, options);
    }
    return new OrganizationService(storage, {
      identity,
      // The Mastra dev child uses NODE_ENV=production internally, while MASTRA_DEV identifies its lifecycle.
      mode: environment.NODE_ENV === 'production' && environment.MASTRA_DEV !== 'true' ? 'production' : 'local',
      provider: z.enum(['local', 'polar']).parse(environment.BILLING_PROVIDER ?? 'local'),
    });
  } catch (error) {
    storage.close();
    throw error;
  }
}

export async function billingServerConfiguration(): Promise<ServerConfig> {
  const organizations = await configuredOrganizations();
  let commercial: CommercialService | undefined;
  let recovery: BillingRecovery | undefined;
  if (process.env.BILLING_PROVIDER === 'polar') {
    let initialized: Awaited<ReturnType<typeof initializeBilling>> | undefined;
    let storage: CommercialStorage | undefined;
    let records: RecoveryStorage | undefined;
    const close = async () => {
      await recovery?.stop();
      records?.close();
      storage?.close();
      initialized?.close();
      organizations.close();
    };
    try {
      const configuration: unknown = JSON.parse(process.env.BILLING_CONFIGURATION ?? 'null');
      const contacts = z
        .record(z.string(), billingContactSchema)
        .parse(JSON.parse(process.env.BILLING_CONTACTS ?? 'null'));
      const databaseUrl =
        process.env.BILLING_DATABASE_URL ??
        pathToFileURL(resolve(process.env.MASTRA_PROJECT_ROOT ?? '.', 'data/billing.db')).href;
      initialized = await initializeBilling({
        configuration,
        storage: { url: databaseUrl },
        polar: {
          token: process.env.POLAR_ACCESS_TOKEN ?? '',
          webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
          contact: async workspaceId => {
            const contact = contacts[workspaceId];
            if (!contact) throw new BillingError('invalid_configuration');
            return contact;
          },
        },
      });
      storage = await CommercialStorage.open({ url: databaseUrl }, organizations.storage);
      commercial = new CommercialService(organizations, storage, initialized.provider, initialized.configuration);
      records = await RecoveryStorage.open({ url: databaseUrl });
      recovery = new BillingRecovery(records, initialized.provider);
      await recovery.start().ready;
      // This bootstrap has no billable resources; composed applications use
      // initializeMastraBilling.close() to drain all resources together.
      process.once('beforeExit', () => {
        void close();
      });
    } catch {
      await close();
      throw new BillingError('invalid_configuration');
    }
  }
  return {
    host: '127.0.0.1',
    port: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .parse(process.env.BILLING_PORT ?? 4111),
    ...billingOnlyServer(organizations, undefined, commercial, recovery),
  };
}
