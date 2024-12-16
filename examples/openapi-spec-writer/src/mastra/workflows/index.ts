import { Workflow } from "@mastra/core";
import { z } from "zod";
import { siteCrawlSync } from "../syncs";
import { addToGitHubTool, generateSpecTool } from "../tools";

export const openApiSpecGenWorkflow = new Workflow({
  name: "openApiSpecGenWorkflow",
  triggerSchema: z.object({
    url: z.string().describe("The URL of the website to crawl"),
    pathRegex: z.string().optional().describe("The regex to match the paths"),
  }),
})
  .step(siteCrawlSync, {
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
        step: siteCrawlSync,
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
