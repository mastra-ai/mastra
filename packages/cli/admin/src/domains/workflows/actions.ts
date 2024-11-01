'use server';

import { IntegrationApi, RefinedIntegrationEvent, UpdateBlueprintDto, getUpstashLogs } from '@mastra/core';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

import { framework, config } from '@/lib/framework-utils';

import { BlueprintWriterService } from '@/service/service.blueprintWriter';

import { Log } from '../logs/types';

import { getSerializedFrameworkApis, getSerializedFrameworkEvents } from './utils';

export const getBlueprints = async () => {
  const blueprintsPath = await getBlueprintsDirPath();
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.getBlueprints();
};

export const getBlueprint = async (blueprintId: string) => {
  const blueprintsPath = await getBlueprintsDirPath();
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.readBlueprint(path.join(blueprintsPath, `${blueprintId}.json`));
};

export const saveBlueprint = async (blueprintId: string, blueprint: UpdateBlueprintDto) => {
  const blueprintsPath = await getBlueprintsDirPath();
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.writeBlueprint(path.join(blueprintsPath, `${blueprintId}.json`), blueprint);
};

export const deleteBlueprint = async (blueprintId: string) => {
  const blueprintsPath = await getBlueprintsDirPath();
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.deleteBlueprint(path.join(blueprintsPath, `${blueprintId}.json`));
};

export const getBlueprintsDirPath = async () => {
  const MASTRA_APP_DIR = process.env.MASTRA_APP_DIR || process.cwd();
  const blueprintDirPath = framework?.config?.workflows?.blueprintDirPath;

  if (!blueprintDirPath) {
    throw new Error('Missing blueprintDirPath in config');
  }
  return path.join(MASTRA_APP_DIR, blueprintDirPath);
};

export const getAgentLogsDirPath = async () => {
  const MASTRA_APP_DIR = process.env.MASTRA_APP_DIR || process.cwd();
  return path.join(MASTRA_APP_DIR, '/mastra/logs/agent');
};

export const getLogsDirPath = async () => {
  const MASTRA_APP_DIR = process.env.MASTRA_APP_DIR || process.cwd();
  return path.join(MASTRA_APP_DIR, '/mastra/logs/');
};

export const getLogs = async (registeredLoggers: string[]) => {
  const logsFolderPath = await getLogsDirPath();

  const logFolders = registeredLoggers.length
    ? registeredLoggers.map(lg => lg.toLowerCase())
    : readdirSync(logsFolderPath, { recursive: true, withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

  if (config?.logs?.provider === 'FILE') {
    const files = logFolders.reduce((acc: string[], d) => {
      return [...acc, ...readdirSync(path.join(logsFolderPath, d)).map(file => path.join(d, file))];
    }, []);

    return files.flatMap(file => {
      const id = file.split('.json')[0];
      const log = [JSON.parse(readFileSync(path.join(logsFolderPath, file), 'utf-8'))].flat();
      const logs: Log[] = log.map(
        ({ message, createdAt, ...props }: { message: string; createdAt: string; statusCode: number }) => {
          const parsedMessage = JSON.parse(message);
          return {
            ...parsedMessage,
            ...props,
            logId: id,
            createdAt,
          };
        },
      );

      return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }

  if (config?.logs?.provider === 'UPSTASH') {
    const upstashLogs = await Promise.all(
      logFolders.flatMap(async logFolder => {
        const id = `mastra/logs/${logFolder}`;
        const log = (await getUpstashLogs({
          id,
          url: (
            config?.logs as {
              config: {
                url: string;
                token: string;
              };
            }
          )?.config?.url,
          token: (
            config?.logs as {
              config: {
                url: string;
                token: string;
              };
            }
          )?.config?.token,
        })) as any[];

        const logs: Log[] = log.map(
          ({ message, createdAt, ...props }: { message: string; createdAt: string; statusCode: number }) => {
            const parsedMessage = JSON.parse(message);
            return {
              ...parsedMessage,
              ...props,
              logId: id,
              createdAt,
            };
          },
        );

        return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }),
    );

    return upstashLogs?.flatMap(i => i);
  }

  return [];
};

export const getAgentLogs = async () => {
  const blueprintsPath = await getAgentLogsDirPath();
  const files = readdirSync(blueprintsPath);

  if (config?.logs?.provider === 'FILE') {
    return files.flatMap(file => {
      const id = path.basename(file, '.json');
      const log = JSON.parse(readFileSync(path.join(blueprintsPath, file), 'utf-8'));
      const logs: Log[] = log.map(
        ({ message, createdAt, ...props }: { message: string; createdAt: string; statusCode: number }) => {
          const parsedMessage = JSON.parse(message);
          return {
            ...parsedMessage,
            ...props,
            logId: id,
            createdAt,
          };
        },
      );

      return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }

  if (config?.logs?.provider === 'UPSTASH') {
    const upstashLogs = await Promise.all(
      files.flatMap(async file => {
        const id = path.basename(file, '.json');

        const log = (await getUpstashLogs({
          id: file,
          url: (
            config?.logs as {
              config: {
                url: string;
                token: string;
              };
            }
          ).config?.url,
          token: (
            config?.logs as {
              config: {
                url: string;
                token: string;
              };
            }
          ).config?.token,
        })) as any[];

        const logs: Log[] = log.map(
          ({ message, createdAt, ...props }: { message: string; createdAt: string; statusCode: number }) => {
            const parsedMessage = JSON.parse(message);
            return {
              ...parsedMessage,
              ...props,
              logId: id,
              createdAt,
            };
          },
        );

        return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }),
    );

    return upstashLogs?.flatMap(i => i);
  }

  return [];
};

export const getFrameworkApi = async ({
  apiType,
  integrationName,
  connectionId = '',
}: {
  apiType: string;
  integrationName: string;
  connectionId: string;
}): Promise<string | null> => {
  const isSystemApi = [framework?.config?.name, 'SYSTEM'].includes(integrationName);
  const intApis = (
    isSystemApi ? framework?.getSystemApis() : framework?.getApisByIntegration(integrationName)
  ) as Record<string, IntegrationApi<any>>;

  const frameworkApi = (Object.values(intApis) as IntegrationApi[])?.find(({ type }) => apiType === type);

  if (!frameworkApi) return null;

  const serializedFrameworkApi = await getSerializedFrameworkApis({
    frameworkApis: [frameworkApi],
    ctx: { connectionId },
  });

  return serializedFrameworkApi;
};

export const getFrameworkEvent = async ({
  eventKey,
  integrationName,
  connectionId = '',
}: {
  eventKey: string;
  integrationName: string;
  connectionId: string;
}): Promise<string | null> => {
  const isSystemEvent = integrationName === framework?.config?.name;
  const systemEvents = framework?.getSystemEvents();
  const refinedSystemEvents: RefinedIntegrationEvent[] = Object.entries(systemEvents ?? {}).map(([k, v]) => {
    return {
      ...v,
      key: k,
      integrationName: framework?.config.name,
    };
  });

  const intEvents = framework?.getEventsByIntegration(integrationName)!;
  const refinedEvents: RefinedIntegrationEvent[] = Object.entries(intEvents).map(([k, v]) => {
    return {
      ...v,
      key: k,
      label: k,
      integrationName,
    };
  });

  const events = isSystemEvent ? refinedSystemEvents : refinedEvents;

  const frameworkEvent = events?.find(({ key }) => key === eventKey);

  if (!frameworkEvent) return null;

  const serializedFrameworkEvent = await getSerializedFrameworkEvents({
    frameworkEvents: [frameworkEvent],
    ctx: { connectionId },
  });

  return serializedFrameworkEvent;
};
