// @ts-nocheck
/**
 * Zod 4 Compatibility Test Fixture
 *
 * Regression test for issue #11121: Zod 4 schemas with structuredOutput
 * should work when @mastra/core uses Zod 3 internally.
 */

import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { MockMemory } from '@mastra/core/memory';

interface TestResult {
  zod4Detected: boolean;
  basicStructuredOutput: { passed: boolean; error?: string };
  structuredOutputWithMemory: { passed: boolean; error?: string };
}

const result: TestResult = {
  zod4Detected: false,
  basicStructuredOutput: { passed: false },
  structuredOutputWithMemory: { passed: false },
};

// Verify we're using Zod 4
const testSchema = z.string();
result.zod4Detected = '_zod' in testSchema;

if (!result.zod4Detected) {
  console.log(JSON.stringify(result));
  process.exit(1);
}

// Create a mock model that returns JSON for structured output
const mockModel = {
  specificationVersion: 'v2' as const,
  provider: 'mock',
  modelId: 'mock-model',
  defaultObjectGenerationMode: 'json' as const,
  supportsStructuredOutputs: true,
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: 'text' as const, text: JSON.stringify({ name: 'Test User', age: 25 }) }],
    warnings: [],
  }),
  doStream: async () => {
    throw new Error('Stream not implemented in mock');
  },
};

async function testBasicStructuredOutput(): Promise<void> {
  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You return user data',
    model: mockModel as any,
  });

  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  try {
    const res = await agent.generate('Get user data', {
      structuredOutput: { schema: schema as any },
    });

    if (res.error) {
      result.basicStructuredOutput = { passed: false, error: res.error.message };
      return;
    }

    const obj = await res.object;

    // Validate shape and types
    if (typeof obj !== 'object' || obj === null) {
      result.basicStructuredOutput = { passed: false, error: `Expected object, got ${typeof obj}` };
      return;
    }
    if (typeof obj.name !== 'string') {
      result.basicStructuredOutput = { passed: false, error: `Expected name to be string, got ${typeof obj.name}` };
      return;
    }
    if (typeof obj.age !== 'number') {
      result.basicStructuredOutput = { passed: false, error: `Expected age to be number, got ${typeof obj.age}` };
      return;
    }

    // Validate expected values from mock
    if (obj.name !== 'Test User') {
      result.basicStructuredOutput = { passed: false, error: `Expected name 'Test User', got '${obj.name}'` };
      return;
    }
    if (obj.age !== 25) {
      result.basicStructuredOutput = { passed: false, error: `Expected age 25, got ${obj.age}` };
      return;
    }

    // Verify schema can parse the result (confirms Zod 4 schema validation works)
    schema.parse(obj);

    result.basicStructuredOutput = { passed: true };
  } catch (err: any) {
    result.basicStructuredOutput = { passed: false, error: err.message };
  }
}

async function testStructuredOutputWithMemory(): Promise<void> {
  const memory = new MockMemory({
    enableMessageHistory: true,
  });

  const agent = new Agent({
    id: 'test-agent-with-memory',
    name: 'Test Agent with Memory',
    instructions: 'You return user data',
    model: mockModel as any,
    memory: memory,
  });

  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  try {
    const thread = await memory.createThread({ resourceId: 'test-resource' });

    const res = await agent.generate('Get user data', {
      threadId: thread.id,
      resourceId: 'test-resource',
      structuredOutput: { schema: schema as any },
    });

    if (res.error) {
      result.structuredOutputWithMemory = { passed: false, error: res.error.message };
      return;
    }

    const obj = await res.object;

    // Validate shape and types
    if (typeof obj !== 'object' || obj === null) {
      result.structuredOutputWithMemory = { passed: false, error: `Expected object, got ${typeof obj}` };
      return;
    }
    if (typeof obj.name !== 'string') {
      result.structuredOutputWithMemory = {
        passed: false,
        error: `Expected name to be string, got ${typeof obj.name}`,
      };
      return;
    }
    if (typeof obj.age !== 'number') {
      result.structuredOutputWithMemory = { passed: false, error: `Expected age to be number, got ${typeof obj.age}` };
      return;
    }

    // Validate expected values from mock
    if (obj.name !== 'Test User') {
      result.structuredOutputWithMemory = { passed: false, error: `Expected name 'Test User', got '${obj.name}'` };
      return;
    }
    if (obj.age !== 25) {
      result.structuredOutputWithMemory = { passed: false, error: `Expected age 25, got ${obj.age}` };
      return;
    }

    // Verify schema can parse the result (confirms Zod 4 schema validation works)
    schema.parse(obj);

    result.structuredOutputWithMemory = { passed: true };
  } catch (err: any) {
    result.structuredOutputWithMemory = { passed: false, error: err.message };
  }
}

async function main() {
  await testBasicStructuredOutput();
  await testStructuredOutputWithMemory();

  console.log(JSON.stringify(result));

  const allPassed = result.basicStructuredOutput.passed && result.structuredOutputWithMemory.passed;
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  result.structuredOutputWithMemory = { passed: false, error: err.message };
  console.log(JSON.stringify(result));
  process.exit(1);
});
