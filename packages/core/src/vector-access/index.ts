import { Pinecone } from '@pinecone-database/pinecone';

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
    return this.Pinecone.listIndexes();
  }
}
