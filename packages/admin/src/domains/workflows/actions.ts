'use server';

import { IntegrationApi, RefinedIntegrationEvent, UpdateBlueprintDto } from '@kepler/core';
import path from 'path';

import { framework } from '@/lib/framework-utils';

import { BlueprintWriterService } from '@/service/service.blueprintWriter';

import { getSerializedFrameworkActions, getSerializedFrameworkEvents } from './utils';

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
  const ARK_APP_DIR = process.env.ARK_APP_DIR || process.cwd();
  return path.join(ARK_APP_DIR, framework?.config?.blueprintDirPath || '/blueprints');
};

export const getFrameworkApi = async ({
  apiType,
  integrationName,
  referenceId = '',
}: {
  apiType: string;
  integrationName: string;
  referenceId: string;
}): Promise<string | null> => {
  const isSystemApi = integrationName === framework?.config?.name;
  const intApis = (
    isSystemApi ? framework?.getSystemApis() : framework?.getApisByIntegration(integrationName)
  ) as Record<string, IntegrationApi<any>>;

  const frameworkApi = (Object.values(intApis) as IntegrationApi[])?.find(({ type }) => apiType === type);

  if (!frameworkApi) return null;

  const serializedFrameworkApi = await getSerializedFrameworkActions({
    frameworkActions: [frameworkApi],
    ctx: { referenceId },
  });

  return serializedFrameworkApi;
};

export const getFrameworkEvent = async ({
  eventKey,
  integrationName,
  referenceId = '',
}: {
  eventKey: string;
  integrationName: string;
  referenceId: string;
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
    ctx: { referenceId },
  });

  return serializedFrameworkEvent;
};
