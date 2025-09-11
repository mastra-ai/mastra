/**
 * Example: Using the model() helper function for better autocomplete
 *
 * The model() helper provides two-stage autocomplete:
 * 1. First parameter: autocomplete shows only providers
 * 2. Second parameter: autocomplete shows only models for that provider
 */

import { Agent } from '@mastra/core/agent';
import { model } from '@mastra/core/llm/model';

// Using the model() helper - BEST AUTOCOMPLETE EXPERIENCE
const agent1 = new Agent({
  name: 'claude-agent',
  model: model('anthropic', 'claude-3-opus-20240229'),
  //            ^-- Step 1: Shows only providers (openai, anthropic, deepseek, etc.)
  //                          ^-- Step 2: Shows only Anthropic models
  instructions: 'You are a helpful assistant',
});

// More examples with different providers
const agent2 = new Agent({
  name: 'openai-agent',
  model: model('openai', 'gpt-4o'),
  //            ^-- First see: openai, anthropic, deepseek, groq, etc.
  //                      ^-- Then see: gpt-4o, gpt-4o-mini, gpt-4, etc.
  instructions: 'You are powered by OpenAI',
});

const agent3 = new Agent({
  name: 'deepseek-agent',
  model: model('deepseek', 'deepseek-chat'),
  //            ^-- First: provider selection
  //                        ^-- Then: deepseek-chat, deepseek-reasoner
  instructions: 'You are powered by DeepSeek',
});

// You can also use it with variables
const selectedProvider = 'groq' as const;
const selectedModel = 'llama-3.1-8b-instant'; // Will autocomplete based on provider!
const agent4 = new Agent({
  name: 'groq-agent',
  model: model(selectedProvider, selectedModel),
  instructions: 'Fast inference with Groq',
});

// The model() function returns a properly typed OpenAICompatibleModelId
const modelId = model('fireworks_ai', 'accounts/fireworks/models/deepseek-v3-0324');
console.log(modelId); // "fireworks_ai/accounts/fireworks/models/deepseek-v3-0324"

// You can still use raw strings if needed (with less ideal autocomplete)
const agent5 = new Agent({
  name: 'raw-string-agent',
  model: 'openai/gpt-4o', // This works but shows ALL models at once
  instructions: 'Using raw string',
});

// Function that accepts a model configuration
function createAgentWithProvider<P extends import('@mastra/core/llm/model').Provider>(
  provider: P,
  modelId: import('@mastra/core/llm/model').ModelForProvider<P>,
  instructions: string,
) {
  return new Agent({
    name: `${provider}-agent`,
    model: model(provider, modelId),
    instructions,
  });
}

// Using the function - perfect two-stage autocomplete!
const customAgent = createAgentWithProvider(
  'anthropic',
  'claude-3-haiku-20240307', // Only shows Anthropic models!
  'A fast and efficient assistant',
);

export { agent1, agent2, agent3, agent4, agent5, customAgent };
