import { DataLayer } from './data-access';
import { Framework } from './framework';
import { Integration } from './integration';
import { IntegrationAction, IntegrationEvent } from './types';

export interface Config {
  name: string;
  systemHostURL: string;
  routeRegistrationPath: string;
  blueprintDirPath: string;
  db: {
    provider: string;
    uri: string;
  };
  integrations: Integration[];
  systemActions: Omit<IntegrationAction, 'integrationName'>[];
  systemEvents: Record<string, IntegrationEvent<any>>;
  env?: {
    provider?: 'local' | 'vercel';
    file?: string;
  };
}

export * from './workflows/types';
export { IntegrationError } from './utils/errors';
export { DataLayer } from './data-access';
export { registerRoutes } from './next';
export * from './types';
export * from './lib';
export { Integration } from './integration';
export { IntegrationCredentialType } from './types';
export {
  PropertyType,
  Connection,
  Credential,
  Entity,
  Property,
  Record,
} from '@prisma-app/client';
export { IntegrationAuth } from './authenticator';
export * from './utils';
export * from './next/utils';
export * from './schemas';
export { Framework } from './framework';

export * from './generated-types';

export function createFramework(config: Config) {
  if (!config.db.uri) {
    throw new Error('No database config/provider found');
  }

  const dataLayer = new DataLayer({
    url: config.db.uri,
    provider: config.db.provider,
  });

  const framework = new Framework({
    dataLayer,
    config: {
      routeRegistrationPath: config?.routeRegistrationPath,
      systemHostURL: config?.systemHostURL,
      blueprintDirPath: config?.blueprintDirPath,
      name: config?.name,
    },
  });

  // Register integrations
  config.integrations.forEach((integration) => {
    framework.registerIntgeration(integration);
  });

  // Register System actions
  framework.registerActions({
    actions: config.systemActions?.map((action) => {
      return {
        ...action,
        integrationName: config.name,
      };
    }),
  });

  // Register System events
  framework.registerEvents({
    events: config.systemEvents,
  });

  return framework;
}
