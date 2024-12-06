"use server";

import { BaseLogMessage } from "@mastra/core";
import { mastra } from "../mastra";
import {
  makePRToMastraWorkflow,
  openApiSpecGenWorkflow,
} from "mastra/workflows";

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
    const res = await openApiSpecGenWorkflow.execute({
      url,
      pathRegex: crawlOptions.pathRegex,
    });

    console.log({
      data: res.results["GENERATE_MERGED_SPEC"],
    });

    const openApiSpec = (res.results["GENERATE_MERGED_SPEC"] as any)
      ?.mergedSpec;

    const logs = await mastra.getLogsByRunId(res.runId);

    return { message: "successful", data: openApiSpec, logs: logs.reverse() };
  } catch (error: unknown) {
    const { runId, message } = error as { runId: string; message: string };
    const logs = await mastra.getLogsByRunId(runId);
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
    const res = await makePRToMastraWorkflow.execute({
      integration_name: integrationName,
      site_url: crawledUrl,
      owner: "mastra",
      repo: "mastra",
      yaml,
    });

    const prUrl = (res.results["ADD_TO_GIT"] as any)?.pr_url;

    const pr_url = prUrl;

    const logs = await mastra.getLogsByRunId(res.runId);

    return { message: "successful", data: pr_url, logs: logs.reverse() };
  } catch (error: unknown) {
    const { runId, message } = error as { runId: string; message: string };
    const logs = await mastra.getLogsByRunId(runId);
    return { message: "failed", data: message, logs };
  }
}
