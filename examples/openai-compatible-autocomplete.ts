/**
 * Example showing TypeScript autocomplete for OpenAI-compatible models
 *
 * When you type a model string starting with a provider name followed by "/",
 * your IDE should autocomplete with all available models for that provider.
 */

import { Agent } from '@mastra/core/agent';
import type { OpenAICompatibleModelId } from '@mastra/core/llm/model';

// Example 1: Direct string usage with autocomplete
const agent1 = new Agent({
  name: 'GroqAgent',
  model: 'groq/llama-3.3-70b-versatile', // ← Type "groq/" to see all Groq models
  instructions: 'You are a helpful assistant',
});

// Example 2: Using a typed variable
const modelId: OpenAICompatibleModelId = 'deepseek/deepseek-chat'; // ← Autocomplete available

const agent2 = new Agent({
  name: 'DeepSeekAgent',
  model: modelId,
  instructions: 'You are a coding assistant',
});

// Example 3: All supported providers with autocomplete
const examples: OpenAICompatibleModelId[] = [
  'openai/gpt-4o', // OpenAI models
  'groq/llama-3.3-70b-versatile', // Groq models
  'deepseek/deepseek-chat', // DeepSeek models
  'openrouter/claude-3.5-sonnet', // OpenRouter models
  'github_models/gpt-4o', // GitHub Models
  'together/mixtral-8x7b', // Together AI models
  'perplexity/sonar-medium', // Perplexity models
  // ... and many more providers!
];

// Example 4: Custom endpoint (no autocomplete, just a string)
const customAgent = new Agent({
  name: 'CustomAgent',
  model: {
    id: 'my-custom-model',
    url: 'https://my-api.example.com/v1/chat/completions',
    apiKey: process.env.CUSTOM_API_KEY,
  },
  instructions: 'You are a custom model assistant',
});

console.log('Agents created with autocomplete support!');
