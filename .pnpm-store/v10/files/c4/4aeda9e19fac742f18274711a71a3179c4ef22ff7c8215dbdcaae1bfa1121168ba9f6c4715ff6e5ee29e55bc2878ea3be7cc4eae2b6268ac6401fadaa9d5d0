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
var plannerTools_exports = {};
__export(plannerTools_exports, {
  setupPage: () => setupPage
});
module.exports = __toCommonJS(plannerTools_exports);
var import_bundle = require("../sdk/bundle");
var import_testTool = require("./testTool");
const setupPage = (0, import_testTool.defineTestTool)({
  schema: {
    name: "planner_setup_page",
    title: "Setup planner page",
    description: "Setup the page for test planning",
    inputSchema: import_bundle.z.object({
      project: import_bundle.z.string().optional().describe('Project to use for setup. For example: "chromium", if no project is provided uses the first project in the config.'),
      seedFile: import_bundle.z.string().optional().describe('A seed file contains a single test that is used to setup the page for testing, for example: "tests/seed.spec.ts". If no seed file is provided, a default seed file is created.')
    }),
    type: "readOnly"
  },
  handle: async (context, params, progress) => {
    const seed = await context.getOrCreateSeedFile(params.seedFile, params.project);
    await context.runSeedTest(seed.file, seed.projectName, progress);
    return { content: [] };
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  setupPage
});
