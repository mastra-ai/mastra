import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from '../billing/contracts.js';
import { JwtIdentityAdapter } from '../billing/identity.js';
import type { JwtIdentityOptions } from '../billing/identity.js';
import { OrganizationService } from '../billing/organizations.js';
import { OrganizationStorage } from '../billing/storage/organizations.js';

export function applicationMode(environment: NodeJS.ProcessEnv) {
  const explicit = parseInput(z.enum(['local', 'production']).optional(), environment.BILLING_MODE);
  return (
    explicit ?? (environment.NODE_ENV === 'production' && environment.MASTRA_DEV !== 'true' ? 'production' : 'local')
  );
}
export async function billingDatabaseUrl(environment: NodeJS.ProcessEnv) {
  if (environment.BILLING_DATABASE_URL) return environment.BILLING_DATABASE_URL;
  const directory = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.', 'data');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  return pathToFileURL(resolve(directory, 'billing.db')).href;
}
export async function configuredOrganizations(environment: NodeJS.ProcessEnv = process.env) {
  const storage = await OrganizationStorage.open({ url: await billingDatabaseUrl(environment) });
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
      mode: applicationMode(environment),
      provider: parseInput(identifierSchema, environment.BILLING_PROVIDER ?? 'local'),
    });
  } catch (error) {
    storage.close();
    throw error;
  }
}
