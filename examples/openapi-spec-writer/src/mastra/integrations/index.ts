import { env } from 'node:process';
import { GithubIntegration } from "@mastra/github";
import { FirecrawlIntegration } from "@mastra/firecrawl";

export const github = new GithubIntegration({
  config: {
    PERSONAL_ACCESS_TOKEN: env.GITHUB_API_KEY!,
  },
})

export const firecrawl = new FirecrawlIntegration({
  config: {
    API_KEY: env.FIRECRAWL_API_KEY!,
  },
})
