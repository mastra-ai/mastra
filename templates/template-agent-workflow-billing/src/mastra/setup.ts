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
  return {
    host: '127.0.0.1',
    port: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .parse(process.env.BILLING_PORT ?? 4111),
    ...billingOnlyServer(organizations),
  };
}
