// Minimal reproduction of the TypeScript infinite loop issue
import { z } from 'zod';
import { createTool } from './src/tools';
import { createStep } from './src/workflows/workflow';

// This replicates the exact pattern that caused the infinite loop
const inputSchema = z.object({
  queryText: z.string(),
  topK: z.number().optional(),
  filter: z.record(z.any()).optional(),
});

const outputSchema = z.object({
  relevantContext: z.array(z.any()),
  sources: z.array(z.any()),
});

// Create tool exactly like createVectorQueryTool does
const vectorQueryTool = createTool({
  id: 'vector-query-tool',
  description: 'Vector query tool',
  inputSchema,
  outputSchema,
  execute: async ({ context, mastra, runtimeContext }) => {
    // This pattern matches createVectorQueryTool exactly
    const indexName: string = runtimeContext.get('indexName') ?? 'test';
    const vectorStoreName: string = runtimeContext.get('vectorStoreName') ?? 'test';
    const topK: number = runtimeContext.get('topK') ?? context.topK ?? 10;
    
    return {
      relevantContext: [`Mock result for: ${context.queryText}`],
      sources: ['mock-source-1'],
    };
  },
});

// This line should cause the infinite loop in the broken version
const step = createStep(vectorQueryTool);