import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { firecrawl, github } from "../integrations";
import { randomUUID } from "crypto";

export const siteCrawlTool = createTool({
  id: "site-crawl",
  label: "Site Crawl",
  inputSchema: z.object({
    url: z.string(),
    pathRegex: z.string(),
    limit: z.number(),
  }),
  description: "Crawl a website and extract the markdown content",
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
  execute: async (inputData) => {
    const client = await firecrawl.getApiClient();

    console.log("Starting crawl", inputData.url);

    const res = await client.crawlUrls({
      body: {
        url: inputData.url,
        limit: inputData.limit || 3,
        includePaths: [inputData.pathRegex],
        scrapeOptions: {
          formats: ["markdown"],
          includeTags: ["main"],
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

    const entityType = `CRAWL_${inputData.url}`;

    return {
      success: true,
      crawlData: (crawl?.data?.data || []).map((item) => ({
        markdown: item.markdown || "",
        metadata: {
          sourceURL: item?.metadata?.sourceURL || "",
          ...item.metadata,
        },
      })),
      entityType: entityType,
    };
  },
});

export const generateSpecTool = createTool({
  id: "generate-spec",
  label: "Generate Spec",
  inputSchema: z.object({
    mastra_entity_type: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mergedSpec: z.string(),
  }),
  description: "Generate a spec from a website",
  execute: async (inputData, context) => {
    const crawledData =
      context?.workflow?.state?.steps?.["site-crawl"]?.status === "success"
        ? context?.workflow?.state?.steps?.["site-crawl"]?.output?.crawlData
        : [];

    if (!crawledData) {
      throw new Error("No crawled data found");
    }

    const agent = context?.mastra?.agents?.["openapi-spec-gen-agent"];

    if (!agent) {
      throw new Error("Agent not found");
    }

    const openapiResponses = [];
    let mergedSpecAnswer = "";

    for (const d of crawledData) {
      const data = await agent.generate(
        `I wrote another page of docs, turn this into an Open API spec: ${d.data.markdown}`,
        { runId: context?.workflow?.runId }
      );

      openapiResponses.push(data.text);
    }

    console.log(
      "inspect this, openapiResponses used to come back in structured output yaml"
    );

    const mergedSpec = await agent?.generate(
      `I have generated the following Open API specs: ${openapiResponses
        .map((r) => r)
        .join("\n\n")} - merge them into a single spec,
          `,
      { runId: context?.workflow?.runId }
    );

    mergedSpecAnswer = mergedSpec.text
      .replace(/```yaml/g, "")
      .replace(/```/g, "");

    console.log(
      "MERGED SPEC ==================",
      JSON.stringify(mergedSpecAnswer, null, 2)
    );

    return { success: true, mergedSpec: mergedSpecAnswer };
  },
});

export const addToGitHubTool = createTool({
  id: "add-to-github",
  label: "Add to Git",
  inputSchema: z.object({
    yaml: z.string(),
    integration_name: z.string(),
    owner: z.string(),
    repo: z.string(),
    site_url: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    pr_url: z.string().optional(),
  }),
  description: "Commit the spec to GitHub",
  execute: async (inputData, context) => {
    const client = await github.getApiClient();

    const content = inputData.yaml;
    const integrationName = inputData.integration_name.toLowerCase();

    console.log("Writing to Github for", inputData.integration_name);
    const agent = context?.mastra?.agents?.["openapi-spec-gen-agent"];

    const d = await agent?.generate(
      `Can you take this text blob and format it into proper YAML? ${content}`,
      { runId: context?.workflow?.runId }
    );

    if (!d) {
      console.error("Agent failed to process the text blob");
      return { success: false };
    }

    if (Array.isArray(d.toolCalls)) {
      const answer = d.text;
      const strippedYaml = answer.replace(/```yaml/g, "").replace(/```/g, "");

      const base64Content = Buffer.from(strippedYaml).toString("base64");

      const reposPathMap = {
        [`integrations-next/${integrationName}/openapi.yaml`]: base64Content,
        [`integrations-next/${integrationName}/README.md`]: Buffer.from(
          `# ${integrationName}\n\nThis repo contains the Open API spec for the ${integrationName} integration`
        ).toString("base64"),
      };

      const mainRef = await client.gitGetRef({
        path: {
          ref: "heads/main",
          owner: inputData.owner,
          repo: inputData.repo,
        },
      });

      console.log({ input, mainRef });

      const mainSha = mainRef.data?.object?.sha;

      console.log("Main SHA", mainSha);

      const branchName = `open-api-spec-writer/${integrationName}-${randomUUID()}`;

      console.log("Branch name", branchName);

      if (mainSha) {
        await client.gitCreateRef({
          body: {
            ref: `refs/heads/${branchName}`,
            sha: mainSha,
          },
          path: {
            owner: inputData.owner,
            repo: inputData.repo,
          },
        });

        for (const [path, content] of Object.entries(reposPathMap)) {
          console.log({ path, content });
          await client.reposCreateOrUpdateFileContents({
            body: {
              message: `Add open api spec from ${inputData.site_url}`,
              content,
              branch: branchName,
            },
            path: {
              owner: inputData.owner,
              repo: inputData.repo,
              path,
            },
          });
        }

        const pullData = await client.pullsCreate({
          body: {
            title: `Add open api spec from ${inputData.site_url} for ${integrationName}`,
            head: branchName,
            base: "main",
          },
          path: {
            owner: inputData.owner,
            repo: inputData.repo,
          },
        });

        return { success: true, pr_url: pullData.data?.html_url };
      }
    }

    return { success: true };
  },
});
