import { Mastra, Agent, EmbedResult, EmbedManyResult, createTool } from '@mastra/core';
import { embed, MDocument, PgVector } from '@mastra/rag';
import { z } from 'zod';

export const contextTool = createTool({
  id: 'Use Context',
  inputSchema: z.object({
    queryText: z.string(),
    index: z.string(),
  }),
  outputSchema: z.object({
    context: z.string(),
  }),
  description: `Fetches the retrieved chunks from the vector store and combines them into a single context string`,
  execute: async ({ context: { queryText, index } }) => {
    const { embedding } = (await embed(queryText, {
      provider: 'OPEN_AI',
      model: 'text-embedding-ada-002',
      maxRetries: 3,
    })) as EmbedResult<string>;

    // Get relevant chunks from the vector database
    const results = await pgVector.query(index, embedding);
    const relevantChunks = results.map(result => result?.metadata?.text);
    console.log('Chunks used:', relevantChunks);

    // Combine the chunks into a context string
    const context = relevantChunks.join('\n\n');

    return {
      context,
    };
  },
});

export const chunkTool = createTool({
  id: 'Chunk Tool',
  inputSchema: z.object({}),
  description: `Does initial chunking and returns chunks`,
  execute: async () => {
    const chunks = await doc.chunk({
      strategy: 'recursive',
      size: 512,
      overlap: 50,
      separator: '\n',
    });

    return {
      chunks,
    };
  },
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions:
    'You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: { contextTool },
});

export const densityAgent = new Agent({
  name: 'Density Agent',
  instructions: 'You are a helpful assistant that processes, cleans, and labels data before storage.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: { chunkTool },
});

export const mastra = new Mastra({
  agents: { ragAgent, densityAgent },
});
const agentOne = mastra.getAgent('ragAgent');
const agentTwo = mastra.getAgent('densityAgent');

const doc =
  MDocument.fromText(`The Future of Space Exploration and Human Settlement in the Modern Era of Technology and Innovation

Space exploration represents a new frontier for human advancement and scientific discovery. 
Recent developments in reusable rocket technology, private space companies, and international cooperation are reshaping our approach to space travel. 
Did you know that the first astronomical observations were made by ancient Babylonians using stone tablets? 
Speaking of space travel, recent developments in reusable rockets are changing how we think about accessing space, as mentioned earlier.
The history of astronomy is fascinating, with ancient civilizations like the Maya developing complex celestial calendars.

Technological Advancements in the Modern Space Age
Modern spacecraft utilize advanced propulsion systems and sophisticated navigation equipment. 
The development of ion engines and solar sails is revolutionizing space travel capabilities. 
Speaking of propulsion, the invention of gunpowder in ancient China eventually led to the first rockets. 
As mentioned before, modern spacecraft are using cutting-edge technology for navigation and propulsion. 
The most expensive pen ever sold was worth $1.47 million, which is interesting but unrelated to space travel. 
Advanced propulsion systems, which we discussed earlier, are crucial for modern spacecraft. 
Did you know that Leonardo da Vinci drew designs for a flying machine? 
Ion engines, as previously stated, are revolutionizing how we think about space propulsion technology. The Wright brothers' first flight lasted only 12 seconds.

Mars Colonization Plans and Initiatives
Several organizations are developing plans for Mars colonization, with projected timelines spanning the next 20 years. 
Initial settlements will require advanced life support systems and radiation protection. 
The history of Mars observation dates back to ancient Egyptian astronomers. 
Life support systems, as previously stated, are crucial for Mars colonization. 
Did you know that the average temperature on Mars is -63°C? The first person to observe Mars through a telescope was Galileo Galilei in 1610. 
Speaking of Mars colonization, as mentioned before, radiation protection will be essential for settler survival. 
The Great Wall of China is not actually visible from space, contrary to popular belief. Life support systems and radiation protection, which we discussed earlier, will be fundamental to Mars settlement success. 
Mars has two moons, and the temperature there is -63°C, as we mentioned before.

Resource Utilization and Sustainability Practices
Future space settlements will need to implement:
1. In-situ resource utilization
2. Sustainable power generation
3. Closed-loop recycling systems
4. Agricultural facilities

The invention of hydroponics in the 1930s revolutionized plant growing techniques. 
Space settlements will need to utilize local resources and generate power sustainably, as mentioned above. 
The world's largest greenhouse is located in Dubai, which is fascinating but not relevant to space resource utilization. 
Speaking of resource utilization, settlers will need to implement in-situ resource gathering, as previously discussed. 
The first greenhouse was built in ancient Rome. Agricultural facilities, which we mentioned earlier, will be crucial for settlement survival. 
The longest-living tree is over 5,000 years old. Sustainable power generation, as stated before, will be essential for space colonies.

Long-term Implications and Future Prospects
The establishment of permanent space settlements could ensure humanity's survival as a multi-planetary species. This includes developing new technologies, establishing space-based economies, and creating self-sustaining habitats. 
Some people believe aliens built the pyramids, but scientists disagree. Space settlements, as previously discussed, will need sustainable systems.
The first commercial space station is planned for 2030. Creating self-sustaining habitats, which we mentioned earlier, is crucial for long-term space settlement. 
The longest continuous human presence in space has been on the International Space Station, which has been continuously occupied since 2000. Speaking of space settlements, they will need to be self-sustaining, as mentioned before. 
The first submarine was invented in 1620. Space-based economies, which we discussed earlier, will be important for settlement sustainability. 
The Empire State Building was built in just 410 days. Multi-planetary species survival, as previously stated, is a key goal of space settlement. Did you know that the first pizza was made in Naples, Italy?
`);

// Set to 256 to get more chunks
const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 256,
  overlap: 50,
  separator: '\n',
});

console.log(chunks.length);

const chunkPrompt = `Take the chunks returned from the tool and clean them up according to the instructions provided. Make sure to filter out irrelevant information that is not space related and remove duplicates.`;

const newChunks = await agentTwo.generate(chunkPrompt);

const updatedDoc = MDocument.fromText(newChunks.text);

const updatedChunks = await updatedDoc.chunk({
  strategy: 'recursive',
  size: 256,
  overlap: 50,
  separator: '\n',
});

console.log(updatedChunks.length);

const { embeddings } = (await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
})) as EmbedManyResult<string>;

const { embeddings: cleanedEmbeddings } = (await embed(updatedChunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
})) as EmbedManyResult<string>;

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);
await pgVector.createIndex('embeddings', 1536);
await pgVector.createIndex('cleanedEmbeddings', 1536);
await pgVector.upsert(
  'embeddings',
  embeddings,
  chunks?.map((chunk: any) => ({ text: chunk.text })),
);
await pgVector.upsert(
  'cleanedEmbeddings',
  cleanedEmbeddings,
  updatedChunks?.map((chunk: any) => ({ text: chunk.text })),
);

async function generateResponse(query: string, index: string) {
  // Create a prompt that includes both context and query
  const prompt = `
      Please answer the following question:
      ${query}

      Please base your answer only on the context provided in the tool with this index ${index}. If the context doesn't contain enough information to fully answer the question, please state that explicitly. 
      `;

  // Call the agent to generate a response
  const completion = await agentOne.generate(prompt);

  return completion.text;
}

// Example with multiple queries and error handling
async function answerQueries(queries: string[], index: string) {
  for (const query of queries) {
    try {
      // Generate and log the response
      const answer = await generateResponse(query, index);
      console.log('\nQuery:', query);
      console.log('Response:', answer);
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
}

const queries = [
  'What is the average temperature on Mars?',
  'What technologies are used in modern spacecraft?',
  'What are all the requirements for space settlements?',
  'What are all the dates mentioned related to space stations?',
  'What are all the mentions of sustainability in space settlements?',
];

// Compare responses between raw and cleaned embeddings
await answerQueries(queries, 'embeddings');
await answerQueries(queries, 'cleanedEmbeddings');
