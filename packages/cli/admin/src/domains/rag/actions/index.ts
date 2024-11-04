'use server';

import path from 'path';

import { framework } from '@/lib/framework-utils';

import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';
import { VercelJsonService } from '@/service/service.vercelJson';

import { VectorEntity, VectorEntityDataWithIntegration } from '../types';

export const saveVectorToConfigAction = async ({ providerName, apiKey }: { providerName: string; apiKey: string }) => {
  const configPath = `${process.env.CONFIG_PATH}.ts`;

  if (!configPath) {
    throw new Error('Config path not set');
  }
  const configWriterService = new ConfigWriterService(configPath);
  const envFilePath = path.join(process.cwd(), '.env');
  const fileEnvService = new FileEnvService(envFilePath);
  const envKey = `${providerName.toUpperCase()}_API_KEY`;
  await fileEnvService.setEnvValue(envKey, apiKey);
  await configWriterService.updateVectorProvider({
    providerName: providerName.toUpperCase(),
    apiKey: envKey,
  });
};

export const checkVectorProviderExistsAction = async (
  providerName: string,
): Promise<{ exists: boolean; apiKey: string }> => {
  const configPath = `${process.env.CONFIG_PATH}.ts`;

  if (!configPath) {
    throw new Error('Config path not set');
  }

  const configWriterService = new ConfigWriterService(configPath);

  try {
    const exists = await configWriterService.checkIfVectorProviderExists(providerName.toUpperCase());

    const envFilePath = path.join(process.cwd(), '.env');
    const fileEnvService = new FileEnvService(envFilePath);

    const apiKey = await fileEnvService.getEnvValue(`${providerName.toUpperCase()}_API_KEY`);

    return { exists: exists && Boolean(apiKey), apiKey: apiKey! };
  } catch (error) {
    console.error(`Error checking if vector provider exists: ${error}`);
    return { exists: false, apiKey: '' };
  }
};

const tryParseErr = (strJson: string) => {
  try {
    return JSON.parse(strJson);
  } catch (err) {
    return {};
  }
};

//provider_sources_entities

type Response =
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      error: string;
    };

export const createPineconeIndex = async ({
  vectorEntities,
  syncInterval,
  integration,
  name,
}: {
  vectorEntities: VectorEntity[];
  syncInterval?: string;
  integration?: string;
  name: string;
}): Promise<Response> => {
  console.log('name====', { name });

  try {
    // create the index
    await framework?.vectorLayer.createPineconeIndex({ name });

    // get created index
    const newIndex = await framework?.vectorLayer.getPineconeIndex({ name });

    console.log('newIndex=====', { newIndex });
    let flattened: VectorEntityDataWithIntegration[] = [];

    vectorEntities.forEach(entity => {
      const _data = entity.data.map(d => ({ ...d, integration: entity.integration }));
      flattened.push(..._data);
    });

    //upsert metadata for each namespace(entity) in index
    for (const entity of flattened) {
      const values = await framework?.vectorLayer.generateVectorEmbedding(entity);
      await newIndex?.namespace(entity.name).upsert([{ id: name, metadata: entity, values }]);
    }

    console.log('====start sync===');

    const integrationName = integration || framework?.config.name;

    const eventData = {
      data: [
        {
          provider: 'PINECONE',
          indexes: [name],
        },
      ],
    };

    // start sync
    const sync = await framework?.triggerEvent({
      key: 'VECTOR_INDEX_SYNC',
      integrationName,
      data: eventData,
      user: {
        connectionId: 'SYSTEM',
      },
    });

    // subscribe to sync event
    const sub = await sync?.event.subscribe();

    //If syncInterval is provided, set up a cron job to sync the index
    if (syncInterval) {
      const cronRoute = framework?.routes.cron;

      const encodedParameters = Buffer.from(JSON.stringify(eventData)).toString('base64');
      const cronPath = `${cronRoute}?event=VECTOR_INDEX_SYNC&integrationName=${integrationName}&data=${encodedParameters}`;
      const cronSchedule = syncInterval;

      // write cron config to vercel json
      const vercelJson = new VercelJsonService();

      console.log('===writing cron config===');

      await vercelJson.writeCronConfig({
        cronPath,
        cronSchedule,
      });
    }

    console.log('===synced===');

    //refetch indexes in framework background task
    framework?.__backgroundTasks();

    return {
      ok: true,
      data: sub,
    };
  } catch (err) {
    console.log('Error creating index====', { err });

    let errMessage = 'Something went wrong creating the index, please try again';

    if ((err as any)?.message) {
      //err.message from pinecone is a stringified object
      const error = tryParseErr((err as any).message) as any;

      if (error?.error?.message) {
        errMessage = error?.error?.message;
      } else {
        errMessage = (err as any)?.message;
      }
    }

    console.log({ errMessage });

    return {
      ok: false,
      error: errMessage,
    };
  }
};

export const updatePineconeIndex = async ({
  id,
  vectorEntities,
  syncInterval,
  integration,
  indexName,
}: {
  id?: string;
  vectorEntities: VectorEntity[];
  syncInterval?: string;
  integration?: string;
  indexName: string;
}): Promise<Response> => {
  try {
    const index = await framework?.vectorLayer.getPineconeIndex({ name: indexName });

    if (!index) {
      return {
        ok: false,
        error: 'Index not found',
      };
    }

    let flattened: VectorEntityDataWithIntegration[] = [];

    vectorEntities.forEach(entity => {
      const _data = entity.data.map(d => ({ ...d, integration: entity.integration }));
      flattened.push(..._data);
    });

    //upsert metadata for each namespace(entity) in index
    for (const entity of flattened) {
      const values = await framework?.vectorLayer.generateVectorEmbedding(entity);
      await index?.namespace(entity.name).upsert([{ id: indexName, metadata: entity, values }]);
    }

    const integrationName = integration || framework?.config.name;

    const eventData = {
      data: [
        {
          provider: 'PINECONE',
          indexes: [indexName],
        },
      ],
    };

    // start sync
    const sync = await framework?.triggerEvent({
      key: 'VECTOR_INDEX_SYNC',
      integrationName,
      data: eventData,
      user: {
        connectionId: 'SYSTEM',
      },
    });

    // subscribe to sync event
    const sub = await sync?.event.subscribe();

    //If syncInterval is provided, set up a cron job to sync the index
    if (syncInterval) {
      const cronRoute = framework?.routes.cron;

      const encodedParameters = Buffer.from(JSON.stringify(eventData)).toString('base64');
      const cronPath = `${cronRoute}?event=VECTOR_INDEX_SYNC&integrationName=${integrationName}&data=${encodedParameters}`;
      const cronSchedule = syncInterval;

      // write cron config to vercel json
      const vercelJson = new VercelJsonService();

      await vercelJson.writeCronConfig({
        cronPath,
        cronSchedule,
      });
    }

    //refetch indexes in framework background task
    framework?.__backgroundTasks();

    return {
      ok: true,
      data: sub,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: (err as Error).message,
    };
  }
};
