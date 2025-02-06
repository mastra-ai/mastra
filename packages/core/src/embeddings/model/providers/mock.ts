import { MockEmbeddingModelV1 } from 'ai/test';

import { MastraEmbedding } from '../base';

export class MockEmbeddingProvider extends MastraEmbedding {
  constructor() {
    const model = new MockEmbeddingModelV1({
      doEmbed: () => Promise.resolve({ embeddings: [[1, 0]] }),
    });
    super({ model });
  }
}
