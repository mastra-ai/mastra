"use server";

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
    }
  | {
      message: "successful";
      data: unknown;
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

    return { message: "successful", data: openApiSpec };
  } catch (e) {
    return { message: "failed", data: JSON.stringify(e) };
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

    return { message: "successful", data: pr_url };
  } catch (e) {
    return { message: "failed", data: JSON.stringify(e) };
  }
}
