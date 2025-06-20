import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '../tools';
import { createStep, createWorkflow } from './workflow';

describe('Integration Regression Tests', () => {
  it('should handle the exact user scenario that caused infinite loop', () => {
    // Replicate the exact scenario the user reported
    
    // Mock createVectorQueryTool behavior (without the workaround type assertion)
    const createMockVectorQueryTool = (options: {
      id?: string;
      description?: string;
      indexName: string;
      vectorStoreName: string;
      model: any;
      enableFilter?: boolean;
    }) => {
      const { id, description, indexName, vectorStoreName, enableFilter } = options;
      const toolId = id || `VectorQuery ${vectorStoreName} ${indexName} Tool`;
      const toolDescription = description || "Mock vector query tool";
      
      const inputSchema = z.object({
        queryText: z.string(),
        topK: z.number().optional(),
        filter: enableFilter ? z.record(z.any()).optional() : z.undefined().optional(),
      });
      
      const outputSchema = z.object({
        relevantContext: z.array(z.any()),
        sources: z.array(z.any()),
      });

      // Return the tool WITHOUT the type assertion workaround
      // This is what would cause the infinite loop in the broken version
      return createTool({
        id: toolId,
        description: toolDescription,
        inputSchema,
        outputSchema,
        execute: async ({ context }) => {
          return {
            relevantContext: [`Mock result for: ${context.queryText}`],
            sources: ['mock-source-1'],
          };
        },
      });
    };

    // User's exact scenario
    const heroUIRagTool = createMockVectorQueryTool({
      id: "heroui-rag-tool",
      description: "Search and retrieve reference and guides for using HeroUI",
      indexName: "heroui_docs",
      vectorStoreName: "test_store",
      model: { modelId: "text-embedding-3-small" }, // mock
      enableFilter: false,
    });

    // This line caused the infinite loop in the user's code
    const recallHeroUIRagTool = createStep(heroUIRagTool);

    // User's workflow
    const testWorkflow = createWorkflow({
      id: "generate-code-first-gen-workflow",
      inputSchema: z.object({ query: z.string() }),
      outputSchema: recallHeroUIRagTool.outputSchema,
    })
      .then(recallHeroUIRagTool)
      .commit();

    // If we reach here, TypeScript successfully compiled without infinite loop
    expect(recallHeroUIRagTool.id).toBe("heroui-rag-tool");
    expect(testWorkflow.id).toBe("generate-code-first-gen-workflow");
    expect(typeof recallHeroUIRagTool.execute).toBe('function');
  });

  it('should maintain type safety for tool execution context', () => {
    // Verify that our fix preserves type safety
    const tool = createTool({
      id: 'typed-tool',
      description: 'Tool with strict typing',
      inputSchema: z.object({
        queryText: z.string(),
        topK: z.number(),
        metadata: z.object({
          source: z.string(),
        }),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      execute: async ({ context }) => {
        // These should be properly typed
        const query: string = context.queryText;
        const count: number = context.topK;
        const source: string = context.metadata.source;
        
        return {
          result: `Processed ${query} with ${count} results from ${source}`,
        };
      },
    });

    const step = createStep(tool);
    
    expect(step.id).toBe('typed-tool');
    expect(step.inputSchema).toBe(tool.inputSchema);
    expect(step.outputSchema).toBe(tool.outputSchema);
  });
});