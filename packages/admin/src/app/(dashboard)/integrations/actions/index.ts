'use server';

import { Credential, IntegrationCredentialType } from '@kpl/core';
import path from 'path';

import { framework } from '@/lib/framework-utils';

import { CredentialInfo } from '@/domains/integrations/types';
import { getIntegrationConfigAndWriteCredentialToEnv } from '@/domains/integrations/utils';
import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';

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
