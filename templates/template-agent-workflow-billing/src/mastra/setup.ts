import { createBillingStudio } from '../server/studio.js';
import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from '../billing/contracts.js';
import type { BillingDriver } from '../billing/driver.js';
import { initializeMastraBilling } from '../billing/mastra-setup.js';
import { billingContactSchema } from '../billing/providers/polar-contract.js';
import { billingOnlyServer, enforceBillingBoundary } from '../server/security.js';
import { weatherResources } from '../weather/resources.js';
import { weatherConfiguration } from '../weather/configuration.js';
import { validateWeatherPrompt } from '../weather/observations.js';
import { readLocalProfiles } from '../local/profiles.js';
import { configuredOrganizations, billingDatabaseUrl } from './environment.js';
export { configuredOrganizations } from './environment.js';

export interface BillingApplicationOptions {
  readonly drivers?: readonly BillingDriver[];
}
export async function createWeatherApplication(
  environment: NodeJS.ProcessEnv = process.env,
  options: BillingApplicationOptions = {},
) {
  const organizations = await configuredOrganizations(environment);
  let initialized: Awaited<ReturnType<typeof initializeMastraBilling>> | undefined;
  try {
    const provider = parseInput(identifierSchema, environment.BILLING_PROVIDER ?? 'local');
    const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
    const profiles =
      provider === 'local' && organizations.identity.kind === 'local' ? await readLocalProfiles(root) : null;
    if (profiles && (!profiles.ready || profiles.databaseUrl !== (await billingDatabaseUrl(environment))))
      throw new BillingError('state_unavailable');
    const policy = parseInput(z.enum(['task', 'tokens']), environment.WEATHER_WORKFLOW_POLICY ?? 'task');
    const configuration: unknown = environment.BILLING_CONFIGURATION
      ? JSON.parse(environment.BILLING_CONFIGURATION)
      : weatherConfiguration(profiles?.profiles.owner?.workspaceId, policy);
    const resources = weatherResources(environment);
    const usePolarEnvironment = provider === 'polar' && !options.drivers?.some(driver => driver.id === provider);
    const contacts = usePolarEnvironment
      ? z.record(z.string(), billingContactSchema).parse(JSON.parse(environment.BILLING_CONTACTS ?? 'null'))
      : undefined;
    const runtime = await initializeMastraBilling({
      organizations,
      configuration,
      agents: resources.agents,
      workflows: resources.workflows,
      databaseUrl: await billingDatabaseUrl(environment),
      drivers: options.drivers,
      polar: usePolarEnvironment
        ? {
            token: environment.POLAR_ACCESS_TOKEN ?? '',
            webhookSecret: environment.POLAR_WEBHOOK_SECRET,
            contact: async workspaceId => {
              const contact = contacts?.[workspaceId];
              if (!contact) throw new BillingError('invalid_configuration');
              return contact;
            },
          }
        : undefined,
    });
    initialized = runtime;
    if (runtime.configuration.provider !== provider) throw new BillingError('invalid_configuration');
    resources.attach(prompt => runtime.billing.nestedAgent('weather-agent').generate(prompt));
    const execution = {
      ...runtime.billing.http,
      generate: (
        id: string,
        prompt: string,
        context: Parameters<typeof runtime.billing.http.generate>[2],
        key: string,
      ) =>
        runtime.billing.http.generate(
          id,
          id === 'weather-agent' ? validateWeatherPrompt(prompt) : prompt,
          context,
          key,
        ),
    };
    const studioEnabled =
      parseInput(z.enum(['true', 'false']), environment.BILLING_STUDIO_ENABLED ?? 'false') === 'true';
    const studio = studioEnabled ? createBillingStudio(organizations, execution, runtime.commercial) : undefined;
    const mastra = enforceBillingBoundary(
      new Mastra({
        logger: false,
        tools: studio?.tools,
        agents: resources.nativeAgents,
        workflows: resources.nativeWorkflows,
        storage: runtime.storage,
        server: {
          host: '127.0.0.1',
          port: parseInput(z.coerce.number().int().min(1).max(65535), environment.BILLING_PORT ?? 4111),
          ...billingOnlyServer(organizations, execution, runtime.commercial, runtime.recovery, studio),
        },
      }),
    );
    await runtime.startRecovery().ready;
    return {
      mastra,
      organizations,
      runtime,
      execution,
      close: async () => {
        await runtime.close();
        organizations.close();
      },
    };
  } catch (error) {
    await initialized?.close();
    organizations.close();
    throw error;
  }
}
export async function configuredWeatherMastra(
  environment: NodeJS.ProcessEnv = process.env,
  options: BillingApplicationOptions = {},
) {
  const application = await createWeatherApplication(environment, options);
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= application.close());
  process.once('beforeExit', () => {
    void close();
  });
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => {
      void close().finally(() => process.exit(0));
    });
  return application.mastra;
}
