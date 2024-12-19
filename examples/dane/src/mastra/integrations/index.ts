import { FirecrawlIntegration } from "@mastra/firecrawl";
import { GithubIntegration } from "@mastra/github";
import { StabilityAiIntegration } from "@mastra/stabilityai"

export const firecrawl = new FirecrawlIntegration({
    config: {
        API_KEY: process.env.FIRECRAWL_API_KEY!,
    },
});

export const github = new GithubIntegration({
    config: {
        PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN!,
    }
})

export const stabilityai = new StabilityAiIntegration({
    config: {
        API_KEY: process.env.STABILITYAI_API_KEY!,
    }
})