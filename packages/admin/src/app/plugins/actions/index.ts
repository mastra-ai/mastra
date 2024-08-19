'use server';

import { DataIntegrationCredential } from 'core';
import path from 'path';

import { getPluginConfig } from '@/domains/plugins/utils';
import { ConfigWriterService } from '@/service/service.configWriter';

import { future } from '../../../../example.future.config';

export async function connectIntegration({
  name,
  credential,
  connectionId,
}: {
  name: string;
  connectionId: string;
  credential: DataIntegrationCredential;
}) {
  const authenticator = future.authenticator(name);

  await future.connectPlugin({ name, connectionId, authenticator, credential });
}

export async function addPluginAction(pluginName: string) {
  const configPath = path.join(__dirname, '../../../../..', 'example.future.config.ts');
  const configWriterService = new ConfigWriterService(configPath);
  const configString = getPluginConfig(pluginName);

  await configWriterService.addPlugin(pluginName, configString);
}
