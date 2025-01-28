import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createVectorQueryTool, embedMany, MDocument } from '@mastra/rag';
import { PgVector } from '@mastra/vector-pg';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  options: {
    provider: 'OPEN_AI',
    model: 'text-embedding-3-small',
    maxRetries: 3,
  },
  topK: 3,
  vectorFilterType: 'pg',
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions:
    'You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: { vectorQueryTool },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});
const agent = mastra.getAgent('ragAgent');

const doc = MDocument.fromText(`The Impact of Climate Change on Global Agriculture

Climate change poses significant challenges to global agriculture and food security. Rising temperatures, changing precipitation patterns, and increased frequency of extreme weather events are affecting crop yields worldwide.

Temperature Effects
Global warming has led to shifts in growing seasons and altered crop development cycles. Many regions are experiencing longer periods of drought, while others face excessive rainfall. These changes directly impact plant growth and development.

Crop Yield Impact
Studies show that major staple crops like wheat, rice, and maize are particularly vulnerable to temperature increases. For every degree Celsius increase in global mean temperature, wheat yields are expected to decrease by 6%.

Adaptation Strategies
Farmers are implementing various adaptation strategies:
1. Developing drought-resistant crop varieties
2. Adjusting planting dates to match new seasonal patterns
3. Implementing improved irrigation systems
4. Diversifying crop selections to reduce risk

Future Implications
The agricultural sector must continue to innovate and adapt to ensure food security for a growing global population. This includes developing new technologies, improving water management, and enhancing soil conservation practices.`);

const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
  separator: '\n',
  extract: {
    keywords: true,
  },
});

const { embeddings } = await embedMany(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-3-small',
  maxRetries: 3,
});

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex('embeddings', 1536);
await vectorStore.upsert(
  'embeddings',
  embeddings,
  chunks?.map((chunk: any, index: number) => ({
    text: chunk.text,
    ...chunk.metadata,
    nested: {
      keywords: chunk.metadata.excerptKeywords
        .replace('KEYWORDS:', '')
        .split(',')
        .map(k => k.trim()),
      id: index,
    },
  })),
);

async function generateResponse(query: string, filter: any) {
  const buildFilterString = (f: any): string => {
    if ('type' in f) {
      return `type:${f.type} condition with filters: [${f.filters.map(buildFilterString).join(', ')}]`;
    }
    return `keyword: ${f.keyword} operator: ${f.operator} value: ${f.value}`;
  };
  const filterDescription = buildFilterString(filter);
  const prompt = `
      Please answer the following question:
      ${query}

    Please base your answer only on the context provided in the tool using this filter:
    ${filterDescription}
    If the context doesn't contain enough information to fully answer the question, please state that explicitly.
      `;

  // Call the agent to generate a response
  const completion = await agent.generate(prompt);

  return completion.text;
}

async function answerQueries(
  queries: {
    query: string;
    filter: any;
  }[],
) {
  for (const { query, filter } of queries) {
    try {
      // Generate and log the response
      const answer = await generateResponse(query, filter);
      console.log('\nQuery:', query);
      console.log('Response:', answer);
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
}

const queries = [
  {
    query: 'What adaptation strategies are mentioned?',
    filter: {
      keyword: 'excerptKeywords',
      operator: 'ilike',
      value: `%adaptation%`,
    },
  },
  {
    query: 'Show me recent sections',
    filter: {
      keyword: 'nested.id',
      operator: 'gt',
      value: 2,
    },
  },
  {
    query: 'Find sections about drought and irrigation',
    filter: {
      type: '$and',
      filters: [
        {
          keyword: 'text',
          operator: 'ilike',
          value: '%drought%',
        },
        {
          keyword: 'text',
          operator: 'ilike',
          value: '%irrigation%',
        },
      ],
    },
  },
  {
    query: 'Find sections about wheat or rice',
    filter: {
      type: '$or',
      filters: [
        {
          keyword: 'text',
          operator: 'ilike',
          value: '%wheat%',
        },
        {
          keyword: 'text',
          operator: 'ilike',
          value: '%rice%',
        },
      ],
    },
  },
];

await answerQueries(queries);
