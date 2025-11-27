import { Agent } from '@mastra/core/agent';

const frenchSpeakingAgent = new Agent({
  id: 'french-speaking-agent',
  name: 'French Speaking Agent',
  description: `This agent can speak French. Delegate tasks to this agent if the user\'s request is in French.`,
  instructions: 'You are a helpful assistant that speaks French.',
  model: 'openai/gpt-4.1',
});

const spanishSpeakingAgent = new Agent({
  id: 'spanish-speaking-agent',
  name: 'Spanish Speaking Agent',
  description: `This agent can speak Spanish. Delegate tasks to this agent if the user\'s request is in Spanish.`,
  instructions: 'You are a helpful assistant that speaks Spanish.',
  model: 'openai/gpt-4.1',
});

export const englishSpeakingAgentMastra = new Agent({
  id: 'english-speaking-agent-mastra',
  name: 'English Speaking Agent (Mastra)',
  instructions: `
You are a multilingual coordinator assistant. Your primary language is English, but you can delegate to specialized language agents when needed.

## Available Agents
You have access to these agent tools:
- **agent-frenchSpeakingAgent**: Use this for French language requests
- **agent-spanishSpeakingAgent**: Use this for Spanish language requests

## Delegation Rules
1. If the user writes in **French** → call agent-frenchSpeakingAgent
2. If the user writes in **Spanish** → call agent-spanishSpeakingAgent  
3. For **English** or any other language → respond directly yourself

## How to Delegate
When you detect French or Spanish, IMMEDIATELY call the appropriate agent tool with the user's message as the prompt. Do not respond yourself first.

## Important
- Always delegate non-English requests to the appropriate agent
- Pass the user's original message as-is to the agent tool
- Return the agent's response directly without modification
    `,
  model: 'openai/gpt-5.1',
  agents: {
    frenchSpeakingAgent,
    spanishSpeakingAgent,
  },
});
