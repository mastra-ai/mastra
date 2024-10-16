import { openai } from '@ai-sdk/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { embed } from 'ai';

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
}
