#!/usr/bin/env tsx
/**
 * Test script for OpenAI-compatible endpoints
 *
 * Usage:
 * 1. Set your OpenAI API key: export OPENAI_API_KEY=sk-xxx
 * 2. Run: pnpm tsx examples/openai-compatible-test.ts
 */

import { Agent } from '../packages/core/src/agent';
import { z } from 'zod';

// Test 1: Direct URL string
async function testDirectUrl() {
  console.log('\n=== Test 1: Direct URL String ===');

  const agent = new Agent({
    name: 'url-test-agent',
    instructions: 'You are a helpful assistant. Be concise.',
    model: 'https://api.openai.com/v1/chat/completions',
  });

  try {
    const response = await agent.generateVNext('What is 2+2?');
    console.log('Response:', response.text);
  } catch (error) {
    console.error('Error with direct URL:', error);
  }
}

// Test 2: URL with configuration
async function testUrlWithConfig() {
  console.log('\n=== Test 2: URL with Configuration ===');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('Skipping test - OPENAI_API_KEY not set');
    return;
  }

  const agent = new Agent({
    name: 'config-test-agent',
    instructions: 'You are a helpful assistant. Be concise.',
    model: {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      modelId: 'gpt-4o-mini',
    },
  });

  try {
    const response = await agent.generateVNext('What is the capital of France?');
    console.log('Response:', response.text);
  } catch (error) {
    console.error('Error with config URL:', error);
  }
}

// Test 3: Streaming
async function testStreaming() {
  console.log('\n=== Test 3: Streaming ===');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('Skipping test - OPENAI_API_KEY not set');
    return;
  }

  const agent = new Agent({
    name: 'stream-test-agent',
    instructions: 'You are a helpful assistant.',
    model: {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      modelId: 'gpt-4o-mini',
    },
  });

  try {
    const stream = await agent.streamVNext('Tell me a very short joke');

    console.log('Streaming response:');
    for await (const chunk of stream.stream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }
    console.log('\n');

    const fullOutput = await stream.getFullOutput();
    console.log('Final text:', fullOutput.text);
  } catch (error) {
    console.error('Error with streaming:', error);
  }
}

// Test 4: Tool calling
async function testToolCalling() {
  console.log('\n=== Test 4: Tool Calling ===');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('Skipping test - OPENAI_API_KEY not set');
    return;
  }

  const agent = new Agent({
    name: 'tool-test-agent',
    instructions: 'You are a helpful assistant. Use the weather tool when asked about weather.',
    model: {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      modelId: 'gpt-4o-mini',
    },
    tools: {
      getWeather: {
        description: 'Get the weather for a city',
        parameters: z.object({
          city: z.string(),
        }),
        execute: async ({ city }) => {
          return { city, weather: 'sunny', temperature: 72 };
        },
      },
    },
  });

  try {
    const response = await agent.generateVNext('What is the weather in San Francisco?');
    console.log('Response:', response.text);
    console.log('Tool calls:', response.toolCalls);
  } catch (error) {
    console.error('Error with tool calling:', error);
  }
}

// Test 5: Structured output
async function testStructuredOutput() {
  console.log('\n=== Test 5: Structured Output ===');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('Skipping test - OPENAI_API_KEY not set');
    return;
  }

  const agent = new Agent({
    name: 'structured-test-agent',
    instructions: 'Extract information from the text.',
    model: {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      modelId: 'gpt-4o-mini',
    },
  });

  const schema = z.object({
    name: z.string(),
    age: z.number(),
    city: z.string(),
  });

  try {
    const response = await agent.generateVNext('John is 30 years old and lives in New York.', {
      output: schema,
    });
    console.log('Structured output:', response.object);
  } catch (error) {
    console.error('Error with structured output:', error);
  }
}

// Run all tests
async function runTests() {
  console.log('OpenAI-Compatible Endpoints Test Suite\n');

  await testDirectUrl();
  await testUrlWithConfig();
  await testStreaming();
  await testToolCalling();
  await testStructuredOutput();

  console.log('\n=== Tests Complete ===');
}

// Execute tests
runTests().catch(console.error);
