'use server';

import { UpdateBlueprintDto } from '@arkw/core';
import path from 'path';

import { framework } from '@/lib/framework-utils';

import { BlueprintWriterService } from '@/service/service.blueprintWriter';

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
  return path.join(process.cwd(), framework?.config?.blueprintDirPath || '/blueprints');
};
