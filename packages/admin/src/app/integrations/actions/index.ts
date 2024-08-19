'use server';

import { Credential } from 'core';
import path from 'path';

import { getIntegrationConfig } from '@/domains/integrations/utils';
import { ConfigWriterService } from '@/service/service.configWriter';

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

export async function addIntegrationAction(integrationName: string) {
  const configPath = path.join(__dirname, '../../../../..', 'example.future.config.ts');
  const configWriterService = new ConfigWriterService(configPath);
  const configString = getIntegrationConfig(integrationName);

  await configWriterService.addIntegration(integrationName, configString);
}
