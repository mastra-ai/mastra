'use server';

import { UpdateBlueprintDto } from '@arkw/core';
import path from 'path';

import { BlueprintWriterService } from '@/service/service.blueprintWriter';

import { future } from '../../../example.future.config';

export const getBlueprints = async () => {
  const blueprintsPath = path.join(process.cwd(), future.config.blueprintDirPath);
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.getBlueprints();
};

export const getBlueprint = async (blueprintId: string) => {
  const blueprintsPath = path.join(process.cwd(), future.config.blueprintDirPath);
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.readBlueprint(path.join(blueprintsPath, `${blueprintId}.json`));
};

export const saveBlueprint = async (blueprintId: string, blueprint: UpdateBlueprintDto) => {
  const blueprintsPath = path.join(process.cwd(), future.config.blueprintDirPath);
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.writeBlueprint(path.join(blueprintsPath, `${blueprintId}.json`), blueprint);
};
