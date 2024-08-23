import { client } from '../next/inngest';
import path from 'path';
import * as fs from 'fs';
import { Blueprint, WorkflowStatusEnum } from '../workflows/types';
import first from 'lodash/first';
import last from 'lodash/last';

async function readBlueprint(filePath: string): Promise<Blueprint> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else {
        const jsonData = JSON.parse(data);
        const blueprintFile = last(filePath?.split('/'))!;
        const blueprintId = first(blueprintFile?.split('.json'))!;
        resolve({ ...jsonData, id: blueprintId });
      }
    });
  });
}

async function getBlueprints({
  directoryPath,
}: {
  directoryPath: string;
}): Promise<Blueprint[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, async (err, files) => {
      if (err) reject(err);
      else {
        const jsonFiles = files.filter((file) => file.endsWith('.json'));
        const result = [];
        for (const file of jsonFiles) {
          const filePath = path.join(directoryPath, file);
          const jsonData = await readBlueprint(filePath);
          if (jsonData.title) {
            const blueprintFile = last(filePath?.split('/'))!;
            const blueprintId = first(blueprintFile?.split('.json'))!;
            result.push({ ...jsonData, id: blueprintId });
          }
        }
        resolve(result);
      }
    });
  });
}

export const createWorkflowHandler = ({
  blueprintDirPath,
  runBlueprint,
}: {
  blueprintDirPath: string;
  runBlueprint: Function;
}) => {
  return client.createFunction(
    { id: 'workflow-executor', retries: 0 },
    { event: 'workflow/run-automations' },
    async ({ event, step }) => {
      try {
        const { trigger, payload, blueprintId } = event.data;
        const { referenceId } = event.user;

        const getBlueprintsDirPath = async () => {
          const ARK_APP_DIR = process.cwd();
          return path.join(ARK_APP_DIR, blueprintDirPath || '/blueprints');
        };

        const blueprints = await getBlueprintsDirPath().then((dir) => {
          return getBlueprints({ directoryPath: dir });
        });

        const triggeredAndPublishedBlueprints = blueprints.filter(
          (blueprint) =>
            blueprint.trigger?.type === trigger &&
            blueprint.status === WorkflowStatusEnum.PUBLISHED
        );

        const runs = triggeredAndPublishedBlueprints.map((blueprint) => {
          return step.run(`run-blueprint: ${blueprint.id}`, async () => {
            return runBlueprint({
              blueprint,
              dataCtx: payload,
              ctx: { referenceId },
            });
          });
        });

        await Promise.all(runs);

        return { event, body: `sync completed` };
      } catch (error) {
        return { event, body: `error occurred while running sync: ${error}` };
      }
    }
  );
};
