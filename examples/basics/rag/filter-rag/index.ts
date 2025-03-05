import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool, MDocument, PGVECTOR_PROMPT } from '@mastra/rag';
import { embedMany } from 'ai';

const vectorQueryTool = createVectorQueryTool({
  id: 'vectorQueryTool',
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  enableFilter: true,
});

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

const chunkMetadata = chunks?.map((chunk: any, index: number) => ({
  text: chunk.text,
  ...chunk.metadata,
  nested: {
    keywords: chunk.metadata.excerptKeywords
      .replace('KEYWORDS:', '')
      .split(',')
      .map(k => k.trim()),
    id: index,
  },
}));

export const ragAgent = new Agent({
  name: 'RAG Agent',
  model: openai('gpt-4o-mini'),
  instructions: `
  You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.

  Filter the context by searching the metadata.
  
  The metadata is structured as follows:

  {
    text: string,
    excerptKeywords: string,
    nested: {
      keywords: string[],
      id: number,
    },
  }

  ${PGVECTOR_PROMPT}
  `,
  tools: { vectorQueryTool },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});

const agent = mastra.getAgent('ragAgent');
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});
await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
  metadata: chunkMetadata,
});

async function generateResponse(query: string) {
  const prompt = `
      Please answer the following question:
      ${query}

    Please base your answer only on the context provided.
    If the context doesn't contain enough information to fully answer the question, please state that explicitly.
      `;

  // Call the agent to generate a response
  const completion = await agent.generate(prompt);

  return completion.text;
}

const queries = [
  "What adaptation strategies are mentioned? Use regex to search for the word 'adaptation' in the 'nested.keywords' field.",
  "Show me recent sections. Check the 'nested.id' field and return values that are greater than 2.",
  "Search the 'text' field using regex operator to find sections containing 'temperature'.",
];

async function answerQueries() {
  for (const query of queries) {
    try {
      // Generate and log the response
      const answer = await generateResponse(query);
      console.log('\nQuery:', query);
      console.log('Response:', answer);
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
}

await answerQueries();
