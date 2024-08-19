'use server';

import path from 'path';

import { BlueprintWriterService } from '@/service/service.blueprintWriter';

export const getBlueprints = async () => {
  const blueprintWriter = new BlueprintWriterService(path.join(__dirname, '../../../../mock-data/blueprints'));
  return blueprintWriter.getBlueprints();
};

export const getBlueprint = async (blueprintId: string) => {
  const blueprintWriter = new BlueprintWriterService(path.join(__dirname, '../../../../mock-data/blueprints'));
  return blueprintWriter.readBlueprint(path.join(__dirname, '../../../../mock-data/blueprints', `${blueprintId}.json`));
};
