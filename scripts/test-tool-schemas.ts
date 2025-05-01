import { z } from 'zod';
import type { LanguageModel } from '@mastra/core';
import { createOpenAI } from '@ai-sdk/openai';
import { createTool } from '@mastra/core';
import { allParsers } from './allParsersSchema.js';
import * as fs from 'fs/promises';
import chalk from 'chalk';
import { Agent } from '@mastra/core/agent';
import 'dotenv/config';

type Result = {
  testId: string;
  modelName: string;
  testName: string;
  modelProvider: string;
  status: string;
  error: any;
  receivedContext: any;
};

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const modelsToTest: LanguageModel[] = [
  openai('o3-mini'),
  // openai('gpt-4o'),
];

const testTools = Object.keys(allParsers.shape).map(key => {
  return createTool({
    id: `testTool_${key}`,
    description: `Test tool for schema type: ${key}. Call this tool to test the schema.`,
    inputSchema: z.object({ [key]: allParsers.shape[key as keyof typeof allParsers.shape] }),
    execute: async ({ context }) => {
      // console.log(`Executing testTool_${key} with context:`, context);
      return { success: true, receivedContext: context };
    },
  });
});

async function runSingleTest(
  model: LanguageModel,
  testTool: ReturnType<typeof createTool>,
  testId: string,
): Promise<Result> {
  const toolName = testTool.id;
  try {
    const agent = new Agent({
      name: `test-agent-${model.modelId}`,
      instructions: `You are a test agent. Your task is to call the tool named '${toolName}' with any valid arguments.`,
      model: model,
      tools: { [toolName]: testTool },
    });

    const response = await agent.generate(`Please call the tool named '${toolName}'.`, {
      toolChoice: 'required',
      maxSteps: 1,
      temperature: 1, // todo only set this for o3-mini, other models should use whatever the default is - also seems wrong that we have to do this at all
    });

    const toolCall = response.toolCalls.find(tc => tc.toolName === toolName);
    const toolResult = response.toolResults.find(tr => tr.toolCallId === toolCall?.toolCallId);

    if (toolResult && toolResult.result?.success) {
      return {
        modelName: model.modelId,
        modelProvider: model.provider,
        testName: toolName,
        status: 'success',
        error: null,
        receivedContext: toolResult.result.receivedContext,
        testId,
      };
    } else {
      const error = toolResult?.result?.error || response.text || 'Tool call failed or result missing';
      return {
        modelName: model.modelId,
        testName: toolName,
        modelProvider: model.provider,
        status: 'failure',
        error: error,
        receivedContext: toolResult?.result?.receivedContext || null,
        testId,
      };
    }
  } catch (e: any) {
    return {
      modelName: model.modelId,
      testName: toolName,
      modelProvider: model.provider,
      status: 'error',
      error: e.message,
      receivedContext: null,
      testId,
    };
  }
}

/**
 * Generate a summary of the test results
 */
function generateSummary(resultsByModel: Map<LanguageModel, { results: Result[] }>) {
  console.log(chalk.blue('\n=== Tool Compatibility Summary ==='));
  console.log('Total Models:', modelsToTest.length);

  for (const [model, { results }] of Array.from(resultsByModel)) {
    console.log(chalk.blue(`\n${model.provider}/${model.modelId}`));
    for (const result of results) {
      const status = result.status === 'success' ? chalk.green(result.status) : chalk.red(result.status);
      console.log(`  ${status}${result.status === 'error' ? '  ' : ''} ${result.testName}`);
    }
  }
}

async function runTests() {
  const testId = new Date().toISOString();

  // Create all test combinations
  const testCombinations = modelsToTest.flatMap(modelInfo =>
    testTools.map(testTool => ({
      modelInfo,
      testTool,
      testId: crypto.randomUUID(),
    })),
  );

  // Run all tests in parallel with concurrency limit
  const CONCURRENCY_LIMIT = 100; // Adjust based on your needs
  const resultsByModel = new Map<LanguageModel, { results: Result[] }>();

  for (let i = 0; i < testCombinations.length; i += CONCURRENCY_LIMIT) {
    const batch = testCombinations.slice(i, i + CONCURRENCY_LIMIT);
    console.log(
      `Running batch ${i / CONCURRENCY_LIMIT + 1} of ${Math.ceil(testCombinations.length / CONCURRENCY_LIMIT)}`,
    );

    await Promise.all(
      batch.map(async ({ modelInfo, testTool, testId }) => {
        const result = await runSingleTest(modelInfo, testTool, testId);
        const existingResult = resultsByModel.get(modelInfo) || { results: [] };
        existingResult.results.push(result);
        resultsByModel.set(modelInfo, existingResult);
      }),
    );
  }

  // Write results to JSON file
  const outputPath = 'tool-schema-test-output.json';
  generateSummary(resultsByModel);
  const results = Array.from(resultsByModel.values()).flatMap(v => v.results);
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nTest ${testId} results written to ${outputPath} 📝`);
}

runTests().catch(console.error);
