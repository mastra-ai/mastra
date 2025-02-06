import { createVoyage } from 'voyage-ai-provider';

import { VoyageEmbeddingModelNames } from '../../types';
import { MastraEmbedding } from '../base';

export class VoyageAiEmbeddingModel extends MastraEmbedding {
  constructor({
    apiKey = process.env.VOYAGE_API_KEY || '',
    model,
    baseURL,
  }: {
    apiKey?: string;
    model: VoyageEmbeddingModelNames;
    baseURL?: string;
  }) {
    const voyage = createVoyage({
      baseURL,
      apiKey,
    });
    super({ model: voyage.textEmbeddingModel(model) });
  }
}
