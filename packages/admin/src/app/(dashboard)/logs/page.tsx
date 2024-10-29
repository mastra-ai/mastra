import { LogLevel } from '@mastra/core';
import { Metadata } from 'next';

import { getLogsConfig } from '@/domains/logs/actions';

import LogsClientLayout from './client-layout';

export const metadata: Metadata = {
  title: 'Logs',
  description: 'Logs ...',
};

export default async function Logs() {
  const defaultLogOptions = await getLogsConfig();
  const upstashConfig = {
    url: process.env.UPSTASH_URL ?? '',
    apiKey: process.env.UPSTASH_API_KEY ?? '',
  };
  const logLevelOptions: Array<{ name: string; value: LogLevel }> = [
    { name: 'Debug', value: LogLevel.DEBUG },
    { name: 'Info', value: LogLevel.INFO },
    { name: 'Error', value: LogLevel.ERROR },
    { name: 'Warn', value: LogLevel.WARN },
  ];

  return (
    <LogsClientLayout
      defaultUpstashConfig={upstashConfig}
      defaultLogOptions={defaultLogOptions}
      logLevelOptions={logLevelOptions}
    />
  );
}
