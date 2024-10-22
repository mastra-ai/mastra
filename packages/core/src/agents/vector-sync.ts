import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { embed } from 'ai';
import { mapValues, pick } from 'lodash';
import { getAgentBlueprint, getPineconeConfig, retryFn } from './utils';
import { Mastra } from '../framework';
import { VectorLayer } from '../vector-access';
import { IntegrationApi } from '../types';

function getVectorProvider(provider: string) {
  if (provider.toUpperCase() === 'PINECONE') {
    const { Pinecone } = new VectorLayer();
    return Pinecone;
  }
}

interface AgentEntities {
  integration: string;
  data: AgentKnowledgeEntity[];
}

interface AgentKnowledgeEntity {
  name: string;
  fields: string[];
  syncEvent: string;
  syncParams: string;
  index: string;
}

// base index sync from knowledge source
const indexSync = async ({
  knowledgeSource,
  mastra,
  connectionId,
}: {
  knowledgeSource: { provider: string; indexes: string[] }[];
  mastra: Mastra;
  connectionId: string;
}) => {
  for (const { provider, indexes } of knowledgeSource) {
    const vp = getVectorProvider(provider);

    if (!vp) {
      console.error('UNSUPPORTED VECTOR PROVIDER', provider);
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('NO OPENAI_API_KEY');
      return;
    }

    for (const index of indexes) {
      const getPineconeIndexWithMetadata = async () => {
        try {
          const res = await mastra.vectorLayer.getPineconeIndexWithMetadata({
            name: index,
          });
          if (!res?.length) {
            throw new Error('No index metadata found');
          }
          return res;
        } catch (e: any) {
          throw new Error(e);
        }
      };

      const indexMetadata = await retryFn<any>(getPineconeIndexWithMetadata);

      if (!indexMetadata?.length) {
        console.error('No index metadata found for', index);
        return;
      }

      for (const entity of indexMetadata) {
        const { fields, integration, name, syncEvent, syncParams } = entity;

        let k_id =
          (
            await mastra.dataLayer?.getConnection({
              connectionId,
              name: integration,
            })
          )?.id || '';

        if (!k_id && integration === mastra.config.name) {
          const connection = await mastra.dataLayer?.createConnection({
            connection: {
              connectionId,
              name: integration,
            },
            credential: {
              type: 'API_KEY',
              value: connectionId,
              scope: [],
            },
          });

          k_id = connection.id;
        }

        if (!k_id) {
          console.error('Error bootstrapping shit');
          return;
        }

        let entityRecords =
          await mastra.dataLayer?.getEntityRecordsByConnectionAndType({
            k_id,
            type: name.toUpperCase(),
          });

        let records = entityRecords?.records;

        if (!records || records?.length === 0) {
          console.error('NO RECORDS ATTEMPTING SYNC');

          const data = JSON.parse(
            Buffer.from(syncParams, 'base64').toString()
          ) as Record<string, any>;

          const { event } = await mastra.triggerEvent({
            key: syncEvent,
            data,
            user: {
              connectionId,
            },
          });

          console.log(event, '####');

          const res = await event.subscribe();

          console.log('Subscribe result', res);

          entityRecords =
            await mastra.dataLayer?.getEntityRecordsByConnectionAndType({
              k_id,
              type: entity.name.toUpperCase(),
            });

          records = entityRecords?.records;

          if (!records || records?.length === 0) {
            console.error('NO RECORDS AFTER SYNC');
            return;
          }
        }

        const recordsMapped = records.map(({ data, externalId }: any) => {
          const pickedData = pick(data, fields);

          const stringifiedData = mapValues(pickedData, String);

          return { id: String(externalId), ...stringifiedData };
        });

        console.log(recordsMapped, 'RECORDS');

        const entityTypeIndex = vp.index(index);

        console.log(entityTypeIndex, 'INDEX');

        try {
          //@TODO: PMAP THIS BITCH
          // ADD RETRIES
          const vectors = await Promise.all(
            recordsMapped.map(async (record: Record<string, any>) => {
              const { embedding } = await embed({
                model: openai.embedding('text-embedding-3-small'),
                value: JSON.stringify(record),
              });

              return {
                id: record.id,
                values: embedding,
                metadata: record,
              };
            }) ?? []
          );

          console.log('UPSERTING', vectors);

          if (vectors.length > 0) {
            await entityTypeIndex.namespace(name).upsert(vectors);
          }
        } catch (e) {
          console.error(e);
        }

        return;
      }
    }
  }
};

// vector index sync
export async function executeIndexSync({ event, mastra }: any) {
  const connectionId = event?.user?.connectionId;
  const providedIndexes = event?.data?.data as {
    provider: string;
    indexes: string[];
  }[];

  return await indexSync({
    connectionId,
    knowledgeSource: providedIndexes,
    mastra,
  });
}

//Generic vector sync from event data
export async function executeGenericVectorSync({ event, mastra }: any) {
  const connectionId = event?.user?.connectionId;
  const entities = event?.data?.entities;

  return await indexSync({
    connectionId,
    knowledgeSource: entities,
    mastra,
  });
}

// Vector Sync from agents Dir
export async function executeVectorSync({ event, mastra }: any) {
  const agentDir = mastra.config.agents.agentDirPath;
  const agent = getAgentBlueprint({ agentDir, agentId: event.data.agentId });
  const connectionId = event?.user?.connectionId;

  return await indexSync({
    connectionId,
    knowledgeSource: agent?.knowledge_sources,
    mastra,
  });
}

export async function vectorQueryEngine({
  vector_provider,
  topK = 1,
  indexName,
  content,
  entityType,
}: {
  vector_provider: string;
  indexName: string;
  content: string;
  entityType: string;
  topK?: number;
}) {
  const vp = getVectorProvider(vector_provider);

  if (!vp) {
    console.error('UNSUPPORTED VECTOR PROVIDER', vector_provider);
    return;
  }

  const index = vp.index(indexName);

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: content,
  });

  console.log(embedding, 'EMBEDDING');

  const queryResponse = await index.namespace(entityType).query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return queryResponse;
}

export interface VectorIndex {
  name: string;
  host: string;
  metric: string;
  dimension: number;
  namespaces?: string[];
}

export interface VectorStats {
  namespaces: Record<string, { vectorCount: number }>;
}

export const getPineconeIndices = async () => {
  const vectorLayer = new VectorLayer();
  const indexes = await vectorLayer.fetchPineconeIndexes();

  if (indexes && indexes?.length > 0) {
    const indexesWithStats = await Promise.all(
      indexes.map(async (index) => {
        const stats = await vectorLayer.fetchPineconeIndexStats(index.host);
        let namespaces: string[] = [];

        if (stats?.namespaces) {
          namespaces = Object.keys(stats.namespaces);
        }

        return {
          ...index,
          namespaces,
        };
      })
    );

    return indexesWithStats as VectorIndex[];
  }

  return [];
};

export function getVectorQueryApis({
  mastra,
}: {
  mastra: Mastra;
}): IntegrationApi[] {
  const vectorProvider = mastra.config.agents.vectorProvider;

  if (!vectorProvider) {
    console.error('NO VECTOR PROVIDER');
    return [];
  }

  const vectorApis: IntegrationApi[] = [];

  for (const provider of vectorProvider) {
    if (provider.name.toUpperCase() === 'PINECONE') {
      const config = getPineconeConfig({
        dir: provider.dirPath!,
      }) as VectorIndex[];

      if (!config || config?.length === 0) {
        return [];
      }

      config?.forEach((index) => {
        if (index?.namespaces) {
          index?.namespaces.forEach((namespace) => {
            vectorApis.push({
              integrationName: mastra.config.name,
              type: `vq_${index.name}_${namespace}`,
              label: `Provides query tool for ${index.name} index in ${namespace} namespace`,
              description: `Provides query tool for ${index.name} index in ${namespace} namespace`,
              schema: z.object({
                content: z.string(),
                topResult: z.number(),
              }),
              source: provider.name.toUpperCase(),
              executor: async ({
                data,
              }: {
                data: { content?: string; topResult?: number };
              }) => {
                const res = await vectorQueryEngine({
                  vector_provider: provider.name,
                  indexName: index.name,
                  content: data.content!,
                  topK: data.topResult || 1,
                  entityType: namespace,
                });

                console.log(JSON.stringify({ res }, null, 2));

                // @TODO: make this a proper response
                return res as any;
              },
            });
          });
        }
      });
    }
  }

  return vectorApis;
}

export function agentVectorSyncEvent() {
  return {
    // @TODO: naming convention
    id: 'agent-vector-sync',
    event: 'AGENT_VECTOR_SYNC',
    executor: executeVectorSync,
  };
}

export function genericVectorySyncEvent() {
  return {
    // @TODO: naming convention
    id: 'vector-sync',
    event: 'VECTOR_SYNC',
    executor: executeGenericVectorSync,
  };
}

export function vectorIndexSync() {
  return {
    id: 'vector-index-sync',
    event: 'VECTOR_INDEX_SYNC',
    executor: executeIndexSync,
  };
}
