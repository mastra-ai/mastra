import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { identifierSchema, parseInput } from '../contracts/core.js';
import { readConfigurationFile, validateConfigurationFiles } from './files.js';
import { JwtIdentityAdapter } from '../identity.js';
import type { JwtIdentityOptions } from '../identity.js';
import { OrganizationService } from '../organizations.js';
import { OrganizationStorage } from '../storage/organizations.js';

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
  validateConfigurationFiles(environment);
  const storage = await OrganizationStorage.open({ url: await billingDatabaseUrl(environment) });
  try {
    let identity;
    const options = readConfigurationFile(environment, 'BILLING_IDENTITY_CONFIG_FILE');
    if (options !== undefined) identity = new JwtIdentityAdapter(storage, options as JwtIdentityOptions);
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

/** Parse the complete optional policy override without exposing malformed JSON or secrets. */
export function readBillingConfiguration(environment: NodeJS.ProcessEnv): unknown {
  return readConfigurationFile(environment, 'BILLING_CONFIG_FILE');
}
