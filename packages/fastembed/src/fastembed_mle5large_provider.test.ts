import { describe, expect, it } from 'vitest';
import { fastembed } from './index.js';

describe('multilingual e5 large through the v3 provider', () => {
  it('embeds queries and passages as 1024 dimensional vectors', async () => {
    const query = await fastembed.multilingualE5LargeQuery.doEmbed({ values: ['what is mastra?'] });
    const passage = await fastembed.multilingualE5LargePassage.doEmbed({ values: ['what is mastra?'] });

    expect(query.embeddings).toHaveLength(1);
    expect(query.embeddings[0]).toHaveLength(1024);
    expect(passage.embeddings[0]).toHaveLength(1024);
    // Same input, different roles => different vectors, proving the prefixes reach the model.
    expect(query.embeddings[0]).not.toEqual(passage.embeddings[0]);
  });

  it('embeds a mixed language batch', async () => {
    const { embeddings } = await fastembed.multilingualE5LargePassage.doEmbed({
      values: ['مرحبا بالعالم', 'hello world'],
    });

    expect(embeddings).toHaveLength(2);
    for (const embedding of embeddings) {
      expect(embedding).toHaveLength(1024);
    }
  });
});
