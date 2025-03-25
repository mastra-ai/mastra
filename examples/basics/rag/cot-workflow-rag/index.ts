import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Step, Workflow } from '@mastra/core/workflows';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
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
  model: openai.embedding('text-embedding-3-small'),
});

export const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `You are a helpful assistant that answers questions based on the provided context.`,
  model: openai('gpt-4o-mini'),
  tools: {
    vectorQueryTool,
  },
});

// Define the workflow steps first
const analyzeContext = new Step({
  id: 'analyzeContext',
  outputSchema: z.object({
    initialAnalysis: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const query = context?.getStepResult<{ query: string }>('trigger')?.query;

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
  outputSchema: z.object({
    breakdown: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const analysis = context?.getStepResult<{ initialAnalysis: string }>('analyzeContext')?.initialAnalysis;

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
  outputSchema: z.object({
    connections: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const process = context?.getStepResult<{ breakdown: string }>('breakdownThoughts')?.breakdown;
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
  outputSchema: z.object({
    conclusions: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const evidence = context?.getStepResult<{ connections: string }>('connectPieces')?.connections;
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
  outputSchema: z.object({
    finalAnswer: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    console.log('---------------------------');
    const ragAgent = mastra?.getAgent('ragAgent');
    const conclusions = context?.getStepResult<{ conclusions: string }>('drawConclusions')?.conclusions;
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
ragWorkflow.step(analyzeContext).then(breakdownThoughts).then(connectPieces).then(drawConclusions).then(finalAnswer);

ragWorkflow.commit();

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
  workflows: { ragWorkflow },
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

const query = 'What are the main adaptation strategies for farmers?';

console.log('\nQuery:', query);
const prompt = `
    Please answer the following question:
    ${query}

    Please base your answer only on the context provided in the tool. If the context doesn't contain enough information to fully answer the question, please state that explicitly.
    `;

const { runId, start } = ragWorkflow.createRun();

console.log('Run:', runId);

const workflowResult = await start({
  triggerData: {
    query: prompt,
  },
});
console.log('\nThought Process:');
console.log(workflowResult.results);
