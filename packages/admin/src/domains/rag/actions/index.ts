'use server';

import path from 'path';

import { framework } from '@/lib/framework-utils';

import { ConfigWriterService } from '@/service/service.configWriter';
import { FileEnvService } from '@/service/service.fileEnv';

import { VectorEntity, VectorEntityDataWithIntegration, VectorIndex } from '../types';

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
    return { exists, apiKey: apiKey! };
  } catch (error) {
    console.error(`Error checking if vector provider exists: ${error}`);
    return { exists: false, apiKey: '' };
  }
};

//provider_sources_entities

export const createPineconeIndex = async ({
  provider,
  vectorEntities,
}: {
  provider: string;
  vectorEntities: VectorEntity[];
}): Promise<
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      error: string;
    }
> => {
  const sourcesName = vectorEntities
    ?.map(item => {
      // const entityNames = item.data.map(ent => ent.name)?.join('-');
      return `${item.integration}`;
    })
    ?.join('_');
  const today = new Date().getTime();
  const name = `${provider}-${sourcesName}-${today}`.toLowerCase();
  console.log('name====', { name });

  try {
    await framework?.vectorLayer.createPineconeIndex({ name });

    const newIndex = await framework?.vectorLayer.getPineconeIndex({ name });

    console.log('newIndex=====', { newIndex });
    let flattened: VectorEntityDataWithIntegration[] = [];

    vectorEntities.forEach(entity => {
      const _data = entity.data.map(d => ({ ...d, integration: entity.integration }));
      flattened.push(..._data);
    });

    for (const entity of flattened) {
      const values = await framework?.vectorLayer.generateVectorEmbedding(entity);
      newIndex?.namespace(entity.name).upsert([{ id: name, metadata: entity, values }]);
    }

    console.log('====start sync===');

    const sync = await framework?.triggerEvent({
      key: 'VECTOR_INDEX_SYNC',
      integrationName: framework.config?.name,
      data: {
        data: [
          {
            provider: 'PINECONE',
            indexes: [name],
          },
        ],
      },
      user: {
        connectionId: 'SYSTEM',
      },
    });

    const sub = await sync?.event.subscribe();

    console.log('===synced===');

    return {
      ok: true,
      data: sub,
    };
  } catch (err) {
    console.log('Error creating index====', { err });

    let errMessage = 'Something went wrong creating the index, please try again';

    if ((err as any)?.message) {
      //err.message from pinecone is a stringified object
      const error = JSON.parse((err as any).message) as any;

      if (error?.error?.message) {
        errMessage = error?.error?.message;
      }
    }

    console.log({ errMessage });

    return {
      ok: false,
      error: errMessage,
    };
  }
};

export const fetchPineconeIndexes = async () => {
  try {
    const response = await fetch('https://api.pinecone.io/indexes', {
      method: 'GET',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY!,
        'X-Pinecone-API-Version': 'unstable',
      },
      cache: 'no-store',
    });

    const { indexes } = (await response.json()) || {};

    return indexes as VectorIndex[];
  } catch (err) {
    console.log('Error fetching indexes using JS fetch====', err);
  }
};
