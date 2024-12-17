import { FirecrawlIntegration } from "@mastra/firecrawl";
import { GithubIntegration } from "@mastra/github";

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
