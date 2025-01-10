import { Mastra, Agent, EmbedManyResult, Step, Workflow } from '@mastra/core';
import { createVectorQueryTool, embed, MDocument, PgVector } from '@mastra/rag';
import { z } from 'zod';

export const ragWorkflow = new Workflow({
  name: 'rag-workflow',
  triggerSchema: z.object({
    query: z.string(),
  }),
});

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  options: {
    provider: 'OPEN_AI',
    model: 'text-embedding-ada-002',
    maxRetries: 3,
  },
  topK: 3,
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `You are a helpful assistant that answers questions based on the provided context.`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: {
    vectorQueryTool,
  },
});

// Define the workflow steps first
const analyzeContext = new Step({
  id: 'analyzeContext',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    initialAnalysis: z.string(),
  }),
  execute: async ({ context: { query }, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.agents?.ragAgent;

    const analysisPrompt = `${query} 1. First, carefully analyze the retrieved context chunks and identify key information.`;

    const analysis = await ragAgent?.generate(analysisPrompt);
    console.log(analysis?.text);
    return {
      initialAnalysis: analysis?.text ?? '',
    };
  },
});

const breakdownThoughts = new Step({
  id: 'breakdownThoughts',
  inputSchema: z.object({
    analysis: z.string(),
  }),
  outputSchema: z.object({
    breakdown: z.string(),
  }),
  execute: async ({ context: { analysis }, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.agents?.ragAgent;
    const connectionPrompt = `
      Based on the initial analysis: ${analysis}

      2. Break down your thinking process about how the retrieved information relates to the query.
    `;

    const connectionAnalysis = await ragAgent?.generate(connectionPrompt);
    console.log(connectionAnalysis?.text);
    return {
      breakdown: connectionAnalysis?.text ?? '',
    };
  },
});

const connectPieces = new Step({
  id: 'connectPieces',
  inputSchema: z.object({
    process: z.string(),
  }),
  outputSchema: z.object({
    connections: z.string(),
  }),
  execute: async ({ context: { process }, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.agents?.ragAgent;
    const connectionPrompt = `
        Based on the breakdown: ${process}

        3. Explain how you're connecting different pieces from the retrieved chunks.
    `;

    const connections = await ragAgent?.generate(connectionPrompt);
    console.log(connections?.text);
    return {
      connections: connections?.text ?? '',
    };
  },
});

const drawConclusions = new Step({
  id: 'drawConclusions',
  inputSchema: z.object({
    evidence: z.string(),
  }),
  outputSchema: z.object({
    conclusions: z.string(),
  }),
  execute: async ({ context: { evidence }, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.agents?.ragAgent;
    const conclusionPrompt = `
        Based on the connections: ${evidence}

        4. Draw conclusions based only on the evidence in the retrieved context.
    `;

    const conclusions = await ragAgent?.generate(conclusionPrompt);
    console.log(conclusions?.text);
    return {
      conclusions: conclusions?.text ?? '',
    };
  },
});

const finalAnswer = new Step({
  id: 'finalAnswer',
  inputSchema: z.object({
    conclusions: z.string(),
  }),
  outputSchema: z.object({
    finalAnswer: z.string(),
  }),
  execute: async ({ context: { conclusions }, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.agents?.ragAgent;
    const answerPrompt = `
        Based on the conclusions: ${conclusions}
        Format your response as:
        THOUGHT PROCESS:
        - Step 1: [Initial analysis of retrieved chunks]
        - Step 2: [Connections between chunks]
        - Step 3: [Reasoning based on chunks]

        FINAL ANSWER:
        [Your concise answer based on the retrieved context]`;

    const finalAnswer = await ragAgent?.generate(answerPrompt);
    console.log(finalAnswer?.text);
    return {
      finalAnswer: finalAnswer?.text ?? '',
    };
  },
});

// Create and configure the workflow
ragWorkflow
  .step(analyzeContext, {
    variables: {
      query: {
        step: 'trigger',
        path: 'query',
      },
    },
  })
  .then(breakdownThoughts, {
    variables: {
      analysis: {
        step: analyzeContext,
        path: 'initialAnalysis',
      },
    },
  })
  .then(connectPieces, {
    variables: {
      process: {
        step: breakdownThoughts,
        path: 'breakdown',
      },
    },
  })
  .then(drawConclusions, {
    variables: {
      evidence: {
        step: connectPieces,
        path: 'connections',
      },
    },
  })
  .then(finalAnswer, {
    variables: {
      conclusions: {
        step: drawConclusions,
        path: 'conclusions',
      },
    },
  });

ragWorkflow.commit();

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
  workflows: { ragWorkflow },
});

// Sample document remains unchanged
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

// Chunking and embedding logic remains unchanged
const chunks = await doc.chunk({
  strategy: 'recursive',
  size: 512,
  overlap: 50,
  separator: '\n',
});

const { embeddings } = (await embed(chunks, {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
  maxRetries: 3,
})) as EmbedManyResult<string>;

const vectorStore = mastra.getVector('pgVector');
await vectorStore.createIndex('embeddings', 1536);
await vectorStore.upsert(
  'embeddings',
  embeddings,
  chunks?.map((chunk: any) => ({ text: chunk.text })),
);

// Updated generateResponse function to use workflow
async function generateResponse(query: string) {
  const prompt = `
    Please answer the following question:
    ${query}

    Please base your answer only on the context provided in the tool. If the context doesn't contain enough information to fully answer the question, please state that explicitly.
    `;

  const workflowResult = await ragWorkflow.execute({
    triggerData: {
      query: prompt,
    },
  });

  return workflowResult;
}

const query = 'What are the main adaptation strategies for farmers?';

console.log('\nQuery:', query);
const result = await generateResponse(query);
console.log('\nThought Process:');
console.log(result.results);
