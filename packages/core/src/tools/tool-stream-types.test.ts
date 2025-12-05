/**
 * Type tests for ToolStream - verifying fix for GitHub issue #10805
 * [BUG] Type error: ToolStream<ChunkType> not assignable to WritableStream<Partial<StoryPlan>>
 *
 * This test file verifies that ToolStream can be used with pipeTo() for various data types
 * without TypeScript type errors.
 *
 * The exact scenario from docs:
 * ```typescript
 * const stream = await testAgent?.stream(`What is the weather in ${city}?`);
 * await stream!.fullStream.pipeTo(context?.writer!);
 * ```
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import type { ChunkType } from '../stream/types';
import { createStep, createWorkflow } from '../workflows/workflow';

/**
 * INTEGRATION TEST: Workflow step that streams an agent and pipes to writer
 *
 * This is the EXACT scenario from GitHub issue #10805 screenshot:
 * A workflow step that gets an agent, streams with structured output,
 * and pipes the objectStream to the step's writer.
 */
describe('ToolStream integration - Workflow step with agent streaming', () => {
  it('should allow piping agent.stream().fullStream to writer in workflow step', async () => {
    // Create a mock model for the agent
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Once upon a time...' },
          { type: 'text-delta', id: 'text-1', delta: ' there was a story.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    // Create the chapter generator agent
    const chapterGeneratorAgent = new Agent({
      id: 'chapterGeneratorAgent',
      name: 'Chapter Generator',
      instructions: 'You generate story chapters.',
      model: mockModel,
    });

    // Create Mastra instance with the agent
    const mastra = new Mastra({
      agents: { chapterGeneratorAgent },
    });

    // Define schemas matching the screenshot
    const workflowInputSchema = z.object({
      storyIdea: z.string(),
      numberOfChapters: z.number(),
    });

    // Schema for structured output (kept for documentation - matches the screenshot)
    const _storyPlanSchema = z.object({
      storyTitle: z.string(),
      chapters: z.array(
        z.object({
          chapterNumber: z.number(),
          title: z.string(),
          premise: z.string(),
        }),
      ),
    });

    // Create the step that matches the screenshot pattern
    const generateChaptersStep = createStep({
      id: 'generate-chapters',
      description: 'Generates a story plan with title and chapter details',
      inputSchema: workflowInputSchema,
      outputSchema: z.object({ text: z.string() }),
      execute: async ({ inputData, mastra: stepMastra, writer }) => {
        const { storyIdea, numberOfChapters } = inputData;

        // Get the agent from mastra (exactly like the screenshot)
        const chapterAgent = stepMastra.getAgent('chapterGeneratorAgent');

        // Stream the agent response
        const response = await chapterAgent.stream(
          `Create a ${numberOfChapters}-chapter story plan for: ${storyIdea}`,
          {
            structuredOutput: {
              schema: _storyPlanSchema,
            },
          },
        );

        await response.objectStream.pipeTo(writer);

        return { text: await response.text };
      },
    });

    // Create and run the workflow
    const workflow = createWorkflow({
      id: 'story-generator-workflow',
      inputSchema: workflowInputSchema,
      outputSchema: z.object({ text: z.string() }),
      steps: [generateChaptersStep],
    });

    workflow.then(generateChaptersStep).commit();

    // Register workflow with mastra
    mastra.addWorkflow(workflow, 'story-generator-workflow');

    // Run the workflow
    const run = await workflow.createRun({ runId: 'test-run' });
    const result = run.stream({
      inputData: {
        storyIdea: 'A hero journey',
        numberOfChapters: 3,
      },
    });

    // Collect stream chunks
    const chunks: ChunkType[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    // Verify we got stream output
    expect(chunks.length).toBeGreaterThan(0);

    // Get the final result
    const finalResult = await result.result;
    expect(finalResult.status).toBe('success');
  });
});
