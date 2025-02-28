import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { MDocument, createVectorQueryTool, createDocumentChunkerTool } from '@mastra/rag';
import { embedMany } from 'ai';

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
});

const cleanedVectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'cleanedEmbeddings',
  model: openai.embedding('text-embedding-3-small'),
});

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

const documentChunkerTool = createDocumentChunkerTool({
  doc,
  params: {
    strategy: 'recursive',
    size: 256,
    overlap: 50,
    separator: '\n',
  },
});

export const ragAgentOne = new Agent({
  name: 'RAG Agent One',
  instructions:
    'You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.',
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
  },
});

export const ragAgentTwo = new Agent({
  name: 'RAG Agent Two',
  instructions:
    'You are a helpful assistant that answers questions based on the provided context. Keep your answers concise and relevant.',
  model: openai('gpt-4o-mini'),
  tools: {
    cleanedVectorQueryTool,
  },
});

export const ragAgentThree = new Agent({
  name: 'RAG Agent Three',
  instructions: 'You are a helpful assistant that processes, cleans, and labels data before storage.',
  model: openai('gpt-4o-mini'),
  tools: { documentChunkerTool },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgentOne, ragAgentTwo, ragAgentThree },
  vectors: { pgVector },
});
const dataAgentOne = mastra.getAgent('ragAgentOne');
const dataAgentTwo = mastra.getAgent('ragAgentTwo');
const processAgent = mastra.getAgent('ragAgentThree');

// Set to 256 to get more chunks
const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 256,
  overlap: 50,
  separator: '\n',
});

const chunkPrompt = `Take the chunks returned from the tool and clean them up according to the instructions provided. Make sure to filter out irrelevant information that is not space related and remove duplicates.`;

const newChunks = await processAgent.generate(chunkPrompt);

const updatedDoc = MDocument.fromText(newChunks.text);

const updatedChunks = await updatedDoc.chunk({
  strategy: 'recursive',
  size: 256,
  overlap: 50,
  separator: '\n',
});

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map(chunk => chunk.text),
});

const { embeddings: cleanedEmbeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: updatedChunks.map(chunk => chunk.text),
});

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});
await vectorStore.createIndex({
  indexName: 'cleanedEmbeddings',
  dimension: 1536,
});
await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: embeddings,
  metadata: chunks?.map((chunk: any) => ({ text: chunk.text })),
});
await vectorStore.upsert({
  indexName: 'cleanedEmbeddings',
  vectors: cleanedEmbeddings,
  metadata: updatedChunks?.map((chunk: any) => ({ text: chunk.text })),
});

async function generateResponse(query: string, agent: Agent) {
  // Create a prompt that includes both context and query
  const prompt = `
      Please answer the following question:
      ${query}

      Please base your answer only on the context provided in the tool. If the context doesn't contain enough information to fully answer the question, please state that explicitly. 
      `;

  // Call the agent to generate a response
  const completion = await agent.generate(prompt);

  return completion.text;
}

async function answerQueries(queries: string[], agent: Agent) {
  for (const query of queries) {
    try {
      // Generate and log the response
      const answer = await generateResponse(query, agent);
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

await answerQueries(queries, dataAgentOne);

await answerQueries(queries, dataAgentTwo);
