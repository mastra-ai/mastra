import { FirecrawlIntegration } from '@mastra/firecrawl';
import { SampleIntegration } from './sample';

export const sample = new SampleIntegration()

export const firecrawl = new FirecrawlIntegration({
    config: {
        API_KEY: process.env.FIRECRAWL_API_KEY!,
    }
});
