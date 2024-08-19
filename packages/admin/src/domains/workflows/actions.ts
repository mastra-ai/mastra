'use server';

import path from 'path';

import { BlueprintWriterService } from '@/service/service.blueprintWriter';

export const getBlueprints = async () => {
  const blueprintsPath = path.join(process.cwd(), '/mock-data/blueprints');
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.getBlueprints();
};

export const getBlueprint = async (blueprintId: string) => {
  const blueprintsPath = path.join(process.cwd(), '/mock-data/blueprints');
  const blueprintWriter = new BlueprintWriterService(blueprintsPath);
  return blueprintWriter.readBlueprint(path.join(blueprintsPath, `${blueprintId}.json`));
};
