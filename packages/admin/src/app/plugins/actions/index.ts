'use server';

import { CredentialValue } from 'core';
import path from 'path';

import { getPluginConfig } from '@/domains/plugins/utils';
import { ConfigWriterService } from '@/service/service.configWriter';

import { future } from '../../../../example.future.config';

export async function connectIntegration({
  name,
  connectionId,
  credentialValue,
}: {
  name: string;
  connectionId: string;
  credentialValue: CredentialValue;
}) {
  const authenticator = future.authenticator(name);
  const credential = {
    type: 'API_KEY',
    value: credentialValue,
  };

  await future.connectPlugin({ name, connectionId, authenticator, credential });
}

export async function addPluginAction(pluginName: string) {
  const configPath = path.join(__dirname, '../../../../..', 'example.future.config.ts');
  const configWriterService = new ConfigWriterService(configPath);
  const configString = getPluginConfig(pluginName);

  await configWriterService.addPlugin(pluginName, configString);
}
