import { anthropic as anthropicV5 } from '@ai-sdk/anthropic-v5';
import { anthropic as anthropicV6 } from '@ai-sdk/anthropic-v6';
import { openai as openaiV5 } from '@ai-sdk/openai-v5';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { streamText as streamTextV5 } from 'ai-v5';
import { streamText as streamTextV6 } from 'ai-v6';
import { google as googleV5 } from '@ai-sdk/google-v5';
import { google as googleV6 } from '@ai-sdk/google-v6';

import { getAiSdkDuplicateIdsTests } from './shared/ai-sdk-duplicate-ids';

// Test AI SDK v5 providers for duplicate text ID issues
getAiSdkDuplicateIdsTests([
  {
    name: 'Anthropic',
    model: anthropicV5('claude-sonnet-4-5'),
    envVar: 'ANTHROPIC_API_KEY',
    expectsDuplicates: true, // Known upstream bug
    streamTextFunction: streamTextV5,
  },
  {
    name: 'Anthropic',
    model: anthropicV6('claude-sonnet-4-5'),
    envVar: 'ANTHROPIC_API_KEY',
    expectsDuplicates: true, // Known upstream bug
    streamTextFunction: streamTextV6,
  },
  {
    name: 'OpenAI',
    model: openaiV5('gpt-4o'),
    envVar: 'OPENAI_API_KEY',
    expectsDuplicates: false, // OpenAI produces unique IDs
    streamTextFunction: streamTextV5,
  },
  {
    name: 'OpenAI',
    model: openaiV6('gpt-4o'),
    envVar: 'OPENAI_API_KEY',
    expectsDuplicates: false, // OpenAI produces unique IDs
    streamTextFunction: streamTextV6,
  },
  {
    name: 'Google',
    model: googleV5('gemini-pro-latest'),
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    expectsDuplicates: true, // Known upstream bug (may vary)
    streamTextFunction: streamTextV5,
  },
  {
    name: 'Google',
    model: googleV6('gemini-pro-latest'),
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    expectsDuplicates: true, // Known upstream bug (may vary)
    streamTextFunction: streamTextV6,
  },
]);
