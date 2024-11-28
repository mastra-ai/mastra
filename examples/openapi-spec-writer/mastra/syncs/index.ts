import { createSync, PropertyType } from "@mastra/core";
import { z } from "zod";
import * as tools from "../tools";

function splitMarkdownIntoChunks(
  markdown: string,
  maxTokens: number = 8190
): string[] {
  const tokens = markdown.split(/\s+/); // Split by whitespace to tokenize
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const token of tokens) {
    if (currentChunk.join(" ").length + token.length + 1 > maxTokens) {
      // If adding the next token exceeds the limit, push the current chunk and reset
      chunks.push(currentChunk.join(" "));
      currentChunk = [token]; // Start a new chunk with the current token
    } else {
      // Otherwise, add the token to the current chunk
      currentChunk.push(token);
    }
  }

  // Add any remaining tokens as the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}

export const siteCrawlSync = createSync({
  label: "Site Crawl Sync",
  schema: z.object({
    url: z.string(),
    pathRegex: z.string(),
    limit: z.number(),
  }),
  outputShema: z.object({
    success: z.boolean(),
    crawlData: z.array(
      z.object({
        markdown: z.string(),
        metadata: z.object({
          sourceURL: z.string(),
        }),
      })
    ),
    entityType: z.string(),
  }),
  description:
    "Crawl a website and extract the markdown content and sync it to the database",
  executor: async ({
    data,
    integrationsRegistry,
    toolsRegistry,
    agents,
    engine,
    llm,
  }) => {
    //maybe @mastra/enigne needs to expose a get/create system connection
    const connection = await engine?.getConnection({
      name: "FIRECRAWL",
      connectionId: "SYSTEM",
    });

    if (!connection) {
      await engine?.createConnection({
        connection: {
          connectionId: "SYSTEM",
          name: "FIRECRAWL",
          issues: [],
          syncConfig: {},
        },
        credential: {
          scope: [],
          type: "API_KEY",
          value: {},
        },
      });
    }

    const siteCrawlTool = toolsRegistry<typeof tools>().get("siteCrawl");
    const toolResult = await siteCrawlTool.executor({
      agents,
      data,
      integrationsRegistry,
      llm,
    });

    const { crawlData, entityType } = toolResult;

    const recordsToPersist = crawlData?.flatMap(
      ({ markdown, metadata }: any) => {
        const chunks = splitMarkdownIntoChunks(markdown!);
        return chunks.map((c, i) => {
          return {
            externalId: `${metadata?.sourceURL}_chunk_${i}`,
            data: { markdown: c },
            entityType: entityType,
          };
        });
      }
    );

    await engine?.syncData({
      connectionId: "SYSTEM",
      data: recordsToPersist,
      name: "FIRECRAWL",
      type: entityType,
      properties: [
        {
          name: "markdown",
          type: PropertyType.LONG_TEXT,
          config: {},
          description: "The markdown content",
          displayName: "Markdown",
          modifiable: true,
          order: 1,
          visible: true,
        },
      ],
    });

    return {
      success: true,
      crawlData,
      entityType,
    };
  },
});
