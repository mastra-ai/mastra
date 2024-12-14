import { createSync } from "@mastra/core";
import { MastraDocument } from "@mastra/rag";
import { z } from "zod";
import * as tools from "../tools";

export const siteCrawlSync = createSync({
  id: "site-crawl-sync",
  label: "Site Crawl Sync",
  inputSchema: z.object({
    url: z.string(),
    pathRegex: z.string(),
    limit: z.number(),
  }),
  outputSchema: z.object({
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
  execute: async ({ context, engine, runId }) => {
    const toolResult = await tools.siteCrawlTool.execute({
      context,
      runId,
    });

    const { crawlData, entityType } = toolResult;

    if (!crawlData) {
      return {
        success: false,
        crawlData: [],
        entityType: "",
      };
    }

    const recordsToPersist = await Promise.all(
      crawlData?.flatMap(async ({ markdown, metadata }) => {
        const doc = MastraDocument.fromMarkdown(markdown, metadata);

        await doc.chunk({
          strategy: "markdown",
          options: {
            maxChunkSize: 8190,
          },
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
  },
  payload: {
    limit: 3,
  },
});
