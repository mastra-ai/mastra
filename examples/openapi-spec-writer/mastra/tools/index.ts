import { Agent, createTool, PropertyType } from "@mastra/core";
import { record, z } from "zod";
import { integrations } from "../integrations";
import { randomUUID } from "crypto";
import { GithubIntegration } from "@mastra/github";
import { FirecrawlIntegration } from "@mastra/firecrawl";

export const siteCrawl = createTool({
  label: "Site Crawl",
  schema: z.object({
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
  executor: async ({ data, integrationsRegistry, agents, engine, llm }) => {
    // const fireCrawlIntegration =
    //   integrationsRegistry<typeof integrations>().get("FIRECRAWL");

    const fireCrawlIntegration = integrationsRegistry().get(
      "FIRECRAWL"
    ) as FirecrawlIntegration;

    const client = await fireCrawlIntegration.getApiClient();

    console.log("Starting crawl", data.url);

    const res = await client.crawlUrls({
      body: {
        url: data.url,
        limit: data?.limit || 3,
        includePaths: [data.pathRegex],
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

    console.log("Crawl response", res);

    if (res.error) {
      console.error(JSON.stringify(res.error, null, 2));
      return { success: false, crawlData: [], entityType: "" };
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

      console.log(crawl.data);
    }

    const entityType = `CRAWL_${data.url}`;

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

export const generateSpec = createTool({
  label: "Generate Spec",
  schema: z.object({
    mastra_entity_type: z.string(),
  }),
  description: "Generate a spec from a website",
  executor: async ({ data, agents, engine }) => {
    const connection = await engine?.getConnection({
      connectionId: "SYSTEM",
      name: "FIRECRAWL",
    });

    const kId = connection?.id;

    if (!kId) {
      throw new Error("Connection not found");
    }

    console.log({
      mastra_entity_type: data.mastra_entity_type,
    });

    const crawledData = await engine?.getRecords({
      entityType: data.mastra_entity_type,
      kId: kId,
    });

    if (!crawledData) {
      throw new Error("No crawled data found");
    }

    const agent = agents?.get("openapi-spec-gen-agent");

    if (!agent) {
      throw new Error("Agent not found");
    }

    const openapiResponses = [];
    let mergedSpecAnswer = "";

    console.log("Crawled data", crawledData);

    for (const d of crawledData) {
      const data = await agent.text({
        messages: [
          `I wrote another page of docs, turn this into an Open API spec: ${d.data.markdown}`,
        ],
      });

      console.log("spec", { data });

      openapiResponses.push(data.text);
    }

    console.log(
      "inspect this, openapiResponses used to come back in structured output yaml"
    );
    console.log({ openapiResponses, agent, typeof: typeof agent });

    const mergedSpec = await agent?.text({
      messages: [
        `I have generated the following Open API specs: ${openapiResponses
          .map((r: any) => r)
          .join("\n\n")} - merge them into a single spec,
          `,
      ],
    });

    mergedSpecAnswer = mergedSpec.text
      .replace(/```yaml/g, "")
      .replace(/```/g, "");

    console.log(JSON.stringify(mergedSpec, null, 2));

    console.log(
      "MERGED SPEC ==================",
      JSON.stringify(mergedSpecAnswer, null, 2)
    );

    return { success: true, mergedSpec: mergedSpecAnswer };
  },
});

export const addToGitHub = createTool({
  label: "Add to Git",
  schema: z.object({
    yaml: z.string(),
    integration_name: z.string(),
    owner: z.string(),
    repo: z.string(),
    site_url: z.string(),
  }),
  description: "Commit the spec to GitHub",
  executor: async ({ data, integrationsRegistry, agents, engine }) => {
    // const githubIntegration =
    //   integrationsRegistry<typeof integrations>().get("GITHUB")

    const githubIntegration = integrationsRegistry().get(
      "GITHUB"
    ) as unknown as GithubIntegration;

    const client = await githubIntegration.getApiClient();

    const content = data.yaml;
    const integrationName = data.integration_name.toLowerCase();

    console.log("Writing to Github for", data.integration_name);
    const agent = agents?.get("openapi-spec-gen-agent");

    const d = await agent?.text({
      messages: [
        `Can you take this text blob and format it into proper YAML? ${content}`,
      ],
    });

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
          owner: data.owner,
          repo: data.repo,
        },
      });

      console.log({ data, mainRef });

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
            owner: data.owner,
            repo: data.repo,
          },
        });

        for (const [path, content] of Object.entries(reposPathMap)) {
          console.log({ path, content });
          await client.reposCreateOrUpdateFileContents({
            body: {
              message: `Add open api spec from ${data.site_url}`,
              content,
              branch: branchName,
            },
            path: {
              owner: data.owner,
              repo: data.repo,
              path,
            },
          });
        }

        const pullData = await client.pullsCreate({
          body: {
            title: `Add open api spec from ${data.site_url} for ${integrationName}`,
            head: branchName,
            base: "main",
          },
          path: {
            owner: data.owner,
            repo: data.repo,
          },
        });

        return { success: true, pr_url: pullData.data?.html_url };
      }
    }

    return { success: true };
  },
});
