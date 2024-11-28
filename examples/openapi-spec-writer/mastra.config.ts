import { GithubIntegration } from "@mastra/github";
import { FirecrawlIntegration } from "@mastra/firecrawl";
import { Config } from "@mastra/core";
import { z } from "zod";
import {
  mintlifySiteCrawler,
  generateMergedSpec,
  addToGit,
} from "./mastra/tools";

const SLACK_REDIRECT_URI =
  "https://redirectmeto.com/http://localhost:3456/api/mastra/connect/callback";

export const config: Config = {
  name: "openapi-spec-writer",
  integrations: [
    new GithubIntegration(),

    new FirecrawlIntegration({
      config: {
        API_KEY: process.env.FIRECRAWL_API_KEY!,
      },
    }),
  ],
  db: {
    provider: "postgres",
    uri: process.env.DB_URL!,
  },
  runner: {
    provider: "inngest",
    uri: process.env.INNGEST_URL!,
    // signingKey: process.env.INNGEST_SIGNING_KEY!,
    // eventKey: process.env.INNGEST_EVENT_KEY!,
  },
  workflows: {
    blueprintDirPath: "/mastra/blueprints",
    systemEvents: {
      WRITE_SPEC: {
        label: "Write Spec",
        key: "WRITE_SPEC",
        schema: z.object({
          integration_name: z
            .string()
            .describe("The name of the integration to use"),
          url: z.string().describe("The URL of the website to crawl"),
          pathRegex: z.string().describe("The regex to match the path"),
        }),
      },
      PR_TO_MASTRA: {
        label: "PR to Mastra",
        key: "PR_TO_MASTRA",
        schema: z.object({
          yaml: z.string().describe("The Open API spec in YAML format"),
          url: z.string().describe("The URL of the website crawled"),
          integrationName: z.string().describe("The name of the integration"),
        }),
      },
    },
    systemApis: [addToGit, generateMergedSpec, mintlifySiteCrawler],
  },
  agents: {
    agentDirPath: "/mastra/agents",
    vectorProvider: [],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: "/api/mastra",
};
