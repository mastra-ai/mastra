'use server';

import { LogConfig } from '@mastra/core';

import { ConfigWriterService } from '@/service/service.configWriter';

export const getLogsConfig = async () => {
  const configPath = `${process.env.CONFIG_PATH}.ts`;

  if (!configPath) {
    throw new Error('Config path not set');
  }
  const configWriter = new ConfigWriterService(configPath);
  return configWriter.getLogsConfig();
};

export const saveLogsConfig = async (logsConfig: LogConfig) => {
  const configPath = `${process.env.CONFIG_PATH}.ts`;

  if (!configPath) {
    throw new Error('Config path not set');
  }
  const configWriter = new ConfigWriterService(configPath);
  return configWriter.updateLogsConfig(logsConfig);
};
