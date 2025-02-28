import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { PgVector } from '@mastra/pg';
import { MDocument, createGraphRAGTool } from '@mastra/rag';
import { embedMany } from 'ai';

const graphRagTool = createGraphRAGTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: openai.embedding('text-embedding-3-small'),
  graphOptions: {
    dimension: 1536,
    threshold: 0.7,
  },
});

export const ragAgent = new Agent({
  name: 'GraphRAG Agent',
  instructions: `You are a helpful assistant that answers questions based on the provided context. Format your answers as follows:

1. DIRECT FACTS: List only the directly stated facts from the text relevant to the question (2-3 bullet points)
2. CONNECTIONS MADE: List the relationships you found between different parts of the text (2-3 bullet points)
3. CONCLUSION: One sentence summary that ties everything together

Keep each section brief and focus on the most important points.`,
  model: openai('gpt-4o-mini'),
  tools: {
    graphRagTool,
  },
});

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});

const doc = MDocument.fromText(`
# Riverdale Heights: Community Development Study

## Historical Background
The central district of Riverdale Heights was established in 1932 around Thompson Steel Works. Italian immigrant Marco Rossi opened a small grocery store nearby, primarily serving factory workers. The original factory site was chosen due to its strategic location near both water and rail transport routes, setting the foundation for future transportation corridors.

## Transportation Development
The North-South rail line project began construction in 1973, promising improved regional connectivity. Initial surveys identified several historically significant areas along the proposed route, including some of the oldest sections of the Market District. Transit Authority records from this period note the technical challenges of maintaining existing community pathways while implementing modern rail infrastructure.

## Economic Shifts
The mid-1970s marked a period of significant business displacement in Riverdale Heights. The completion of major infrastructure projects led to the relocation of several longstanding establishments, including the historic Rossi's Market main location. By 2000, rising operational costs forced Thompson Steel Works to close its main facility. The Nakamura Investment Group purchased the abandoned factory complex in 2002, initially planning luxury condominiums.

## Cultural Changes
Community tensions peaked during the 1970s transportation expansion, with organized protests against the disruption of established neighborhood patterns. The Eastern District Art Collective, founded in 2005 by Maria Chen, began documenting these historical changes through temporary installations in abandoned storefronts. Their "Industrial Memories" project featured photographs of former steel workers' families, including several showing the Rossi family's grocery stores serving as community gathering spaces during various periods of social change.

## Environmental Initiatives
The River Restoration Project, launched in 2010, identified significant industrial contamination near the old Thompson Steel Works site. Historical records revealed that various infrastructure projects, including the early railway construction and subsequent expansions, had created artificial barriers affecting natural water flow patterns. Dr. James Thompson III, the project's lead scientist, recommended extensive soil rehabilitation and called for a comprehensive study of transportation infrastructure's long-term environmental impact.

## Urban Planning
The City Council's 2015 rezoning initiative designated the former industrial area as a mixed-use cultural district. The rezoning acknowledged the historical significance of various transportation corridors, including both rail lines and community pathways. The Nakamura Group's original development plans were modified to incorporate several historic walking trails that once connected the steel works to various Rossi's Market locations.

## Community Programs
The Thompson Foundation, established by the original steel company's heir, Sarah Thompson-Chen, focuses on youth education in environmental science. Their flagship program operates from a renovated Rossi's Market building, teaching students about urban ecology and sustainable development. The foundation's curriculum specifically examines how different phases of transportation development have shaped local environmental conditions.

## Local Business
The Night Market Initiative, started in 2020 by David Nakamura in partnership with local artists, transforms the former steel works parking lot into a weekly community event. Several vendors are graduates of the Thompson Foundation's small business program. The market's location was chosen specifically for its accessibility via both historic pedestrian routes and modern transit connections. One popular stall is run by Antonio Rossi, featuring recipes from his grandfather's original store.

## Infrastructure Development
Recent city planning documents reveal that the Metro Transit Authority is considering expanding the rail system's Eastern line. The proposed route would require demolishing several art collective spaces but would improve access to the Night Market area. Historical preservation advocates have noted that this expansion would affect some of the last remaining original market district structures from the pre-1975 period.

## Future Prospects
The Nakamura Group recently announced plans to fund a "Heritage Innovation Hub" in the remaining Thompson Steel Works buildings. This project aims to combine workspace for Art Collective members with environmental monitoring stations for the River Restoration Project. The design incorporates elements of the original Rossi's Market architecture, acknowledging its historical significance. The hub's location was chosen to maximize accessibility via both the existing rail network and traditional community pathways.
`);

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
        Please answer the following question using both semantic and graph-based context:
        ${query}

        Please base your answer only on the context provided in the tool. If the context doesn't contain enough information to fully answer the question, please state that explicitly.
        `;

  const completion = await ragAgent.generate(prompt);
  return completion.text;
}

async function answerQueries(queries: string[]) {
  for (const query of queries) {
    try {
      const answer = await generateResponse(query);
      console.log('\nQuery:', query);
      console.log('Response:', answer);
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
}

const queries = [
  "What are the direct and indirect effects of early railway decisions on Riverdale Heights' current state?",

  'How have changes in transportation infrastructure affected different generations of local businesses and community spaces?',

  'Compare how the Rossi family business and Thompson Steel Works responded to major infrastructure changes, and how their responses affected the community.',

  'Trace how the transformation of the Thompson Steel Works site has influenced surrounding businesses and cultural spaces from 1932 to present.',
];

await answerQueries(queries);
