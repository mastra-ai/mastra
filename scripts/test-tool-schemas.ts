// scripts/test-tool-schemas.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { createTool } from '@mastra/core/tools';
import { allParsersSchema, baseAllParsersSchema } from './allParsersSchema.js';
import * as fs from 'fs/promises';
import { config } from 'dotenv'; // Assuming dotenv is used for API keys

// Load environment variables
config();

// Configure models to test
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const modelsToTest = [
  { name: 'openai/gpt-4o', instance: openai('gpt-4o') },
  // Add other models here, e.g.:
  // { name: 'openai/gpt-3.5-turbo-0125', instance: openai('gpt-3.5-turbo-0125') },
  // { name: 'anthropic/claude-3-haiku-20240307', instance: anthropic('claude-3-haiku-20240307') }, // Assuming anthropic is configured
];

// Dynamically create tools from allParsersSchema properties
// Dynamically create tools from allParsersSchema properties
// Access the original object shape from the base schema
const originalShape = baseAllParsersSchema.shape;

console.log('Original Shape:', originalShape);
console.log('Keys of Original Shape:', Object.keys(originalShape));

const testTools = Object.keys(originalShape).map(key => {
  const schemaProperty = originalShape[key];
  // Create an object schema with only this one property
  const inputSchema = z.object({ [key]: schemaProperty });

  return createTool({
    id: `testTool_${key}`,
    description: `Test tool for schema type: ${key}. Call this tool to test the schema.`,
    inputSchema: inputSchema,
    execute: async ({ context }) => {
      // Tool execution logic - just return success and the received context
      console.log(`Executing testTool_${key} with context:`, context);
      return { success: true, receivedContext: context };
    },
  });
});

async function runTests() {
  const results = [];

  for (const modelInfo of modelsToTest) {
    console.log(`\nTesting model: ${modelInfo.name} ✨`);

    for (const testTool of testTools) {
      const toolName = testTool.id;
      const inputSchema = testTool.inputSchema;
      // Convert Zod to JSON schema using the available function
      const schemaJson = zodToJsonSchema(inputSchema, { target: 'openApi3' });

      console.log(`  Testing tool: ${toolName}`);

      try {
        const agent = new Agent({
          name: `test-agent-${modelInfo.name.replace(/[^a-zA-Z0-9]/g, '-')}`, // Sanitize name for agent ID
          instructions: `You are a test agent. Your task is to call the tool named '${toolName}' with any valid arguments.`,
          model: modelInfo.instance,
          tools: { [toolName]: testTool },
        });

        // Prompt the agent to call the tool
        const response = await agent.generate(`Please call the tool named '${toolName}'.`, {
          toolChoice: 'required', // Force tool call
          maxSteps: 1, // Only need one step to call the tool
        });

        console.log('Agent Response:', JSON.stringify(response, null, 2)); // Log the full response

        // Analyze the response
        // Find the tool call and its result
        const toolCall = response.toolCalls.find(tc => tc.toolName === toolName);
        const toolResult = response.toolResults.find(tr => tr.toolCallId === toolCall?.id);

        if (toolResult && toolResult.result?.success) {
          console.log(`    ✅ Success`);
          results.push({
            modelName: modelInfo.name,
            testName: toolName,
            schemaJson: schemaJson,
            result: 'success',
            error: null,
            receivedContext: toolResult.result.receivedContext, // Capture received args
          });
        } else {
          console.log(`    ❌ Failed`);
          // Capture error details
          const error = toolResult?.result?.error || response.text || 'Tool call failed or result missing';
          results.push({
            modelName: modelInfo.name,
            testName: toolName,
            schemaJson: schemaJson,
            result: 'failure',
            error: error,
            receivedContext: toolResult?.result?.receivedContext || null,
          });
        }
      } catch (e: any) {
        console.log(`    ❌ Error during generation: ${e.message}`);
        results.push({
          modelName: modelInfo.name,
          testName: toolName,
          schemaJson: schemaJson,
          result: 'error',
          error: e.message,
          receivedContext: null,
        });
      }
    }
  }

  // Write results to JSON file
  const outputPath = 'tool-schema-test-output.json';
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nTest results written to ${outputPath} 📝`);
}

runTests();

