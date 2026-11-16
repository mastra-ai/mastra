import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bindingSchema } from '../providers/autumn/configuration.js';
import { jwtIdentityConfigurationSchema } from '../identity.js';
import { billingConfigurationSchema } from './policy.js';
import { BillingError } from '../contracts/core.js';

/** Read an explicitly selected external JSON object relative to the application root. */
export function readConfigurationFile(environment: NodeJS.ProcessEnv, name: string): unknown {
  const path = environment[name];
  if (path === undefined) return undefined;
  try {
    if (!path.trim()) throw new Error();
    const root = environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.';
    const value: unknown = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new BillingError('invalid_configuration');
  }
}

/** Fail before serving for every explicitly selected configuration file. */
export function validateConfigurationFiles(environment: NodeJS.ProcessEnv) {
  for (const [name, schema] of [
    ['BILLING_CONFIG_FILE', billingConfigurationSchema],
    ['AUTUMN_CONFIG_FILE', bindingSchema],
    ['BILLING_IDENTITY_CONFIG_FILE', jwtIdentityConfigurationSchema],
  ] as const) {
    const input = readConfigurationFile(environment, name);
    if (input !== undefined && !schema.safeParse(input).success) throw new BillingError('invalid_configuration');
  }
}
