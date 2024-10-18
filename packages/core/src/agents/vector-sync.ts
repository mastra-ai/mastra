import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { embed } from 'ai';
import { pick, set } from 'lodash';
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function executeIndexSync({ event, mastra }: any) {
  const connectionId = event?.user?.connectionId;
  const providedIndexes = event?.data?.data as {
    provider: string;
    indexes: string[];
  }[];
  const systemName = mastra.config.name;

  for (const { provider, indexes } of providedIndexes) {
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
          if (!res.length) {
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
        const { fields, integration, name, syncEvent } = entity;

        let k_id =
          (
            await mastra.dataLayer?.getConnection({
              connectionId,
              name: integration,
            })
          )?.id || '';

        if (!k_id && integration === systemName) {
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
            type: name,
          });

        let records = entityRecords?.records;

        if (!records || records?.length === 0) {
          console.error('NO RECORDS ATTEMPTING SYNC');

          const { event } = await mastra.triggerEvent({
            key: syncEvent,
            data: {},
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
              type: entity.name,
            });

          records = entityRecords?.records;

          if (!records || records?.length === 0) {
            console.error('NO RECORDS AFTER SYNC');
            return;
          }
        }

        const recordsMapped = records.map(({ data, externalId }: any) => {
          return { id: externalId, ...pick(data, fields) };
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
}

//Generic vector sync from event data
export async function executeGenericVectorSync({ event, mastra }: any) {
  const connectionId = event?.user?.connectionId;
  const vector_provider = event?.data?.vector_provider;
  const entities = event?.data?.entities;
  const systemName = mastra.config.name;

  if (!vector_provider) {
    console.error(`No vector_provider defined for agent`);
    return;
  }

  const vp = getVectorProvider(vector_provider);

  if (!vp) {
    console.error('UNSUPPORTED VECTOR PROVIDER', vector_provider);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('NO OPENAI_API_KEY');
    return;
  }

  for (const vectorE of entities) {
    const integrationName = vectorE.integration;

    let k_id =
      (
        await mastra.dataLayer?.getConnection({
          connectionId,
          name: integrationName,
        })
      )?.id || '';

    if (!k_id && integrationName === systemName) {
      const connection = await mastra.dataLayer?.createConnection({
        connection: {
          connectionId,
          name: integrationName,
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

    for (const entity of vectorE.data) {
      let entityRecords =
        await mastra.dataLayer?.getEntityRecordsByConnectionAndType({
          k_id,
          type: entity.name,
        });

      let records = entityRecords?.records;

      if (!records || records?.length === 0) {
        // @TODO: SYNC THEM
        console.error('NO RECORDS');

        const { event } = await mastra.triggerEvent({
          key: entity.syncEvent,
          data: {},
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
            type: entity.name,
          });

        records = entityRecords?.records;

        if (!records || records?.length === 0) {
          console.error('NO RECORDS AFTER SYNC');
          return;
        }
      }

      const recordsMapped = records.map(({ data, externalId }: any) => {
        return { id: externalId, ...pick(data, entity.fields) };
      });

      console.log(recordsMapped, 'RECORDS');

      await vp.createIndex({
        suppressConflicts: true,
        name: entity.name,
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      await delay(5000);

      const entityTypeIndex = vp.index(entity.name);

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
          await entityTypeIndex.namespace(entity.name).upsert(vectors);
        }
      } catch (e) {
        console.error(e);
      }

      return;
    }
  }
}

// Vector Sync from agents Dir
export async function executeVectorSync({ event, mastra }: any) {
  const agentDir = mastra.config.agents.agentDirPath;
  const agent = getAgentBlueprint({ agentDir, agentId: event.data.agentId });
  const connectionId = event?.user?.connectionId;
  const systemName = mastra.config.name;

  if (!agent.knowledge_sources.vector_provider) {
    console.error(`No vector_provider defined for agent`);
    return;
  }

  const vp = getVectorProvider(agent?.knowledge_sources?.vector_provider);

  if (!vp) {
    console.error(
      'UNSUPPORTED VECTOR PROVIDER',
      agent?.knowledge_sources?.vector_provider
    );
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('NO OPENAI_API_KEY');
    return;
  }

  if (!agent || !agent?.knowledge_sources) {
    console.error('NO AGENT OR KNOWLEDGE SOURCES');
    return;
  }

  for (const vectorE of agent.knowledge_sources.entities) {
    const integrationName = vectorE.integration;

    let k_id =
      (
        await mastra.dataLayer?.getConnection({
          connectionId,
          name: integrationName,
        })
      )?.id || '';

    if (!k_id && integrationName === systemName) {
      const connection = await mastra.dataLayer?.createConnection({
        connection: {
          connectionId,
          name: integrationName,
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

    for (const entity of vectorE.data) {
      let entityRecords =
        await mastra.dataLayer?.getEntityRecordsByConnectionAndType({
          k_id,
          type: entity.name,
        });

      let records = entityRecords?.records;

      if (!records || records?.length === 0) {
        // @TODO: SYNC THEM
        console.error('NO RECORDS');

        const { event } = await mastra.triggerEvent({
          key: entity.syncEvent,
          data: {},
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
            type: entity.name,
          });

        records = entityRecords?.records;

        if (!records || records?.length === 0) {
          console.error('NO RECORDS AFTER SYNC');
          return;
        }
      }

      const recordsMapped = records.map(({ data, externalId }: any) => {
        return { id: externalId, ...pick(data, entity.fields) };
      });

      console.log(recordsMapped, 'RECORDS');

      await vp.createIndex({
        suppressConflicts: true,
        name: entity.name,
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      const entityTypeIndex = vp.index(entity.name);

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
          await entityTypeIndex.namespace(entity.name).upsert(vectors);
        }
      } catch (e) {
        console.error(e);
      }

      return;
    }
  }
}

//@TODO MAKE TYPES FOR THE AGENT JSON

interface AgentEntities {
  integration: string;
  data: AgentKnowledgeEntity[];
}

interface AgentKnowledgeEntity {
  name: string;
  fields: string[];
  syncEvent: string;
  index: string;
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

      config.forEach((index) => {
        if (index?.namespaces) {
          index?.namespaces.forEach((namespace) => {
            vectorApis.push({
              integrationName: mastra.config.name,
              type: `vector_query_${index.name}_${namespace}`,
              label: `Provides query tool for ${index.name} index in ${namespace} namespace`,
              description: `Provides query tool for ${index.name} index in ${namespace} namespace`,
              schema: z.object({
                content: z.string(),
                topResult: z.number(),
              }),
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
