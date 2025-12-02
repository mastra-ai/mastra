"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var seed_exports = {};
__export(seed_exports, {
  ensureSeedTest: () => ensureSeedTest,
  seedProject: () => seedProject
});
module.exports = __toCommonJS(seed_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_utils = require("playwright-core/lib/utils");
var import_projectUtils = require("../../runner/projectUtils");
function seedProject(config, projectName) {
  if (!projectName)
    return (0, import_projectUtils.findTopLevelProjects)(config)[0];
  const project = config.projects.find((p) => p.project.name === projectName);
  if (!project)
    throw new Error(`Project ${projectName} not found`);
  return project;
}
async function ensureSeedTest(project, logNew) {
  const files = await (0, import_projectUtils.collectFilesForProject)(project);
  const seed = files.find((file) => import_path.default.basename(file).includes("seed"));
  if (seed)
    return seed;
  const testDir = project.project.testDir;
  const seedFile = import_path.default.resolve(testDir, "seed.spec.ts");
  if (logNew) {
    console.log(`Writing file: ${import_path.default.relative(process.cwd(), seedFile)}`);
  }
  await (0, import_utils.mkdirIfNeeded)(seedFile);
  await import_fs.default.promises.writeFile(seedFile, `import { test, expect } from '@playwright/test';

test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    // generate code here.
  });
});
`);
  return seedFile;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ensureSeedTest,
  seedProject
});
