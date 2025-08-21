import { Integration } from '@mastra/core/integration';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import type * as integrationClient from './client/sdk.gen';
// @ts-ignore
// import FirecrawlLogo from './assets/firecrawl.png';
import { FirecrawlToolset } from './toolset';
import type { FirecrawlConfig } from './types';

export class FirecrawlIntegration extends Integration<void, typeof integrationClient> {
  readonly name = 'FIRECRAWL';
  readonly logoUrl = '';
  config: FirecrawlConfig;
  categories = ['dev-tools', 'ai', 'automation'];
  description = 'Firecrawl is a web scraping platform';

  openapi: FirecrawlToolset;

  constructor({ config }: { config: FirecrawlConfig }) {
    super();
    this.config = config;

    this.openapi = new FirecrawlToolset({
      config: this.config,
    });

    const crawlAndSyncWorkflow = createWorkflow({
      id: 'Crawl and Sync',
      inputSchema: z.object({
        url: z.string(),
        limit: z.number().default(3),
        pathRegex: z.string().nullable(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        crawlData: z.array(
          z.object({
            markdown: z.string(),
            metadata: z.object({
              sourceURL: z.string(),
            }),
          }),
        ),
        entityType: z.string(),
      }),
    });

    const syncStep = createStep({
      id: 'FIRECRAWL:CRAWL_AND_SYNC',
      description: 'Crawl and Sync',
      inputSchema: z.object({
        url: z.string(),
        limit: z.number().default(3),
        pathRegex: z.string().nullable(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        crawlData: z.array(
          z.object({
            markdown: z.string(),
            metadata: z.object({
              sourceURL: z.string(),
            }),
          }),
        ),
        entityType: z.string(),
      }),
      execute: async ({ inputData }) => {
        const triggerData = inputData;
        console.log('Starting crawl', triggerData?.url);

        const entityType = `CRAWL_${triggerData?.url}`;

        try {
          const client = await this.openapi.getApiClient();

          const res = await client.crawlUrls({
            body: {
              url: triggerData?.url,
              limit: triggerData?.limit || 3,
              includePaths: triggerData?.pathRegex ? [triggerData.pathRegex] : [],
              scrapeOptions: {
                formats: ['markdown'],
                includeTags: ['main', 'body'],
                excludeTags: ['img', 'footer', 'nav', 'header', '#navbar', '.table-of-contents-content'],
                onlyMainContent: true,
              },
            },
          });

          if (res.error) {
            console.error({ error: JSON.stringify(res.error, null, 2) });
            throw new Error(res.error.error);
          }

          const crawlId = res.data?.id;

          let crawl = await client.getCrawlStatus({
            path: {
              id: crawlId!,
            },
          });

          while (crawl.data?.status === 'scraping') {
            await new Promise(resolve => setTimeout(resolve, 5000));

            crawl = await client.getCrawlStatus({
              path: {
                id: crawlId!,
              },
            });
          }

          const crawlData = (crawl?.data?.data || []).map(item => ({
            markdown: item.markdown || '',
            metadata: {
              sourceURL: item?.metadata?.sourceURL || '',
              ...item.metadata,
            },
          }));

          if (!crawlData) {
            return {
              success: false,
              crawlData: [],
              entityType: '',
            };
          }

          return {
            success: true,
            crawlData,
            entityType,
          };
        } catch (error) {
          console.error({ error });
          return {
            success: false,
            crawlData: [],
            entityType: '',
          };
        }
      },
    });

    crawlAndSyncWorkflow.then(syncStep).commit();

    this.registerWorkflow('FIRECRAWL:CRAWL_AND_SYNC', crawlAndSyncWorkflow);
  }

  getStaticTools() {
    return {
      ...this.openapi.tools,
    };
  }

  async getApiClient() {
    return this.openapi.getApiClient();
  }
}
