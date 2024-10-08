import { Pinecone } from '@pinecone-database/pinecone';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai'
import { pick } from 'lodash';

export async function executeVectorSync({ mastra, agent, connectionId, systemName }: any) {
    if (!process.env.OPENAI_API_KEY) {
        console.error('NO OPENAI_API_KEY')
        return
    }

    if (!agent || !agent?.knowledge_sources) {
        console.error('NO AGENT OR KNOWLEDGE SOURCES')
        return
    }

    const vectorProvider = agent.knowledge_sources.vector_provider

    if (vectorProvider !== 'PINECONE') {
        console.error('UNSUPPORTED VECTOR PROVIDER', vectorProvider)
        // @TODO: SUPPORT MORE SHIT
        return
    }

    const pc = new Pinecone({ apiKey: '174d0e8c-21da-4b88-9244-66f34a71eb53' });

    for (const vectorE of agent.knowledge_sources.entities) {
        const integrationName = vectorE.integration

        console.log(integrationName, 'INTEGRATION')

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
                    scope: []
                },
            })

            k_id = connection.id
        }

        if (!k_id) {
            console.error('Error bootstrapping shit')
            return
        }

        for (const entity of vectorE.data) {
            let entityRecords = await mastra.dataLayer?.getEntityRecordsByConnectionAndType({
                k_id,
                type: entity.name,
            });

            let records = entityRecords?.records

            if (!records || records?.length === 0) {
                // @TODO: SYNC THEM
                console.error('NO RECORDS')

                const { event } = await mastra.triggerEvent({
                    key: entity.syncEvent,
                    data: {},
                    user: {
                        connectionId,
                    }
                })

                console.log(event, '####')

                const res = await event.subscribe()

                console.log('Subscribe result', res)

                entityRecords = await mastra.dataLayer?.getEntityRecordsByConnectionAndType({
                    k_id,
                    type: entity.name,
                });

                records = entityRecords?.records

                if (!records || records?.length === 0) {
                    console.error('NO RECORDS AFTER SYNC')
                    return
                }
            }

            const recordsMapped = records.map(({ data, externalId }: any) => {
                return { id: externalId, ...pick(data, entity.fields) }
            })

            console.log(recordsMapped, 'RECORDS')

            await pc.createIndex({
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

            const entityTypeIndex = pc.index(entity.name);

            console.log(entityTypeIndex, 'INDEX')

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
                        };
                    }) ?? [],
                );
    
                if (vectors.length > 0) {
                    await entityTypeIndex.namespace(entity.type).upsert(vectors);
                }
            } catch (e) {
                console.error(e)
            }

            return
        }
    }
}
