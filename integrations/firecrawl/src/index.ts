import { createSync, Integration } from '@mastra/core';
import { MDocument } from '@mastra/rag'
import * as integrationClient from './client/sdk.gen';
// @ts-ignore
// import FirecrawlLogo from './assets/firecrawl.png';
import { FirecrawlToolset } from './toolset';
import { FirecrawlConfig } from './types';
import { z } from 'zod';
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
    })

    this.registerSync(createSync({
      id: 'FIRECRAWL:CRAWL_AND_SYNC',
      name: 'Crawl and Sync',
      description: 'Crawl and Sync',
      outputSchema: z.object({
        success: z.boolean(),
        entityType: z.string(),
        crawlData: z.array(z.object({
          markdown: z.string(),
          metadata: z.object({
            sourceURL: z.string(),
          }),
        })),
      }),
      inputSchema: z.object({
        url: z.string(),
        limit: z.number().default(3),
        pathRegex: z.string().nullable(),
      }),
      execute: async ({ context: { url, pathRegex, limit }, engine }) => {
        console.log("Starting crawl", url);

        const entityType = `CRAWL_${url}`;

        try {
          const client = await this.openapi.getApiClient();

          const res = await client.crawlUrls({
            body: {
              url: url,
              limit: limit || 3,
              includePaths: pathRegex ? [pathRegex] : [],
              scrapeOptions: {
                formats: ["markdown"],
                includeTags: ["main", "body"],
                excludeTags: [
                  "img",
                  "footer",
                  "nav",
                  "header",
                  "#navbar",
                  ".table-of-contents-content",
                ],
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

          while (crawl.data?.status === "scraping") {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            crawl = await client.getCrawlStatus({
              path: {
                id: crawlId!,
              },
            });
          }


          const crawlData = (crawl?.data?.data || []).map((item) => ({
            markdown: item.markdown || "",
            metadata: {
              sourceURL: item?.metadata?.sourceURL || "",
              ...item.metadata,
            },
          }))

          if (!crawlData) {
            return {
              success: false,
              crawlData: [],
              entityType: "",
            };
          }

          const recordsToPersist = await Promise.all(
            crawlData?.flatMap(async ({ markdown, metadata }) => {
              const doc = MDocument.fromMarkdown(markdown, metadata);

              await doc.chunk({
                strategy: "markdown",
                maxSize: 8190,
              });

              const chunks = doc.getDocs();

              return chunks.map((c, i) => {
                return {
                  externalId: `${c.metadata?.sourceURL}_chunk_${i}`,
                  data: { markdown: c.text },
                };
              });
            })
          );

          await engine?.syncRecords({
            connectionId: "SYSTEM",
            records: recordsToPersist.flatMap((r) => r),
            name: entityType,
          });

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
            entityType: "",
          };
        }
      }
    }))

    this.registerSync(createSync({
      id: 'FIRECRAWL:CRAWL_AND_SYNC_ONCE',
      name: 'Crawl and Sync Once',
      description: 'Crawl and Sync if the entity type does not exist',
      outputSchema: z.object({
        success: z.boolean(),
        entityType: z.string(),
        crawlData: z.array(z.object({
          markdown: z.string(),
          metadata: z.object({
            sourceURL: z.string(),
          }),
        })),
      }),
      inputSchema: z.object({
        url: z.string(),
        limit: z.number().default(3),
        pathRegex: z.string().nullable(),
      }),
      execute: async ({ context: { url, pathRegex, limit }, engine }) => {
        const entityType = `CRAWL_${url}`;

        const existingCrawl = await engine?.getRecordsByEntityName({
          connectionId: "SYSTEM",
          name: entityType,
        });

        if (existingCrawl?.length > 0) {
          console.log("Crawl already exists", url);
          return {
            success: true,
            entityType,
            crawlData: existingCrawl,
          };
        }

        console.log("Starting crawl", url);
        try {
          const client = await this.openapi.getApiClient();

          const res = await client.crawlUrls({
            body: {
              url: url,
              limit: limit || 3,
              includePaths: pathRegex ? [pathRegex] : [],
              scrapeOptions: {
                formats: ["markdown"],
                includeTags: ["main", "body"],
                excludeTags: [
                  "img",
                  "footer",
                  "nav",
                  "header",
                  "#navbar",
                  ".table-of-contents-content",
                ],
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

          while (crawl.data?.status === "scraping") {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            crawl = await client.getCrawlStatus({
              path: {
                id: crawlId!,
              },
            });
          }


          const crawlData = (crawl?.data?.data || []).map((item) => ({
            markdown: item.markdown || "",
            metadata: {
              sourceURL: item?.metadata?.sourceURL || "",
              ...item.metadata,
            },
          }))

          if (!crawlData) {
            return {
              success: false,
              crawlData: [],
              entityType: "",
            };
          }

          const recordsToPersist = await Promise.all(
            crawlData?.flatMap(async ({ markdown, metadata }) => {
              const doc = MDocument.fromMarkdown(markdown, metadata);

              await doc.chunk({
                strategy: "markdown",
                maxSize: 8190,
              });

              const chunks = doc.getDocs();

              return chunks.map((c, i) => {
                return {
                  externalId: `${c.metadata?.sourceURL}_chunk_${i}`,
                  data: { markdown: c.text },
                };
              });
            })
          );

          await engine?.syncRecords({
            connectionId: "SYSTEM",
            records: recordsToPersist.flatMap((r) => r),
            name: entityType,
          });

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
            entityType: "",
          };
        }
      }
    }))
  }

  getStaticTools() {
    return {
      ...this.openapi.tools
    };
  }

  async getApiClient() {
    return this.openapi.getApiClient();
  }
}

