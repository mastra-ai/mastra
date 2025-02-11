import { Workflow, Step } from "@mastra/core/workflows";
import { z } from "zod";
import { addToGitHubTool, generateSpecTool, siteCrawlTool } from "../tools";
import { MDocument } from "@mastra/rag";

const syncStep = new Step({
  id: "site-crawl-sync-step",
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
  execute: async ({ context, runId, suspend }) => {
    const toolResult = await siteCrawlTool.execute({
      context: context?.triggerData,
      runId,
      suspend,
    });

    const { crawlData, entityType } = toolResult;

    if (!crawlData) {
      return {
        success: false,
        crawlData: [],
        entityType: "",
      };
    }

    // const recordsToPersist = await Promise.all(
    //   crawlData?.flatMap(async ({ markdown, metadata }) => {
    //     const doc = MDocument.fromMarkdown(markdown, metadata);

    //     await doc.chunk({
    //       strategy: "markdown",
    //       maxSize: 8190,
    //     });

    //     const chunks = doc.getDocs();

    //     return chunks.map((c, i) => {
    //       return {
    //         externalId: `${c.metadata?.sourceURL}_chunk_${i}`,
    //         data: { markdown: c.text },
    //       };
    //     });
    //   })
    // );

    return {
      success: true,
      crawlData,
      entityType,
    };
  },
});

export const openApiSpecGenWorkflow = new Workflow({
  name: "openApiSpecGenWorkflow",
  triggerSchema: z.object({
    url: z.string().describe("The URL of the website to crawl"),
    pathRegex: z.string().optional().describe("The regex to match the paths"),
  }),
})
  .step(syncStep, {
    variables: {
      pathRegex: {
        path: "pathRegex",
        step: "trigger",
      },
      url: {
        path: "url",
        step: "trigger",
      },
    },
  })
  .then(generateSpecTool, {
    variables: {
      mastra_entity_type: {
        step: syncStep,
        path: "entityType",
      },
    },
  });

openApiSpecGenWorkflow.commit();

export const makePRToMastraWorkflow = new Workflow({
  name: "makePRToMastra",
  triggerSchema: z.object({
    integration_name: z.string(),
    site_url: z.string().describe("The URL of the website to crawl"),
    owner: z.string().describe("Owner of the repo"),
    repo: z.string().describe("Name of the repo"),
    yaml: z.string().describe("The Open API spec in YAML format"),
  }),
}).step(addToGitHubTool, {
  variables: {
    yaml: {
      path: "yaml",
      step: "trigger",
    },
    integration_name: {
      path: "integration_name",
      step: "trigger",
    },
    site_url: {
      path: "site_url",
      step: "trigger",
    },
  },
});

makePRToMastraWorkflow.commit();
