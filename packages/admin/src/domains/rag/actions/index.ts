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
}) => {
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

    return sub;
  } catch (err) {
    console.log('Error creating index====', err);
    // throw Error("Error creating index")
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

    console.log('fetch===', JSON.stringify(indexes, null, 2));

    return indexes as VectorIndex[];
  } catch (err) {
    console.log('Error fetching indexes using JS fetch====', err);
  }
};

export const getPineconeIndex = async (name: string) => {
  try {
    if (!name) {
      console.log('Index name not passed');
      return [];
    }
    const newIndex = await framework?.vectorLayer.getPineconeIndex({ name });
    const indexQuery = await newIndex?.describeIndexStats();
    if (indexQuery) {
      const namespaces = Object.keys(indexQuery?.namespaces || {});

      console.log('index====', JSON.stringify(indexQuery, null, 2));

      let data: VectorEntityDataWithIntegration[] = [];

      if (namespaces.length) {
        console.log(`namespaces===`, JSON.stringify(namespaces, null, 2));
        for (const namespace of namespaces) {
          const namespaceData = await newIndex?.namespace(namespace).fetch([name]);

          const metadata = namespaceData?.records?.[name]?.metadata;

          console.log(`metadata for ${namespace}===`, JSON.stringify(metadata, null, 2));

          if (metadata) {
            data.push(metadata as VectorEntityDataWithIntegration);
          }
        }
      }

      console.log(`data===`, JSON.stringify(data, null, 2));

      if (data.length) {
        const entities = data.reduce((acc, ent) => {
          const { integration, ...rest } = ent;
          const exists = acc?.some(a => a.integration === integration);

          if (exists) {
            return acc?.map(ac => {
              if (ac.integration === integration) {
                ac.data.push(rest);
              }

              return ac;
            });
          }

          return [...acc, { integration, data: [rest] }];
        }, [] as VectorEntity[]);

        console.log('Entities====', JSON.stringify(entities, null, 2));

        return entities;
      }
    }

    return [];
  } catch (err) {
    console.log(`Error getting ${name} index`, err);
  }
};
