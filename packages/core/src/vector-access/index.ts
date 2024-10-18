import { openai } from '@ai-sdk/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { embed } from 'ai';
import { VectorEntityData } from './types';
import {
  fetchPineconeIndexStats,
  fetchPineconeRecordByNamespaceAndId,
  fetchPineconedIndexByName,
} from '../agents';

export class VectorLayer {
  supportedProviders = ['PINECONE'];

  get Pinecone() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('Pinecone API key not found');
    }
    return new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }

  async getPineconeIndexes() {
    try {
      const inn = await this.Pinecone.listIndexes();
      console.log('inn====', { inn });
      return inn;
    } catch (err) {
      console.log('error getting indexesss====', err);
    }
  }

  async createPineconeIndex({ name }: { name: string }) {
    return this.Pinecone.createIndex({
      suppressConflicts: true,
      name,
      dimension: 1536,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });
  }

  async getPineconeIndex({ name }: { name: string }) {
    return this.Pinecone.index(name);
  }

  async generateVectorEmbedding(data: any) {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: JSON.stringify(data),
    });

    return embedding as any;
  }

  async getPineconeIndexWithMetadata({ name }: { name: string }) {
    try {
      if (!name) {
        console.log('Index name not passed');
        return [];
      }
      const newIndex = await fetchPineconedIndexByName(name);

      const indexQuery = await fetchPineconeIndexStats(newIndex?.host!);

      console.log({
        indexQuery,
      });

      if (indexQuery) {
        const namespaces = Object.keys(indexQuery?.namespaces || {});

        console.log({
          namespaces,
        });

        let data: VectorEntityData[] = [];

        if (namespaces.length) {
          for (const namespace of namespaces) {
            const namespaceData = await fetchPineconeRecordByNamespaceAndId({
              host: newIndex?.host!,
              namespace,
              id: name,
            });

            const metadata = namespaceData?.records?.[name]?.metadata;

            console.log(
              `metadata for ${namespace}===`,
              JSON.stringify(metadata, null, 2)
            );

            if (metadata) {
              data.push(metadata as VectorEntityData);
            }
          }
        }
        return data;
      }

      return [];
    } catch (err) {
      console.log(`Error getting ${name} index`, err);
    }
  }
}
