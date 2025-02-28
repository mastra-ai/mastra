import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { embedMany } from 'ai';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `You are a helpful assistant that answers questions based on the provided context.
Follow these steps for each response:

1. First, carefully analyze the retrieved context chunks and identify key information.
2. Break down your thinking process about how the retrieved information relates to the query.
3. Explain how you're connecting different pieces from the retrieved chunks.
4. Draw conclusions based only on the evidence in the retrieved context.
5. If the retrieved chunks don't contain enough information, explicitly state what's missing.

Format your response as:
THOUGHT PROCESS:
- Step 1: [Initial analysis of retrieved chunks]
- Step 2: [Connections between chunks]
- Step 3: [Reasoning based on chunks]

FINAL ANSWER:
[Your concise answer based on the retrieved context]`,
  model: openai('gpt-4o-mini'),
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
});

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
  metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
});

async function generateResponse(query: string) {
  const prompt = `
    Please answer the following question using chain-of-thought reasoning:
    ${query}

    Please base your answer only on the context provided in the tool. If the context doesn't contain enough information to fully answer the question, please state that explicitly.
    Remember: Explain how you're using the retrieved information to reach your conclusions.
    `;

  const completion = await agent.generate(prompt);
  return completion.text;
}

async function answerQueries(queries: string[]) {
  for (const query of queries) {
    try {
      const answer = await generateResponse(query);
      console.log('\nQuery:', query);
      console.log('\nReasoning Chain + Retrieved Context Response:');
      console.log(answer);
      console.log('\n-------------------');
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
}

const queries = [
  'What are the main adaptation strategies for farmers?',
  'Analyze how temperature affects crop yields.',
  'What connections can you draw between climate change and food security?',
  'How are farmers implementing solutions to address climate challenges?',
  'What future implications are discussed for agriculture?',
];

await answerQueries(queries);
