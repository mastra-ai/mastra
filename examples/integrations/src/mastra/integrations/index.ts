import { ComposioIntegration } from '@mastra/composio';
import { FirecrawlIntegration } from '@mastra/firecrawl';
import { SampleIntegration } from './sample';

export const sample = new SampleIntegration()

export const firecrawl = new FirecrawlIntegration({
    config: {
        API_KEY: process.env.FIRECRAWL_API_KEY!,
    }
});

export const composio = new ComposioIntegration({
    config: {
        API_KEY: process.env.COMPOSIO_API_KEY!,
        entityId: 'default',
        connectedAccountId: '899144e5-a466-428b-8a00-7c931fb57f9f',
    }
});