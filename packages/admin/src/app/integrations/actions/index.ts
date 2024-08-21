'use server';

import { Credential } from '@arkw/core';
import path from 'path';

import { CredentialInfo } from '@/domains/integrations/types';
import { getIntegrationConfigAndWriteCredentialToEnv } from '@/domains/integrations/utils';
import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';

import { future } from '../../../../example.future.config';

export async function connectIntegration({
  name,
  credential,
  referenceId,
}: {
  name: string;
  referenceId: string;
  credential: Credential;
}) {
  const authenticator = future.authenticator(name);

  await future.connectIntegration({ name, referenceId, authenticator, credential });
}

export async function getCredentialAction({ integrationName }: { integrationName: string }) {
  const envFilePath = path.join(process.cwd(), '.env');
  const fileEnvService = new FileEnvService(envFilePath);
  const upperCasedIntegrationName = integrationName.toUpperCase();
  const clientID = await fileEnvService.getEnvValue(`${upperCasedIntegrationName}_CLIENT_ID`);
  const clientSecret = await fileEnvService.getEnvValue(`${upperCasedIntegrationName}_CLIENT_SECRET`);
  return { clientID, clientSecret };
}

export async function addIntegrationAction({
  integrationName,
  credential,
}: {
  integrationName: string;
  credential: CredentialInfo;
}) {
  const configPath = path.join(__dirname, '../../../../..', 'example.future.config.ts');
  const configWriterService = new ConfigWriterService(configPath);
  const configString = await getIntegrationConfigAndWriteCredentialToEnv({
    integrationName,
    credential,
  });

  await configWriterService.addIntegration(integrationName, configString);
}
