import { Agent } from '@mastra/core';
import { createPortkey } from '@portkey-ai/vercel-provider';
import { parse } from 'superjson';
import { createWorkersAI } from 'workers-ai-provider';

import { integrations } from '../integrations';
import * as tools from '../tools';

export const agentOne = new Agent<typeof tools, typeof integrations>({
  name: 'Agent One',
  instructions: 'You know about basketball, specifically the NBA. You are a sports analyst.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-haiku-20240307',
    toolChoice: 'auto',
  },
  enabledTools: {
    issuesList: true,
    reposListForUser: true,
    testTool: true,
  },
});

export const agentTwo = new Agent<typeof tools, typeof integrations>({
  name: 'Agent Two',
  instructions: 'Do this',
  model: {
    provider: 'GROQ',
    name: 'llama3-groq-70b-8192-tool-use-preview',
    toolChoice: 'required',
  },
});

export const agentThree = new Agent<typeof tools, typeof integrations>({
  name: 'Agent Three',
  instructions: 'Do that',
  model: {
    provider: 'WORKERSAI',
    model: async () => {
      const res = await fetch('http://localhost:8787/');
      const data = (await res.text()) as any;

      console.log(JSON.stringify(data, null, 2));

      const { AI } = parse(data) as { AI: Ai };

      console.log({
        ai: AI,
        run: AI.run,
      });

      const workersAI = createWorkersAI({
        binding: AI,
      });

      const model = workersAI('@cf/meta/llama-2-7b-chat-int8');
      return model as any;
    },
    toolChoice: 'auto',
  },
});

const portkeyConfig = {
  provider: 'openai', //enter provider of choice
  api_key: process.env.OPENAI_API_KEY, //enter the respective provider's api key
  override_params: {
    model: 'gpt-4', //choose from 250+ LLMs
  },
};

const portkey = createPortkey({
  apiKey: 'l4KRhKcgi9SWOr8UC0iEVPb/3uI1',
  config: portkeyConfig,
});

const chatModel = portkey.chatModel('');
// const completionModel = portkey.completionModel('');

export const agentFour = new Agent<typeof tools, typeof integrations>({
  name: 'Agent Four',
  instructions: 'Do this',
  model: {
    model: chatModel,
    provider: 'Portkey',
    toolChoice: 'required',
  },
});
