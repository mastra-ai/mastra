import { Pinecone } from '@pinecone-database/pinecone';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { pick } from 'lodash';
import {
  getAgentBlueprint,
  getAgentDir,
  getAgentFile,
  listAgentsJson,
} from './utils';
import { Mastra } from '../framework';
import { readdirSync } from 'fs';
import path from 'path';
import { z } from 'zod';

function getVectorProvider(provider: string) {
  if (provider === 'PINECONE') {
    return new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
}

export async function executeVectorSync({ event, mastra }: any) {
  const agentDir = mastra.config.agents.agentDirPath;
  const agent = getAgentBlueprint({ agentDir, agentId: event.data.agentId });
  const connectionId = event?.user?.connectionId;
  const systemName = mastra.config.name;

  if (!agent.knowledge_sources.vector_provider) {
    console.error(`No vector_provider defined for agent`);
    return;
  }

  const vp = getVectorProvider(agent.knowledge_sources.vector_provider);

  if (!vp) {
    console.error(
      'UNSUPPORTED VECTOR PROVIDER',
      agent.knowledge_sources.vector_provider
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

            console.log(record, '###');

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

export function getVectorQueryApis({ mastra }: { mastra: Mastra }) {
  const agentDir = mastra.config.agents.agentDirPath;
  const agents = listAgentsJson({ agentDir });

  const agentData = agents
    .map((agentFile) => {
      const agentDirPath = getAgentDir({ agentDir });
      const agent = getAgentFile(path.join(agentDirPath, agentFile));
      if (!agent.knowledge_sources.vector_provider) {
        console.error(`No vector_provider defined for agent`);
        return;
      }
      return agent;
    })
    .filter(Boolean);

  return agentData
    .flatMap((agent) => {
      const entities = agent.knowledge_sources.entities as AgentEntities[];
      return entities.flatMap(({ data, integration }) => {
        return data.map((entity) => {
          return {
            integrationName: integration,
            type: `get_${entity.name}_from_vector_${entity.index}`,
            label: `Provides ${entity.name} information from Vector ${entity.index} Store`,
            description: `Provides ${entity.name} information from Vector ${entity.index} Store`,
            schema: z.object({
              content: z.string(),
              topResult: z.number().nullable()
            }),
            executor: async ({
              data,
            }: {
              data: { content?: string; topResult?: number };
            }) => {
              const res = await vectorQueryEngine({
                vector_provider: agent.knowledge_sources.vector_provider,
                indexName: entity.index,
                content: data.content!,
                topK: data.topResult || 1,
                entityType: entity.name,
              });
              console.log(JSON.stringify({ res }, null, 2));

              // @TODO: make this a proper response
              return res as any;
            },
          };
        });
      });
    })
    .filter(Boolean);
}

export function vectorSyncEvent() {
  return {
    // @TODO: naming convention
    id: 'vector-sync',
    event: 'VECTOR_SYNC',
    executor: executeVectorSync,
  };
}
