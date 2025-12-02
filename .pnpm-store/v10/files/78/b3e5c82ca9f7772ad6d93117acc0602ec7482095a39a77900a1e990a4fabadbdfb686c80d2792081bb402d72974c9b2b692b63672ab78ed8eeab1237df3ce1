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
var testContext_exports = {};
__export(testContext_exports, {
  GeneratorJournal: () => GeneratorJournal,
  TestContext: () => TestContext
});
module.exports = __toCommonJS(testContext_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_utils = require("playwright-core/lib/utils");
var import_base = require("../../reporters/base");
var import_list = __toESM(require("../../reporters/list"));
var import_streams = require("./streams");
var import_util = require("../../util");
var import_testRunner = require("../../runner/testRunner");
var import_seed = require("./seed");
class GeneratorJournal {
  constructor(rootPath, plan, seed) {
    this._rootPath = rootPath;
    this._plan = plan;
    this._seed = seed;
    this._steps = [];
  }
  logStep(title, code) {
    if (title)
      this._steps.push({ title, code });
  }
  journal() {
    const result = [];
    result.push(`# Plan`);
    result.push(this._plan);
    result.push(`# Seed file: ${import_path.default.relative(this._rootPath, this._seed.file)}`);
    result.push("```ts");
    result.push(this._seed.content);
    result.push("```");
    result.push(`# Steps`);
    result.push(this._steps.map((step) => `### ${step.title}
\`\`\`ts
${step.code}
\`\`\``).join("\n\n"));
    result.push(bestPracticesMarkdown);
    return result.join("\n\n");
  }
}
class TestContext {
  constructor(options) {
    this.options = options;
  }
  initialize(rootPath, configLocation) {
    this.configLocation = configLocation;
    this.rootPath = rootPath || configLocation.configDir;
  }
  existingTestRunner() {
    return this._testRunner;
  }
  async createTestRunner() {
    if (this._testRunner)
      await this._testRunner.stopTests();
    const testRunner = new import_testRunner.TestRunner(this.configLocation, {});
    await testRunner.initialize({});
    this._testRunner = testRunner;
    testRunner.on(import_testRunner.TestRunnerEvent.TestFilesChanged, (testFiles) => {
      this._testRunner?.emit(import_testRunner.TestRunnerEvent.TestFilesChanged, testFiles);
    });
    this._testRunner = testRunner;
    return testRunner;
  }
  async getOrCreateSeedFile(seedFile, projectName) {
    const configDir = this.configLocation.configDir;
    const testRunner = await this.createTestRunner();
    const config = await testRunner.loadConfig();
    const project = (0, import_seed.seedProject)(config, projectName);
    if (!seedFile) {
      seedFile = await (0, import_seed.ensureSeedTest)(project, false);
    } else {
      const candidateFiles = [];
      const testDir = project.project.testDir;
      candidateFiles.push(import_path.default.resolve(testDir, seedFile));
      candidateFiles.push(import_path.default.resolve(configDir, seedFile));
      candidateFiles.push(import_path.default.resolve(this.rootPath, seedFile));
      let resolvedSeedFile;
      for (const candidateFile of candidateFiles) {
        if (await (0, import_util.fileExistsAsync)(candidateFile)) {
          resolvedSeedFile = candidateFile;
          break;
        }
      }
      if (!resolvedSeedFile)
        throw new Error("seed test not found.");
      seedFile = resolvedSeedFile;
    }
    const seedFileContent = await import_fs.default.promises.readFile(seedFile, "utf8");
    return {
      file: seedFile,
      content: seedFileContent,
      projectName: project.project.name
    };
  }
  async runSeedTest(seedFile, projectName, progress) {
    const { screen } = this.createScreen(progress);
    const configDir = this.configLocation.configDir;
    const reporter = new import_list.default({ configDir, screen });
    const testRunner = await this.createTestRunner();
    const result = await testRunner.runTests(reporter, {
      headed: !this.options?.headless,
      locations: ["/" + (0, import_utils.escapeRegExp)(seedFile) + "/"],
      projects: [projectName],
      timeout: 0,
      workers: 1,
      pauseAtEnd: true,
      disableConfigReporters: true,
      failOnLoadErrors: true
    });
    if (result.status === "passed" && !reporter.suite?.allTests().length)
      throw new Error("seed test not found.");
    if (result.status !== "passed")
      throw new Error("Errors while running the seed test.");
  }
  createScreen(progress) {
    const stream = new import_streams.StringWriteStream(progress);
    const screen = {
      ...import_base.terminalScreen,
      isTTY: false,
      colors: import_utils.noColors,
      stdout: stream,
      stderr: stream
    };
    return { screen, stream };
  }
  async close() {
  }
}
const bestPracticesMarkdown = `
# Best practices
- Do not improvise, do not add directives that were not asked for
- Use clear, descriptive assertions to validate the expected behavior
- Use reliable locators from this log
- Use local variables for locators that are used multiple times
- Use Playwright waiting assertions and best practices from this log
- NEVER! use page.waitForLoadState()
- NEVER! use page.waitForNavigation()
- NEVER! use page.waitForTimeout()
- NEVER! use page.evaluate()
`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GeneratorJournal,
  TestContext
});
