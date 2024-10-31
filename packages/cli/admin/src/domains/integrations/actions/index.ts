'use server';

import { Credential, IntegrationCredentialType } from '@mastra/core';
import path from 'path';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { framework } from '@/lib/framework-utils';
import { capitalizeFirstLetter } from '@/lib/string';

import {
  ApiKeyConfigProps,
  CredentialInfo,
  IntegrationConnection,
  IntegrationInstance,
  IntegrationSyncEvent,
  IntegrationSyncedDataItem,
  entityTypeToIcon,
  entityTypeToLabelMap,
} from '@/domains/integrations/types';
import {
  getConnectSnippet,
  getIntegrationConfigAndWriteCredentialToEnv,
  getIntegrations,
} from '@/domains/integrations/utils';
import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';

export async function connectIntegrationByAPIKey({
  name,
  credential,
  connectionId,
}: {
  name: string;
  connectionId: string;
  credential: Credential;
}) {
  return await framework?.connectIntegrationByCredential({
    name,
    connectionId,
    credential: {
      type: IntegrationCredentialType.API_KEY,
      value: credential,
    },
  });
}

export async function getCredentialAction({ integrationName }: { integrationName: string }) {
  const envFilePath = path.join(process.cwd(), '.env');
  const fileEnvService = new FileEnvService(envFilePath);
  const upperCasedIntegrationName = integrationName.toUpperCase();
  const clientID = await fileEnvService.getEnvValue(`${upperCasedIntegrationName}_CLIENT_ID`);
  const clientSecret = await fileEnvService.getEnvValue(`${upperCasedIntegrationName}_CLIENT_SECRET`);
  return {
    clientID: clientID || '',
    clientSecret: clientSecret || '',
    scopes: [], // TODO: retrieve scope from config file
  };
}

export async function addIntegrationAction({
  integrationName,
  credential,
  isUserDefined,
}: {
  integrationName: string;
  credential?: CredentialInfo;
  isUserDefined: boolean | undefined;
}) {
  //TODO: validate our envs
  const configPath = `${process.env.CONFIG_PATH}.ts`;

  if (!configPath) {
    throw new Error('Config path not set');
  }
  const configWriterService = new ConfigWriterService(configPath);
  const configString = await getIntegrationConfigAndWriteCredentialToEnv({
    integrationName,
    credential,
  });

  await configWriterService.addIntegration(integrationName, configString, isUserDefined);
}

export const getOAuthConnectionRoute = async ({ name, connectionId }: { name: string; connectionId: string }) => {
  const router = framework?.createRouter();
  const route = router?.makeConnectURI({
    clientRedirectPath: `/records/${name.toLowerCase()}`,
    name: name,
    connectionId,
  });
  return route;
};

export const getIntegrationConnections = async ({
  name,
}: {
  name: string;
}): Promise<IntegrationConnection[] | undefined> => {
  return framework?.dataLayer?.getConnectionsByIntegrationName({ name });
};

export const getIntegrationInstance = async ({ name }: { name: string }): Promise<IntegrationInstance> => {
  const int = framework?.getIntegration(name?.toUpperCase());
  const connections = await getIntegrationConnections({ name });
  const router = framework?.createRouter();
  const defaultRedirectURI = router?.makeRedirectURI() || 'Not Availiable';
  const credentials = await getCredentialAction({ integrationName: name });
  const integrations = await getIntegrations();
  const integration = integrations.find(i => i.name.toLowerCase() === name.toLowerCase());
  const availableScopes = integration?.availableScopes || [];

  return {
    name: int?.name!,
    logoUrl: int?.logoUrl!,
    connections,
    authType: int?.config?.authType,
    redirectUri: defaultRedirectURI,
    ...credentials,
    availableScopes,
    config: integration?.config,
    isUserDefined: integration?.isUserDefined,
  };
};

export const getIntegrationSyncedData = async ({ name }: { name: string }) => {
  const apis = framework?.globalApis.get(name?.toUpperCase()) || {};
  const events = framework?.getEventsByIntegration(name) || {};
  const integration = framework?.getIntegration(String(name).toUpperCase());
  const entityTypes = integration?.entityTypes || {};
  const connections = await getIntegrationConnections({ name });
  const entityToRecordCountMap: Record<string, number> = {};

  if (connections?.length) {
    const recordCount = await framework?.dataLayer.db.entity.findMany({
      where: {
        k_id: {
          in: connections.map(({ id }) => id),
        },
      },
      include: {
        _count: {
          select: {
            records: true,
          },
        },
      },
    });
    recordCount?.reduce((acc, entity) => {
      acc[entity.type] = acc[entity.type] ? acc[entity.type] + entity._count.records : entity._count.records;
      return acc;
    }, entityToRecordCountMap);
  }

  const entityTypesData = Object.keys(entityTypes).map(entityType => ({
    label: entityTypeToLabelMap[entityType] || capitalizeFirstLetter(entityType),
    icon: entityTypeToIcon[entityType] || 'activity',
    type: entityType,
    count: entityToRecordCountMap[entityType] || 0,
  }));

  const apiCount = Object.keys(apis).length || 0;
  const eventsCount = Object.keys(events).length || 0;

  const syncedData: IntegrationSyncedDataItem[] = [
    { label: 'Connection', icon: 'activity', type: 'CONNECTIONS', count: connections?.length || 0 },
    ...entityTypesData,
    {
      label: 'Api',
      icon: 'trigger',
      type: 'ACTION',
      count: apiCount,
    },
    {
      label: 'Event',
      icon: 'action',
      type: 'EVENT',
      count: eventsCount,
    },
  ];

  return syncedData;
};

export const getIntegrationConnectSnippet = async ({
  integrationName,
  authType,
  apiKeyConfig,
}: {
  integrationName: string;
  authType: IntegrationCredentialType;
  apiKeyConfig?: ApiKeyConfigProps;
}) => {
  if (authType === IntegrationCredentialType.API_KEY && apiKeyConfig) {
    return getConnectSnippet({
      authType: IntegrationCredentialType.API_KEY,
      integrationName,
      apiKeyConfig,
    });
  }

  if (authType === IntegrationCredentialType.OAUTH) {
    return getConnectSnippet({
      authType,
      integrationName,
    });
  }

  return '';
};

export const getAvailableIntegrations = async () => {
  const integrations = [
    {
      name: framework?.config?.name,
      integration: {
        name: framework?.config?.name,
        logoUrl: 'system',
      },
    },
    ...(framework?.availableIntegrations() || []),
  ]?.map(({ name, integration }) => {
    const events = framework?.getEventsByIntegration(name!);
    return {
      name,
      logoUrl: (integration as { logoUrl: string }).logoUrl || 'system',
      entityTypes: events
        ? Object.values(events)
            ?.map(ev => ev.entityType!)
            ?.filter(Boolean)
        : [],
    };
  });

  return integrations;
};

export const getIntegrationSyncEvents = async ({
  integration,
  page = 1,
  pageSize,
  searchedEntity,
}: {
  integration: string;
  page: number;
  pageSize?: number;
  searchedEntity?: string;
}) => {
  if (!integration) return;
  const int = integration.toUpperCase();

  const configName = framework?.config?.name;

  const events = framework?.getEventsByIntegration(configName?.toUpperCase() === int ? configName : int);

  const eventsArray = events
    ? Object.entries(events).map(([key, event]) => {
        return {
          ...event,
          syncEvent: key,
          entityType: event.entityType,
          fields: event.fields,
          schema: zodToJsonSchema(event.schema as any),
        };
      })
    : [];

  if (page && pageSize) {
    const to = page * pageSize;
    const from = to - pageSize;

    const eventsResult = eventsArray
      ?.filter(({ entityType }) =>
        searchedEntity ? entityType?.toLowerCase()?.includes(searchedEntity?.toLowerCase()) : !!entityType,
      )
      ?.slice(from, to);

    return stringify(eventsResult);
  }

  const eventsResult = eventsArray?.filter(({ entityType }) =>
    searchedEntity ? entityType?.toLowerCase()?.includes(searchedEntity?.toLowerCase()) : !!entityType,
  ) as IntegrationSyncEvent[];

  return stringify(eventsResult);
};
