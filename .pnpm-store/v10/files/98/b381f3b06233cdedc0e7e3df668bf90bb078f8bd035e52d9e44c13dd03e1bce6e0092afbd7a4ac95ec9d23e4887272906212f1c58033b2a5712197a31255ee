"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var status_exports = {};
__export(status_exports, {
  StatusTool: () => StatusTool
});
module.exports = __toCommonJS(status_exports);
var import_requestContext = require("../requestContext.js");
var import_api = require("../../api.js");
var import_zod = require("zod");
var import_dashboard = require("../../../lib/dashboard.js");
var import_deploymentSelection = require("../../../lib/deploymentSelection.js");
const projectDirDescription = `
The root directory of the Convex project. This is usually the editor's workspace directory
and often includes the 'package.json' file and the 'convex/' folder.

Pass this option unless explicitly instructed not to.
`;
const inputSchema = import_zod.z.object({
  projectDir: import_zod.z.string().optional().describe(projectDirDescription)
});
const outputSchema = import_zod.z.object({
  availableDeployments: import_zod.z.array(
    import_zod.z.object({
      kind: import_zod.z.string(),
      deploymentSelector: import_zod.z.string(),
      url: import_zod.z.string(),
      dashboardUrl: import_zod.z.string().optional()
    })
  )
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
const StatusTool = {
  name: "status",
  description,
  inputSchema,
  outputSchema,
  handler: async (ctx, input) => {
    const projectDir = input.projectDir ?? ctx.options.projectDir;
    if (projectDir === void 0) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No project directory provided. Either provide the `projectDir` argument or configure the MCP server with the `--project-dir` flag."
      });
    }
    process.chdir(projectDir);
    const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(
      ctx.options
    );
    const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, ctx.options);
    const credentials = await (0, import_api.loadSelectedDeploymentCredentials)(
      ctx,
      deploymentSelection,
      selectionWithinProject
    );
    let availableDeployments = [
      {
        kind: selectionWithinProject.kind,
        deploymentSelector: (0, import_requestContext.encodeDeploymentSelector)(
          projectDir,
          selectionWithinProject
        ),
        url: credentials.url,
        dashboardUrl: credentials.deploymentFields?.deploymentName && (0, import_dashboard.deploymentDashboardUrlPage)(
          credentials.deploymentFields.deploymentName,
          ""
        )
      }
    ];
    if (selectionWithinProject.kind === "ownDev" && !(deploymentSelection.kind === "existingDeployment" && deploymentSelection.deploymentToActOn.deploymentFields === null)) {
      const prodDeployment = { kind: "prod" };
      const prodCredentials = await (0, import_api.loadSelectedDeploymentCredentials)(
        ctx,
        deploymentSelection,
        prodDeployment
      );
      if (prodCredentials.deploymentFields?.deploymentName && prodCredentials.deploymentFields.deploymentType) {
        availableDeployments.push({
          kind: prodDeployment.kind,
          deploymentSelector: (0, import_requestContext.encodeDeploymentSelector)(
            projectDir,
            prodDeployment
          ),
          url: prodCredentials.url,
          dashboardUrl: (0, import_dashboard.deploymentDashboardUrlPage)(
            prodCredentials.deploymentFields.deploymentName,
            ""
          )
        });
      }
    }
    if (ctx.productionDeploymentsDisabled) {
      availableDeployments = availableDeployments.filter(
        (d) => d.kind !== "prod"
      );
    }
    return { availableDeployments };
  }
};
//# sourceMappingURL=status.js.map
