'use server';

import path from 'path';

import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';

export const saveVectorToConfigAction = async ({ providerName, apiKey }: { providerName: string; apiKey: string }) => {
  const configPath = `${process.env.CONFIG_PATH}.ts`;

  if (!configPath) {
    throw new Error('Config path not set');
  }
  const configWriterService = new ConfigWriterService(configPath);
  const envFilePath = path.join(process.cwd(), '.env');
  const fileEnvService = new FileEnvService(envFilePath);
  const envKey = `${providerName.toUpperCase()}_API_KEY`;
  await fileEnvService.setEnvValue(envKey, apiKey);
  await configWriterService.updateVectorProvider({
    providerName: providerName.toUpperCase(),
    apiKey: envKey,
  });
};

export const checkVectorProviderExistsAction = async (providerName: string): Promise<boolean> => {
  const configPath = `${process.env.CONFIG_PATH}.ts`;

  if (!configPath) {
    throw new Error('Config path not set');
  }

  const configWriterService = new ConfigWriterService(configPath);

  try {
    const exists = await configWriterService.checkIfVectorProviderExists(providerName.toUpperCase());
    return exists;
  } catch (error) {
    console.error(`Error checking if vector provider exists: ${error}`);
    return false;
  }
};
