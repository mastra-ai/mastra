import { Step, Workflow } from "@mastra/core";
import { z } from "zod";
import { mastra } from "mastra";

const mintlifyCrawlWorkflow = new Step({
  id: "MINTLIFY_SITE_CRAWL",
  action: async ({ data, runId }) => {
    const res = await mastra.sync(
      "siteCrawlSync",
      {
        url: data.url,
        limit: 3,
        pathRegex: data.pathRegex ?? ".*",
      },
      runId
    );
    console.log("===sync res=====", {
      res,
    });
    return res;
  },
  inputSchema: z.object({
    url: z.string().describe("The URL of the website to crawl"),
    pathRegex: z.string().optional().describe("The regex to match the paths"),
    limit: z.number().optional().describe("The number of pages to crawl"),
  }),
  outputSchema: z.object({
    entityType: z.string().describe("The entity type to generate a spec for"),
  }),
  payload: {
    limit: 3,
  },
});

const generateMergedSpecStep = new Step({
  id: "GENERATE_MERGED_SPEC",
  action: async ({ data, runId }) => {
    const tool = mastra.getTool("generateSpec");
    return await tool.execute(
      {
        mastra_entity_type: data.entityType,
      },
      runId
    );
  },
  payload: {},
  inputSchema: z.object({
    entityType: z.string().describe("The entity type to generate a spec for"),
  }),
});

export const openApiSpecGenWorkflow = new Workflow({
  name: "openApiSpecGenWorkflow",
  steps: [mintlifyCrawlWorkflow, generateMergedSpecStep],
  triggerSchema: z.object({
    url: z.string().describe("The URL of the website to crawl"),
    pathRegex: z.string().optional().describe("The regex to match the paths"),
  }),
  logger: mastra.getLogger(),
})
  .step("MINTLIFY_SITE_CRAWL", {
    variables: {
      pathRegex: {
        path: "pathRegex",
        stepId: "trigger",
      },
      url: {
        path: "url",
        stepId: "trigger",
      },
    },
    transitions: {
      GENERATE_MERGED_SPEC: {},
    },
  })
  .step("GENERATE_MERGED_SPEC", {
    variables: {
      entityType: {
        stepId: "MINTLIFY_SITE_CRAWL",
        path: "entityType",
      },
    },
  });

openApiSpecGenWorkflow.commit();

const addToGitHubStep = new Step({
  id: "ADD_TO_GIT",
  action: async ({ data, runId }) => {
    const tool = mastra.getTool("addToGitHub");
    return tool.execute(
      {
        integration_name: data.integration_name,
        owner: data.owner,
        repo: data.repo,
        site_url: data.site_url,
        yaml: data.yaml,
      },
      runId
    );
  },
  payload: {
    owner: "mastra-ai",
    repo: "mastra",
  },
  inputSchema: z.object({
    yaml: z.string().describe("The Open API spec in YAML format"),
    integration_name: z.string().describe("The name of the integration to use"),
    site_url: z.string().describe("The URL of the website to crawl"),
    owner: z.string().describe("Owner of the repo"),
    repo: z.string().describe("Name of the repo"),
  }),
});

export const makePRToMastraWorkflow = new Workflow({
  name: "makePRToMastra",
  steps: [addToGitHubStep],
  triggerSchema: z.object({
    integration_name: z.string(),
    site_url: z.string().describe("The URL of the website to crawl"),
    owner: z.string().describe("Owner of the repo"),
    repo: z.string().describe("Name of the repo"),
    yaml: z.string().describe("The Open API spec in YAML format"),
  }),
  logger: mastra.getLogger(),
}).step("ADD_TO_GIT", {
  variables: {
    yaml: {
      path: "yaml",
      stepId: "trigger",
    },
    integration_name: {
      path: "integration_name",
      stepId: "trigger",
    },
    site_url: {
      path: "site_url",
      stepId: "trigger",
    },
  },
});

makePRToMastraWorkflow.commit();
