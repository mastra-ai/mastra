import path from 'path';
import { Mastra } from '../framework';
import { getBlueprintsSync } from './handler';
import { WorkflowStatusEnum } from './types';
import { IntegrationApi, IntegrationEvent } from '../types';
import { z } from 'zod';

export function getWorkflowApis({
  mastra,
}: {
  mastra: Mastra;
}): IntegrationApi[] {
  const blueprintDirPath = mastra.config.workflows.blueprintDirPath;

  const getBlueprintsDirPath = () => {
    const MASTRA_APP_DIR = process.env.MASTRA_APP_DIR || process.cwd();
    if (!blueprintDirPath) {
      throw new Error('Missing blueprintDirPath in config');
    }
    return path.join(MASTRA_APP_DIR, blueprintDirPath);
  };

  const blueprints = getBlueprintsSync({
    directoryPath: getBlueprintsDirPath(),
  });

  const publishedBlueprints = blueprints.filter(
    (blueprint) => blueprint.status === WorkflowStatusEnum.PUBLISHED
  );

  const events = mastra.getGlobalEvents();

  const allEvents = Array.from(events.values()).reduce<
    Record<string, IntegrationEvent>
  >((acc, val) => {
    return {
      ...acc,
      ...val,
    };
  }, {});

  const getEvent = (type: string) => {
    return Object.entries(allEvents).find(([key]) => key === type)?.[1];
  };

  return publishedBlueprints.map((blueprint) => {
    return {
      integrationName: mastra.config.name,
      source: 'WORKFLOW',
      description: `Workflow Trigger API for ${blueprint.title} `,
      label: `${blueprint.title} Trigger`,
      schema: getEvent(blueprint.trigger?.type!)?.schema!,
      type: blueprint?.title.replaceAll(' ', '_').toLowerCase(),
      executor(params) {
        const { data, ctx } = params;
        return mastra.triggerEvent({
          data,
          key: blueprint.trigger?.type!,
          integrationName: mastra.config.name,
          user: {
            connectionId: ctx.connectionId,
          },
        });
      },
    };
  });
}

export function eventTriggerApi({
  mastra,
}: {
  mastra: Mastra;
}): IntegrationApi {
  const api: IntegrationApi = {
    integrationName: mastra.config.name,
    type: 'trigger_event',
    label: 'Trigger event',
    // getSchemaOptions({ ctx }) {
    //   const options = Promise.resolve({
    //     event: {
    //       options: Array.from(framework.globalEvents.values()).flatMap(
    //         (eventRecord) =>
    //           Object.values(eventRecord).map((event) => ({
    //             value: event.key || event.label || '',
    //             label: event.key || event.label || '',
    //           })).filter((event) => event.value !== '')
    //       ),
    //     },
    //   });
    //   return options;
    // },
    description: 'Trigger event',
    schema: z.object({
      event: z.string(),
      data: z.record(z.any()),
    }),
    executor: async ({ data, ctx }) => {
      const { event } = data;
      return await mastra.triggerEvent({
        key: event,
        data: data.data,
        user: {
          connectionId: ctx.connectionId,
        },
      });
    },
  };
  return api;
}
