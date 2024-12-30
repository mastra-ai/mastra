import { FirecrawlIntegration } from "@mastra/firecrawl";
import { GithubIntegration } from "@mastra/github";
import { StabilityAiIntegration } from "@mastra/stabilityai";
import { config } from "../../config/index.js";

// Helper function to get key from config or env
const getApiKey = (configKey: string, envKey: string): string => {
    const configValue = config.get(configKey);
    if (configValue) return configValue;

    const envValue = process.env[envKey];
    if (envValue) return envValue;

    return '';
};

export const firecrawl = new FirecrawlIntegration({
    config: {
        API_KEY: getApiKey('FIRECRAWL_API_KEY', 'FIRECRAWL_API_KEY'),
    },
});

export const github = new GithubIntegration({
    config: {
        PERSONAL_ACCESS_TOKEN: getApiKey('GITHUB_PERSONAL_ACCESS_TOKEN', 'GITHUB_PERSONAL_ACCESS_TOKEN'),
    }
});

export const stabilityai = new StabilityAiIntegration({
    config: {
        API_KEY: getApiKey('STABILITYAI_API_KEY', 'STABILITYAI_API_KEY'),
    }
});
