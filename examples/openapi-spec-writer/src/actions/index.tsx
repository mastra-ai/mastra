"use server";

import { BaseLogMessage } from "@mastra/core/logger";
import { mastra } from "../mastra";

export async function generateOpenApiSpec({
  url,
  crawlOptions,
}: {
  url: string;
  crawlOptions: {
    pathRegex: string;
  };
}): Promise<
  | {
      message: "failed";
      data: string;
      logs: BaseLogMessage[];
    }
  | {
      message: "successful";
      data: unknown;
      logs: BaseLogMessage[];
    }
> {
  try {
    const openApiSpecGenWorkflow = await mastra
      .getWorkflow("openApiSpecGenWorkflow")
      .createRunAsync();
    const res = await openApiSpecGenWorkflow.start({
      triggerData: {
        url,
        pathRegex: crawlOptions.pathRegex,
      },
    });

    const openApiSpec = (
      res.results["generate-spec"] as { payload: { mergedSpec: string } }
    )?.output?.mergedSpec;

    const logs =
      (await mastra.getLogsByRunId({
        runId: res.runId,
        transportId: "upstash",
      })) || [];

    return { message: "successful", data: openApiSpec, logs: logs.reverse() };
  } catch (error: unknown) {
    const { runId, message } = error as { runId: string; message: string };
    const logs =
      (await mastra.getLogsByRunId({ runId, transportId: "upstash" })) || [];
    return { message: "failed", data: message, logs };
  }
}

export async function makeMastraPR({
  crawledUrl,
  yaml,
  integrationName,
}: {
  yaml: string;
  crawledUrl: string;
  integrationName: string;
}) {
  try {
    const makePRToMastraWorkflow = await mastra
      .getWorkflow("makePRToMastraWorkflow")
      .createRunAsync();
    const res = await makePRToMastraWorkflow.start({
      triggerData: {
        integration_name: integrationName,
        site_url: crawledUrl,
        owner: "mastra",
        repo: "mastra",
        yaml,
      },
    });

    const prUrl = (
      res.results["add-to-github"] as { payload: { pr_url: string } }
    )?.output?.pr_url;

    const pr_url = prUrl;

    const logs =
      (await mastra.getLogsByRunId({
        runId: res.runId,
        transportId: "upstash",
      })) || [];

    return { message: "successful", data: pr_url, logs: logs.reverse() };
  } catch (error: unknown) {
    const { runId, message } = error as { runId: string; message: string };
    const logs =
      (await mastra.getLogsByRunId({ runId, transportId: "upstash" })) || [];
    return { message: "failed", data: message, logs };
  }
}
