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
Did you know that the average temperature on Mars is -63°C? 
Speaking of Mars colonization, as mentioned before, radiation protection will be essential for settler survival. 
The Great Wall of China is not actually visible from space, contrary to popular belief.

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
    size: 512,
    overlap: 25,
    separator: '\n',
  },
});

const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `You are a helpful assistant that handles both querying and cleaning documents.
    When cleaning: Process, clean, and label data, remove irrelevant information and deduplicate content while preserving key facts.
    When querying: Provide answers based on the available context. Keep your answers concise and relevant.
    
    Important: When asked to answer a question, please base your answer only on the context provided in the tool. If the context doesn't contain enough information to fully answer the question, please state that explicitly.
    `,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
    documentChunkerTool,
  },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});
const agent = mastra.getAgent('ragAgent');

// Set to 256 to get more chunks
const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 256,
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

// Generate response using the original embeddings
const query = 'What are all the technologies mentioned for space exploration?';
const originalResponse = await agent.generate(query);
console.log('\nQuery:', query);
console.log('Response:', originalResponse.text);

const chunkPrompt = `Use the tool provided to clean the chunks. Make sure to filter out irrelevant information that is not space related and remove duplicates.`;

const newChunks = await agent.generate(chunkPrompt);

const updatedDoc = MDocument.fromText(newChunks.text);

const updatedChunks = await updatedDoc.chunk({
  strategy: 'recursive',
  size: 256,
  overlap: 50,
  separator: '\n',
});

const { embeddings: cleanedEmbeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: updatedChunks.map(chunk => chunk.text),
});
await vectorStore.deleteIndex('embeddings');
await vectorStore.createIndex({
  indexName: 'embeddings',
  dimension: 1536,
});

await vectorStore.upsert({
  indexName: 'embeddings',
  vectors: cleanedEmbeddings,
  metadata: updatedChunks?.map((chunk: any) => ({ text: chunk.text })),
});

// Generate response using the cleaned embeddings using the same query
const cleanedResponse = await agent.generate(query);
console.log('\nQuery:', query);
console.log('Response:', cleanedResponse.text);
