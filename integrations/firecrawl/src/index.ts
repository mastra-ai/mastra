import { 
  Integration, 
  IntegrationCredentialType, 
  IntegrationAuth,
  PropertyType, 
  IntegrationApiExcutorParams,
  delay,
  splitMarkdownIntoChunks,
} from '@mastra/core';

// @ts-ignore
import FirecrawlLogo from './assets/firecrawl.svg';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';
import { z } from 'zod';

type FirecrawlConfig = {
  API_KEY: string
  [key: string]: any;
};

export class FirecrawlIntegration extends Integration {
  categories = ['ai'];
  description = 'Power your AI apps with clean data crawled from any website.';

  constructor({ config }: { config: FirecrawlConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.API_KEY,
      name: 'FIRECRAWL',
      logoUrl: FirecrawlLogo,
      authConnectionOptions: z.object({
        API_KEY: z.string(),
      })
    });
  }

  getClientZodSchema() {
    return zodSchema;
  }

  getCommentsForClientApis() {
    return comments;
  }

  getBaseClient() {
    integrationClient.client.setConfig({
      baseUrl: `https://api.firecrawl.dev/v1`,
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const value = credential?.value as Record<string, any>;

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Bearer ${value?.['API_KEY']}`);
      return request;
    });

    return integrationClient;
  };

  async siteCrawl({ data, ctx }: IntegrationApiExcutorParams) {

    console.log('INCOMING', data)
  
    const connectionId = ctx.connectionId
  
    const client = await this.getApiClient({ connectionId })
  
    const res = await client.crawlUrls({
      body: {
        url: data.url,
        scrapeOptions: {
          formats: ['markdown'],
          includeTags: ['main'],
          excludeTags: ['img', 'footer', 'nav', 'header'],
          onlyMainContent: true,
        }
      }
    })
  
    if (res.error) {
      console.error(JSON.stringify(res.error, null, 2))
      return { success: false }
    }
  

    const crawlId = res.data?.id
  
    let crawl = await client.getCrawlStatus({
      path: {
        id: crawlId!
      }
    })
  
    while (crawl.data?.status === 'scraping') {
      await delay(5000)
  
      crawl = await client.getCrawlStatus({
        path: {
          id: crawlId!
        }
      })
  
      console.log(crawl.data?.status)
    }
  
    const recordsToPersist = crawl?.data?.data?.flatMap(({ markdown, metadata }) => {
      const chunks = splitMarkdownIntoChunks(markdown!)
      return chunks.map((c, i) => {
        return {
          externalId: `${metadata?.sourceURL}_chunk_${i}`,
          data: { markdown: c},
          entityType: data.entityType
        }
      })
    })
  
    await this.dataLayer?.syncData({
      name: this.name,
      connectionId,
      data: recordsToPersist,
      properties: [
        {
          name: 'markdown',
          displayName: 'Markdown',
          type: PropertyType.LONG_TEXT,
          visible: true,
          order: 1,
          modifiable: true
        }
      ],
      type: data.entityType,
    })
    
    return { success: true }
  }
  

  registerApis() {
    this.apis = {
      CRAWL_SITE: {
        integrationName: this.name,
        type: 'execute_site_crawl',
        label: 'Firecrawls and syncs data for data',
        description: 'Firecrawls and syncs data for data',
        schema: z.object({
          url: z.string(),
          entityType: z.string()
        }),
        executor: this.siteCrawl,
      },
    }

    return this.apis
  }

  registerEvents() {
    this.events = {
      CRAWL_SITE_INIT: {
        label: 'Start Firecrawl for a site',
        description: 'Start Firecrawl for a site',
        schema: z.object({
          url: z.string(),
          entityType: z.string()
        })
      }
    };
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
      },
    });
  }
}
