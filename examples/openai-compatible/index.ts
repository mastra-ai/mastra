/**
 * OpenAI-Compatible Models Example
 *
 * This example demonstrates how to use OpenAI-compatible models in Mastra
 * without requiring provider-specific packages.
 */

import { Agent } from '@mastra/core';

// Example 1: Magic string pattern - automatically uses environment variable
async function magicStringExample() {
  // This will automatically use GROQ_API_KEY from environment
  const agent = new Agent({
    name: 'groq-agent',
    instructions: 'You are a helpful assistant.',
    model: 'groq/llama-3.3-70b-versatile', // provider/model format
  });

  const response = await agent.generateVNext('What is the capital of France?');
  console.log('Response:', response.text);
}

// Example 2: Config with explicit API key
async function configWithApiKeyExample() {
  const agent = new Agent({
    name: 'openai-agent',
    instructions: 'You are a concise assistant.',
    model: {
      id: 'openai/gpt-4o-mini',
      apiKey: process.env.MY_OPENAI_KEY || 'your-api-key',
    },
  });

  const response = await agent.generateVNext('Explain quantum computing in one sentence.');
  console.log('Response:', response.text);
}

// Example 3: Custom URL for self-hosted or alternative endpoints
async function customUrlExample() {
  const agent = new Agent({
    name: 'custom-agent',
    instructions: 'You are a helpful assistant.',
    model: {
      id: 'custom-model',
      url: 'https://my-custom-endpoint.com/v1/chat/completions',
      apiKey: 'my-api-key',
      headers: {
        'X-Custom-Header': 'value',
      },
    },
  });

  const response = await agent.generateVNext('Hello!');
  console.log('Response:', response.text);
}

// Example 4: Streaming responses
async function streamingExample() {
  const agent = new Agent({
    name: 'stream-agent',
    instructions: 'You are a storyteller.',
    model: 'openai/gpt-4o-mini',
  });

  const stream = await agent.streamVNext('Tell me a short story about a robot.');

  // Process the stream
  if (stream.fullStream) {
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text || '');
      }
    }
  }
}

// Supported providers (with built-in presets)
const SUPPORTED_PROVIDERS = [
  'openai', // Uses OPENAI_API_KEY
  'anthropic', // Uses ANTHROPIC_API_KEY
  'groq', // Uses GROQ_API_KEY
  'together', // Uses TOGETHER_API_KEY
  'perplexity', // Uses PERPLEXITY_API_KEY
  'mistral', // Uses MISTRAL_API_KEY
  'deepseek', // Uses DEEPSEEK_API_KEY
];

async function main() {
  console.log('OpenAI-Compatible Models Examples\n');

  try {
    await magicStringExample();
    await configWithApiKeyExample();
    await streamingExample();
    // Custom URL example would require a real endpoint
  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  main();
}

export { magicStringExample, configWithApiKeyExample, customUrlExample, streamingExample };
