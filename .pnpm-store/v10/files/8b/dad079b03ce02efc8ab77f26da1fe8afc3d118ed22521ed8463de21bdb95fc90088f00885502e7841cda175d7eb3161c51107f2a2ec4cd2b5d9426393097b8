import { encodeDeploymentSelector, RequestContext } from "../requestContext.js";
import {
  DeploymentSelectionWithinProject,
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials,
} from "../../api.js";
import { z } from "zod";
import { ConvexTool } from "./index.js";
import { deploymentDashboardUrlPage } from "../../../lib/dashboard.js";
import { getDeploymentSelection } from "../../../lib/deploymentSelection.js";

const projectDirDescription = `
The root directory of the Convex project. This is usually the editor's workspace directory
and often includes the 'package.json' file and the 'convex/' folder.

Pass this option unless explicitly instructed not to.
`;

const inputSchema = z.object({
  projectDir: z.string().optional().describe(projectDirDescription),
});
const outputSchema = z.object({
  availableDeployments: z.array(
    z.object({
      kind: z.string(),
      deploymentSelector: z.string(),
      url: z.string(),
      dashboardUrl: z.string().optional(),
    }),
  ),
});

const description = `
Get all available deployments for a given Convex project directory.

Use this tool to find the deployment selector, URL, and dashboard URL for each
deployment associated with the project. Pass the deployment selector to other
tools to target a specific deployment.

When deployed to Convex Cloud, projects have a development ({"kind": "ownDev"}) and
production ({"kind": "prod"}) deployment. Generally default to using the development
deployment unless you'd specifically like to debug issues in production.

When running locally, there will be a single "urlWithAdminKey" deployment.
`.trim();

export const StatusTool: ConvexTool<typeof inputSchema, typeof outputSchema> = {
  name: "status",
  description,
  inputSchema,
  outputSchema,
  handler: async (ctx: RequestContext, input) => {
    const projectDir = input.projectDir ?? ctx.options.projectDir;
    if (projectDir === undefined) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage:
          "No project directory provided. Either provide the `projectDir` argument or configure the MCP server with the `--project-dir` flag.",
      });
    }
    process.chdir(projectDir);
    const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(
      ctx.options,
    );
    const deploymentSelection = await getDeploymentSelection(ctx, ctx.options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      selectionWithinProject,
    );
    let availableDeployments = [
      {
        kind: selectionWithinProject.kind,
        deploymentSelector: encodeDeploymentSelector(
          projectDir,
          selectionWithinProject,
        ),
        url: credentials.url,
        dashboardUrl:
          credentials.deploymentFields?.deploymentName &&
          deploymentDashboardUrlPage(
            credentials.deploymentFields.deploymentName,
            "",
          ),
      },
    ];
    // Also get the prod cloud deployment if we're using a cloud-hosted dev-deployment
    if (
      selectionWithinProject.kind === "ownDev" &&
      !(
        deploymentSelection.kind === "existingDeployment" &&
        deploymentSelection.deploymentToActOn.deploymentFields === null
      )
    ) {
      const prodDeployment: DeploymentSelectionWithinProject = { kind: "prod" };
      const prodCredentials = await loadSelectedDeploymentCredentials(
        ctx,
        deploymentSelection,
        prodDeployment,
      );
      if (
        prodCredentials.deploymentFields?.deploymentName &&
        prodCredentials.deploymentFields.deploymentType
      ) {
        availableDeployments.push({
          kind: prodDeployment.kind,
          deploymentSelector: encodeDeploymentSelector(
            projectDir,
            prodDeployment,
          ),
          url: prodCredentials.url,
          dashboardUrl: deploymentDashboardUrlPage(
            prodCredentials.deploymentFields.deploymentName,
            "",
          ),
        });
      }
    }
    if (ctx.productionDeploymentsDisabled) {
      availableDeployments = availableDeployments.filter(
        (d) => d.kind !== "prod",
      );
    }
    return { availableDeployments };
  },
};
