'use server';

import { Credential, IntegrationCredentialType } from '@kpl/core';
import path from 'path';

import { framework } from '@/lib/framework-utils';
import { capitalizeFirstLetter } from '@/lib/string';

import {
  CredentialInfo,
  IntegrationConnection,
  IntegrationInstance,
  IntegrationSyncedDataItem,
} from '@/domains/integrations/types';
import { getIntegrationConfigAndWriteCredentialToEnv, getIntegrations } from '@/domains/integrations/utils';
import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';
import { IconName } from '@/types/icons';

export async function connectIntegrationByAPIKey({
  name,
  credential,
  referenceId,
}: {
  name: string;
  referenceId: string;
  credential: Credential;
}) {
  return await framework?.connectIntegrationByCredential({
    name,
    referenceId,
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
}: {
  integrationName: string;
  credential?: CredentialInfo;
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

  await configWriterService.addIntegration(integrationName, configString);
}

export const getOAuthConnectionRoute = async ({ name, referenceId }: { name: string; referenceId: string }) => {
  return framework?.makeConnectURI({
    clientRedirectPath: `/records/${name.toLowerCase()}`,
    name: name,
    referenceId,
  });
};

export const getIntegrationConnections = async ({
  name,
}: {
  name: string;
}): Promise<IntegrationConnection[] | undefined> => {
  return framework?.dataLayer?.getConnectionsByIntegrationName({ name });
};

export const getIntegrationInstance = async ({ name }: { name: string }): Promise<IntegrationInstance> => {
  const int = framework?.getIntegration(name);
  const connections = await getIntegrationConnections({ name });
  const defaultRedirectURI = framework?.makeRedirectURI() || 'Not Availiable';
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
  };
};

const entityTypeToIcon: Record<string, IconName> = {
  EMAIL: 'envelope',
  CONTACTS: 'user',
  CALENDAR: 'calendar',
  ACTION: 'activity',
};

const entityTypeToLabelMap: Record<string, string> = {
  CONTACTS: 'Contact',
  CALENDAR: 'Calendar Event',
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
        connectionId: {
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
