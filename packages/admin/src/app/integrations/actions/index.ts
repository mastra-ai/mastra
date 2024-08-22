'use server';

import { Credential } from '@arkw/core';
import path from 'path';

import { getFramework } from '@/lib/framework-utils';

import { CredentialInfo } from '@/domains/integrations/types';
import { getIntegrationConfigAndWriteCredentialToEnv } from '@/domains/integrations/utils';
import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';

export async function connectIntegration({
  name,
  credential,
  referenceId,
}: {
  name: string;
  referenceId: string;
  credential: Credential;
}) {
  const framework = await getFramework();
  const authenticator = framework?.authenticator(name);

  if (!authenticator) {
    throw new Error(`Authenticator for ${name} not found`);
  }

  await framework?.connectIntegration({ name, referenceId, authenticator, credential });
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
  const configPath = process.env.ARK_CONFIG_PATH || path.join(__dirname, '../../../../..', 'example.future.config.ts');
  const configWriterService = new ConfigWriterService(configPath);
  const configString = await getIntegrationConfigAndWriteCredentialToEnv({
    integrationName,
    credential,
  });

  await configWriterService.addIntegration(integrationName, configString);
}
