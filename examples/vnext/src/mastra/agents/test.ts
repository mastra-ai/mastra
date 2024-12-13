import { Agent } from '@mastra/core';

import { github } from '../integrations';
// import { createPortkey } from '@portkey-ai/vercel-provider';
import * as tools from '../tools';

const githubTools = github.getStaticTools();

export const agentOne = new Agent({
  name: 'Agent One',
  instructions: 'You know about basketball, specifically the NBA. You are a sports analyst.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-haiku-20240307',
    toolChoice: 'auto',
  },
  tools: {
    issuesList: githubTools.issuesList,
    reposListForUser: githubTools.reposListForUser,
    testTool: tools.testTool,
  },
});

export const agentTwo = new Agent({
  name: 'Agent Two',
  instructions: 'Do this',
  model: {
    provider: 'GROQ',
    name: 'llama3-groq-70b-8192-tool-use-preview',
    toolChoice: 'required',
  },
});

// const portkeyConfig = {
//   provider: 'openai', //enter provider of choice
//   api_key: process.env.OPENAI_API_KEY, //enter the respective provider's api key
//   override_params: {
//     model: 'gpt-4', //choose from 250+ LLMs
//   },
// };

// const portkey = createPortkey({
//   apiKey: process.env.PORTKEY_API_KEY,
//   config: portkeyConfig,
// });

// const chatModel = portkey.chatModel('');
// // const completionModel = portkey.completionModel('');

// export const agentFour = new Agent<typeof tools, typeof integrations>({
//   name: 'Agent Four',
//   instructions: 'Do this',
//   model: {
//     model: chatModel,
//     provider: 'Portkey',
//     toolChoice: 'required',
//   },
// });

// export const agenThree = new Agent<typeof tools, typeof integrations>({
//   name: 'Lasanga agent',
//   instructions: 'You know how to cook lasagna, and can come up with recipes',
//   model: {
//     provider: 'ANTHROPIC',
//     name: 'claude-3-haiku-20240307',
//     toolChoice: 'auto',
//   },
// });

export const agentFive = new Agent({
  name: 'Github agent',
  instructions: 'You can get all my github repos and issues',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-haiku-20241022',
    toolChoice: 'auto',
  },
  tools: {
    GithubReposTool: tools.GithubReposTool,
  },
});
