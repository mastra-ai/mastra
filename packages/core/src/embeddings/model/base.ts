import { embed, embedMany, EmbeddingModel } from 'ai';

import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';

export class MastraEmbedding extends MastraBase {
  model: EmbeddingModel<string>;
  constructor({ model }: { model: EmbeddingModel<string> }) {
    super({ component: RegisteredLogger.EMBEDDINGS, name: model.modelId });
    this.model = model;
  }

  async embed(value: string, { maxRetries }: { maxRetries?: number } = { maxRetries: 3 }) {
    return await embed({
      model: this.model,
      value,
      maxRetries,
    });
  }

  async embedMany(value: string[], { maxRetries }: { maxRetries?: number } = { maxRetries: 3 }) {
    return await embedMany({
      model: this.model,
      values: value,
      maxRetries,
    });
  }
}
