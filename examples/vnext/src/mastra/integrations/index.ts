import { ClaudeIntegration } from '@mastra/claude';
import { GithubIntegration } from '@mastra/github';


export const github = new GithubIntegration({
  config: {
    PERSONAL_ACCESS_TOKEN: process.env.PAT!,
  },
})

export const claude = new ClaudeIntegration({
  config: {
    ANTHROPIC_API_KEY: '123',
  },
})

