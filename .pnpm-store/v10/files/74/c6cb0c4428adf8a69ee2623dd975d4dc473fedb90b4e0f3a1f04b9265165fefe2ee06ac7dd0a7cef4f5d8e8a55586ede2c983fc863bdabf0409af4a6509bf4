"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var utils_exports = {};
__export(utils_exports, {
  CONVEX_DEPLOYMENT_ENV_VAR_NAME: () => CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  CONVEX_DEPLOY_KEY_ENV_VAR_NAME: () => CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
  CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME: () => CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME,
  CONVEX_SELF_HOSTED_URL_VAR_NAME: () => CONVEX_SELF_HOSTED_URL_VAR_NAME,
  ENV_VAR_FILE_PATH: () => ENV_VAR_FILE_PATH,
  ThrowingFetchError: () => ThrowingFetchError,
  bareDeploymentFetch: () => bareDeploymentFetch,
  bigBrainAPI: () => bigBrainAPI,
  bigBrainAPIMaybeThrows: () => bigBrainAPIMaybeThrows,
  bigBrainFetch: () => bigBrainFetch,
  cacheDir: () => cacheDir,
  currentPackageHomepage: () => currentPackageHomepage,
  deploymentFetch: () => deploymentFetch,
  deprecationCheckWarning: () => deprecationCheckWarning,
  ensureHasConvexDependency: () => ensureHasConvexDependency,
  findParentConfigs: () => findParentConfigs,
  formatDuration: () => formatDuration,
  formatSize: () => formatSize,
  functionsDir: () => functionsDir,
  getCurrentTimeString: () => getCurrentTimeString,
  hasProject: () => hasProject,
  hasProjects: () => hasProjects,
  hasTeam: () => hasTeam,
  isInExistingProject: () => isInExistingProject,
  isWebContainer: () => isWebContainer,
  loadPackageJson: () => loadPackageJson,
  logAndHandleFetchError: () => logAndHandleFetchError,
  parseInteger: () => parseInteger,
  parsePositiveInteger: () => parsePositiveInteger,
  poll: () => poll,
  processDeployKeyValue: () => processDeployKeyValue,
  productionProvisionHost: () => productionProvisionHost,
  provisionHost: () => provisionHost,
  rootDirectory: () => rootDirectory,
  selectDevDeploymentType: () => selectDevDeploymentType,
  sorted: () => sorted,
  spawnAsync: () => spawnAsync,
  throwingFetch: () => throwingFetch,
  typedBigBrainClient: () => typedBigBrainClient,
  validateOrSelectProject: () => validateOrSelectProject,
  validateOrSelectTeam: () => validateOrSelectTeam,
  waitForever: () => waitForever,
  waitUntilCalled: () => waitUntilCalled
});
module.exports = __toCommonJS(utils_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_os = __toESM(require("os"), 1);
var import_path = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_commander = require("commander");
var import_fetch_retry = __toESM(require("fetch-retry"), 1);
var import_log = require("../../../bundler/log.js");
var import_version = require("../../version.js");
var import_prompts = require("./prompts.js");
var import_bigBrain = require("../localDeployment/bigBrain.js");
var import_openapi_fetch = __toESM(require("openapi-fetch"), 1);
const retryingFetch = (0, import_fetch_retry.default)(fetch);
const productionProvisionHost = "https://api.convex.dev";
const provisionHost = process.env.CONVEX_PROVISION_HOST || productionProvisionHost;
const BIG_BRAIN_URL = `${provisionHost}/api/`;
const ENV_VAR_FILE_PATH = ".env.local";
const CONVEX_DEPLOY_KEY_ENV_VAR_NAME = "CONVEX_DEPLOY_KEY";
const CONVEX_DEPLOYMENT_ENV_VAR_NAME = "CONVEX_DEPLOYMENT";
const CONVEX_SELF_HOSTED_URL_VAR_NAME = "CONVEX_SELF_HOSTED_URL";
const CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME = "CONVEX_SELF_HOSTED_ADMIN_KEY";
const MAX_RETRIES = 6;
const RETRY_LOG_THRESHOLD = 3;
async function processDeployKeyValue(ctx, deployKey) {
  if (deployKey === void 0) {
    return void 0;
  }
  if (deployKey === "<ignore_deploy_key>") {
    return void 0;
  }
  const missingKeyPattern = /^<missing_deploy_key:(.+)>$/;
  const match = deployKey.match(missingKeyPattern);
  if (match) {
    const errorMessage = match[1];
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: errorMessage
    });
  }
  return deployKey;
}
function parsePositiveInteger(value) {
  const parsedValue = parseInteger(value);
  if (parsedValue <= 0) {
    throw new import_commander.InvalidArgumentError("Not a positive number.");
  }
  return parsedValue;
}
function parseInteger(value) {
  const parsedValue = +value;
  if (isNaN(parsedValue)) {
    throw new import_commander.InvalidArgumentError("Not a number.");
  }
  return parsedValue;
}
class ThrowingFetchError extends Error {
  constructor(msg, {
    code,
    message,
    response
  }) {
    var __super = (...args) => {
      super(...args);
      __publicField(this, "response");
      __publicField(this, "serverErrorData");
      return this;
    };
    if (code !== void 0 && message !== void 0) {
      __super(`${msg}: ${code}: ${message}`);
      this.serverErrorData = { code, message };
    } else {
      __super(msg);
    }
    Object.setPrototypeOf(this, ThrowingFetchError.prototype);
    this.response = response;
  }
  static async fromResponse(response, msg) {
    msg = `${msg ? `${msg} ` : ""}${response.status} ${response.statusText}`;
    let code, message;
    try {
      ({ code, message } = await response.json());
    } catch {
    }
    return new ThrowingFetchError(msg, { code, message, response });
  }
  async handle(ctx) {
    let error_type = "transient";
    await checkFetchErrorForDeprecation(ctx, this.response);
    let msg = this.message;
    if (this.response.status === 400) {
      error_type = "invalid filesystem or env vars";
    } else if (this.response.status === 401) {
      error_type = "fatal";
      msg = `${msg}
Authenticate with \`npx convex dev\``;
    } else if (this.response.status === 404) {
      error_type = "fatal";
      msg = `${msg}: ${this.response.url}`;
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: error_type,
      errForSentry: this,
      printedMessage: import_chalk.default.red(msg.trim())
    });
  }
}
async function throwingFetch(resource, options) {
  const Headers2 = globalThis.Headers;
  const headers = new Headers2((options || {})["headers"]);
  if (options?.body) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }
  const response = await retryingFetch(resource, options);
  if (!response.ok) {
    throw await ThrowingFetchError.fromResponse(
      response,
      `Error fetching ${options?.method ? options.method + " " : ""} ${typeof resource === "string" ? resource : "url" in resource ? resource.url : resource.toString()}`
    );
  }
  return response;
}
async function logAndHandleFetchError(ctx, err) {
  (0, import_log.failExistingSpinner)();
  if (err instanceof ThrowingFetchError) {
    return await err.handle(ctx);
  } else {
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: err,
      printedMessage: import_chalk.default.red(err)
    });
  }
}
function logDeprecationWarning(ctx, deprecationMessage) {
  if (ctx.deprecationMessagePrinted) {
    return;
  }
  ctx.deprecationMessagePrinted = true;
  (0, import_log.logWarning)(import_chalk.default.yellow(deprecationMessage));
}
async function checkFetchErrorForDeprecation(ctx, resp) {
  const headers = resp.headers;
  if (headers) {
    const deprecationState = headers.get("x-convex-deprecation-state");
    const deprecationMessage = headers.get("x-convex-deprecation-message");
    switch (deprecationState) {
      case null:
        break;
      case "Deprecated":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: import_chalk.default.red(deprecationMessage)
        });
      default:
        logDeprecationWarning(
          ctx,
          deprecationMessage || "(no deprecation message included)"
        );
        break;
    }
  }
}
function deprecationCheckWarning(ctx, resp) {
  const headers = resp.headers;
  if (headers) {
    const deprecationState = headers.get("x-convex-deprecation-state");
    const deprecationMessage = headers.get("x-convex-deprecation-message");
    switch (deprecationState) {
      case null:
        break;
      case "Deprecated":
        throw new Error(
          "Called deprecationCheckWarning on a fatal error. This is a bug."
        );
      default:
        logDeprecationWarning(
          ctx,
          deprecationMessage || "(no deprecation message included)"
        );
        break;
    }
  }
}
async function hasTeam(ctx, teamSlug) {
  const teams = await bigBrainAPI({ ctx, method: "GET", url: "teams" });
  return teams.some((team) => team.slug === teamSlug);
}
async function validateOrSelectTeam(ctx, teamSlug, promptMessage) {
  const teams = await bigBrainAPI({ ctx, method: "GET", url: "teams" });
  if (teams.length === 0) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: "No teams found",
      printedMessage: import_chalk.default.red("Error: No teams found")
    });
  }
  if (!teamSlug) {
    switch (teams.length) {
      case 1:
        return { teamSlug: teams[0].slug, chosen: false };
      default:
        return {
          teamSlug: await (0, import_prompts.promptSearch)(ctx, {
            message: promptMessage,
            choices: teams.map((team) => ({
              name: `${team.name} (${team.slug})`,
              value: team.slug
            }))
          }),
          chosen: true
        };
    }
  } else {
    if (!teams.find((team) => team.slug === teamSlug)) {
      await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: Team ${teamSlug} not found, fix the --team option or remove it`
      });
    }
    return { teamSlug, chosen: false };
  }
}
async function selectDevDeploymentType(ctx, {
  chosenConfiguration,
  newOrExisting,
  teamSlug,
  projectSlug,
  userHasChosenSomethingInteractively,
  // from `--configure --dev-deployment local|cloud`
  devDeploymentFromFlag,
  // from `--cloud or --local`
  forceDevDeployment
}) {
  if (forceDevDeployment) return { devDeployment: forceDevDeployment };
  if (devDeploymentFromFlag) return { devDeployment: devDeploymentFromFlag };
  if (newOrExisting === "existing" && chosenConfiguration === null) {
    if (await (0, import_bigBrain.projectHasExistingCloudDev)(ctx, { projectSlug, teamSlug })) {
      return { devDeployment: "cloud" };
    }
  }
  if (chosenConfiguration !== "ask" && !userHasChosenSomethingInteractively) {
    return { devDeployment: "cloud" };
  }
  const isFirstProject = (await (0, import_bigBrain.bigBrainEnableFeatureMetadata)(ctx)).totalProjects.kind !== "multiple";
  if (isFirstProject) {
    return { devDeployment: "cloud" };
  }
  const devDeployment = await (0, import_prompts.promptOptions)(ctx, {
    message: "Use cloud or local dev deployment? For more see https://docs.convex.dev/cli/local-deployments",
    default: "cloud",
    choices: [
      { name: "cloud deployment", value: "cloud" },
      { name: "local deployment (BETA)", value: "local" }
    ]
  });
  return { devDeployment };
}
async function hasProject(ctx, teamSlug, projectSlug) {
  try {
    const projects = (await typedBigBrainClient(ctx).GET("/teams/{team_slug}/projects", {
      params: {
        path: {
          team_slug: teamSlug
        }
      }
    })).data;
    return !!projects.find((project) => project.slug === projectSlug);
  } catch {
    return false;
  }
}
async function hasProjects(ctx) {
  return !!await bigBrainAPI({ ctx, method: "GET", url: `has_projects` });
}
async function validateOrSelectProject(ctx, projectSlug, teamSlug, singleProjectPrompt, multiProjectPrompt) {
  const projects = (await typedBigBrainClient(ctx).GET("/teams/{team_slug}/projects", {
    params: {
      path: {
        team_slug: teamSlug
      }
    }
  })).data;
  if (projects.length === 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No existing projects! Run this command again and choose "create a new project."`
    });
  }
  if (!projectSlug) {
    const nonDemoProjects = projects.filter((project) => !project.isDemo);
    if (nonDemoProjects.length === 0) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No existing non-demo projects! Run this command again and choose "create a new project."`
      });
    }
    switch (nonDemoProjects.length) {
      case 1: {
        const project = nonDemoProjects[0];
        const confirmed = await (0, import_prompts.promptYesNo)(ctx, {
          message: `${singleProjectPrompt} ${project.name} (${project.slug})?`
        });
        if (!confirmed) {
          return null;
        }
        return nonDemoProjects[0].slug;
      }
      default:
        return await (0, import_prompts.promptSearch)(ctx, {
          message: multiProjectPrompt,
          choices: nonDemoProjects.map((project) => ({
            name: `${project.name} (${project.slug})`,
            value: project.slug
          }))
        });
    }
  } else {
    if (!projects.find((project) => project.slug === projectSlug)) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: Project ${projectSlug} not found, fix the --project option or remove it`
      });
    }
    return projectSlug;
  }
}
async function loadPackageJson(ctx, includePeerDeps = false) {
  let packageJson;
  try {
    packageJson = ctx.fs.readUtf8File("package.json");
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Unable to read your package.json: ${err}. Make sure you're running this command from the root directory of a Convex app that contains the package.json`
    });
  }
  let obj;
  try {
    obj = JSON.parse(packageJson);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: `Unable to parse package.json: ${err}`
    });
  }
  if (typeof obj !== "object") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Expected to parse an object from package.json"
    });
  }
  const packages = {
    ...includePeerDeps ? obj.peerDependencies ?? {} : {},
    ...obj.dependencies ?? {},
    ...obj.devDependencies ?? {}
  };
  return packages;
}
async function ensureHasConvexDependency(ctx, cmd) {
  const packages = await loadPackageJson(ctx, true);
  const hasConvexDependency = "convex" in packages;
  if (!hasConvexDependency) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `In order to ${cmd}, add \`convex\` to your package.json dependencies.`
    });
  }
}
const sorted = (arr, key) => {
  const newArr = [...arr];
  const cmp = (a, b) => {
    if (key(a) < key(b)) return -1;
    if (key(a) > key(b)) return 1;
    return 0;
  };
  return newArr.sort(cmp);
};
function functionsDir(configPath, projectConfig) {
  return import_path.default.join(import_path.default.dirname(configPath), projectConfig.functions);
}
function convexName() {
  if (process.env.CONVEX_PROVISION_HOST) {
    const port = process.env.CONVEX_PROVISION_HOST.split(":")[2];
    if (port === void 0 || port === "8050") {
      return `convex-test`;
    } else {
      return `convex-test-${port}`;
    }
  }
  return "convex";
}
function rootDirectory() {
  return import_path.default.join(import_os.default.homedir(), `.${convexName()}`);
}
function cacheDir() {
  const name = convexName();
  const platform = process.platform;
  if (platform === "win32") {
    if (process.env.LOCALAPPDATA) {
      return import_path.default.join(process.env.LOCALAPPDATA, name);
    }
    if (process.env.USERPROFILE) {
      return import_path.default.join(process.env.USERPROFILE, "AppData", "Local", name);
    }
    return import_path.default.join(import_os.default.homedir(), "AppData", "Local", name);
  }
  return import_path.default.join(import_os.default.homedir(), ".cache", name);
}
async function bigBrainFetch(ctx) {
  const authHeader = ctx.bigBrainAuth()?.header;
  const bigBrainHeaders = authHeader ? {
    Authorization: authHeader,
    "Convex-Client": `npm-cli-${import_version.version}`
  } : {
    "Convex-Client": `npm-cli-${import_version.version}`
  };
  return (resource, options) => {
    const { headers: optionsHeaders, ...rest } = options || {};
    const headers = {
      ...bigBrainHeaders,
      ...optionsHeaders || {}
    };
    const opts = {
      retries: MAX_RETRIES,
      retryDelay,
      headers,
      ...rest
    };
    const url = resource instanceof URL ? resource.pathname : typeof resource === "string" ? new URL(resource, BIG_BRAIN_URL) : new URL(resource.url, BIG_BRAIN_URL);
    return throwingFetch(url, opts);
  };
}
async function bigBrainAPI({
  ctx,
  method,
  url,
  data
}) {
  const dataString = data === void 0 ? void 0 : typeof data === "string" ? data : JSON.stringify(data);
  try {
    return await bigBrainAPIMaybeThrows({
      ctx,
      method,
      url,
      data: dataString
    });
  } catch (err) {
    return await logAndHandleFetchError(ctx, err);
  }
}
function typedBigBrainClient(ctx, options = {}) {
  const bigBrainClient = (0, import_openapi_fetch.default)({
    baseUrl: BIG_BRAIN_URL,
    fetch: async (resource, options2) => {
      const fetch2 = await bigBrainFetch(ctx);
      return fetch2(resource, options2);
    }
  });
  return new Proxy(bigBrainClient, {
    get(target, prop) {
      const originalMethod = target[prop];
      if (prop === "GET" || prop === "POST" || prop === "HEAD" || prop === "OPTIONS" || prop === "PUT" || prop === "DELETE" || prop === "PATCH" || prop === "TRACE") {
        return async (...args) => {
          try {
            return await originalMethod.apply(target, args);
          } catch (err) {
            if (options.throw) {
              throw err;
            }
            return await logAndHandleFetchError(ctx, err);
          }
        };
      }
      return originalMethod;
    }
  });
}
async function bigBrainAPIMaybeThrows({
  ctx,
  method,
  url,
  data
}) {
  const fetch2 = await bigBrainFetch(ctx);
  const dataString = data === void 0 ? method === "POST" ? JSON.stringify({}) : void 0 : typeof data === "string" ? data : JSON.stringify(data);
  const res = await fetch2(url, {
    method,
    ...dataString ? { body: dataString } : {},
    headers: method === "POST" ? {
      "Content-Type": "application/json"
    } : {}
  });
  deprecationCheckWarning(ctx, res);
  if (res.status === 200) {
    return await res.json();
  }
}
const poll = async function(fetch2, condition, waitMs = 1e3) {
  let result = await fetch2();
  while (!condition(result)) {
    await wait(waitMs);
    result = await fetch2();
  }
  return result;
};
const wait = function(waitMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, waitMs);
  });
};
function waitForever() {
  return new Promise((_) => {
  });
}
function waitUntilCalled() {
  let onCalled;
  const waitPromise = new Promise((resolve) => onCalled = resolve);
  return [waitPromise, () => onCalled(null)];
}
function formatSize(n) {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function formatDuration(ms) {
  const twoDigits = (n, unit) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit}`;
  if (ms < 1e-3) {
    return twoDigits(ms * 1e9, "ns");
  }
  if (ms < 1) {
    return twoDigits(ms * 1e3, "\xB5s");
  }
  if (ms < 1e3) {
    return twoDigits(ms, "ms");
  }
  const s = ms / 1e3;
  if (s < 60) {
    return twoDigits(ms / 1e3, "s");
  }
  return twoDigits(s / 60, "m");
}
function getCurrentTimeString() {
  const now = /* @__PURE__ */ new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
async function findParentConfigs(ctx) {
  const parentPackageJson = findUp(ctx, "package.json");
  if (!parentPackageJson) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "No package.json found. To create a new project using Convex, see https://docs.convex.dev/home#quickstarts"
    });
  }
  const candidateConvexJson = parentPackageJson && import_path.default.join(import_path.default.dirname(parentPackageJson), "convex.json");
  const parentConvexJson = candidateConvexJson && ctx.fs.exists(candidateConvexJson) ? candidateConvexJson : void 0;
  return {
    parentPackageJson,
    parentConvexJson
  };
}
function findUp(ctx, filename) {
  let curDir = import_path.default.resolve(".");
  let parentDir = curDir;
  do {
    const candidate = import_path.default.join(curDir, filename);
    if (ctx.fs.exists(candidate)) {
      return candidate;
    }
    curDir = parentDir;
    parentDir = import_path.default.dirname(curDir);
  } while (parentDir !== curDir);
  return;
}
async function isInExistingProject(ctx) {
  const { parentPackageJson, parentConvexJson } = await findParentConfigs(ctx);
  if (parentPackageJson !== import_path.default.resolve("package.json")) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Run this command from the root directory of a project."
    });
  }
  return !!parentConvexJson;
}
function spawnAsync(_ctx, command, args, options) {
  return new Promise((resolve, reject) => {
    const child = (0, import_child_process.spawn)(command, args, { shell: options?.shell });
    let stdout = "";
    let stderr = "";
    const pipeOutput = options?.stdio === "inherit";
    if (pipeOutput) {
      child.stdout.on(
        "data",
        (text) => (0, import_log.logMessage)(text.toString("utf-8").trimEnd())
      );
      child.stderr.on(
        "data",
        (text) => (0, import_log.logError)(text.toString("utf-8").trimEnd())
      );
    } else {
      child.stdout.on("data", (data) => {
        stdout += data.toString("utf-8");
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString("utf-8");
      });
    }
    const completionListener = (code) => {
      child.removeListener("error", errorListener);
      const result = pipeOutput ? { status: code } : { stdout, stderr, status: code };
      if (code !== 0) {
        const argumentString = args && args.length > 0 ? ` ${args.join(" ")}` : "";
        const error = new Error(
          `\`${command}${argumentString}\` exited with non-zero code: ${code}`
        );
        if (pipeOutput) {
          reject({ ...result, error });
        } else {
          resolve({ ...result, error });
        }
      } else {
        resolve(result);
      }
    };
    const errorListener = (error) => {
      child.removeListener("exit", completionListener);
      child.removeListener("close", completionListener);
      if (pipeOutput) {
        reject({ error, status: null });
      } else {
        resolve({ error, status: null });
      }
    };
    if (pipeOutput) {
      child.once("exit", completionListener);
    } else {
      child.once("close", completionListener);
    }
    child.once("error", errorListener);
  });
}
const IDEMPOTENT_METHODS = ["GET", "HEAD", "PUT", "DELETE", "OPTIONS", "TRACE"];
function retryDelay(attempt, _error, _response) {
  const delay = attempt === 0 ? 1 : 2 ** (attempt - 1) * 1e3;
  const randomSum = delay * 0.2 * Math.random();
  return delay + randomSum;
}
function deploymentFetchRetryOn(onError, method) {
  const shouldRetry = function(_attempt, error, response) {
    if (error !== null) {
      return { kind: "retry", error };
    }
    if (response?.status === 404) {
      return {
        kind: "retry",
        error: `Received response with status ${response.status}`
      };
    }
    if (response && !response.ok && method && IDEMPOTENT_METHODS.includes(method.toUpperCase())) {
      if ([
        400,
        // Bad Request
        401,
        // Unauthorized
        402,
        // PaymentRequired
        403,
        // Forbidden
        405,
        // Method Not Allowed
        406,
        // Not Acceptable
        412,
        // Precondition Failed
        413,
        // Payload Too Large
        414,
        // URI Too Long
        415,
        // Unsupported Media Type
        416
        // Range Not Satisfiable
      ].includes(response.status)) {
        return {
          kind: "stop"
        };
      }
      return {
        kind: "retry",
        error: `Received response with status ${response.status}`
      };
    }
    return { kind: "stop" };
  };
  return function(attempt, error, response) {
    const result = shouldRetry(attempt, error, response);
    if (result.kind === "retry") {
      onError?.(result.error, attempt);
    }
    if (attempt >= MAX_RETRIES) {
      return false;
    }
    return result.kind === "retry";
  };
}
function bareDeploymentFetch(_ctx, options) {
  const { deploymentUrl, onError } = options;
  const onErrorWithAttempt = (err, attempt) => {
    onError?.(err);
    if (attempt >= RETRY_LOG_THRESHOLD) {
      (0, import_log.logMessage)(
        import_chalk.default.gray(`Retrying request (attempt ${attempt}/${MAX_RETRIES})...`)
      );
    }
  };
  return (resource, options2) => {
    const url = resource instanceof URL ? resource.pathname : typeof resource === "string" ? new URL(resource, deploymentUrl) : new URL(resource.url, deploymentUrl);
    const func = throwingFetch(url, {
      retryDelay,
      retryOn: deploymentFetchRetryOn(onErrorWithAttempt, options2?.method),
      ...options2
    });
    return func;
  };
}
function deploymentFetch(_ctx, options) {
  const { deploymentUrl, adminKey, onError } = options;
  const onErrorWithAttempt = (err, attempt) => {
    onError?.(err);
    if (attempt >= RETRY_LOG_THRESHOLD) {
      (0, import_log.logMessage)(
        import_chalk.default.gray(`Retrying request (attempt ${attempt}/${MAX_RETRIES})...`)
      );
    }
  };
  return (resource, options2) => {
    const url = resource instanceof URL ? resource.pathname : typeof resource === "string" ? new URL(resource, deploymentUrl) : new URL(resource.url, deploymentUrl);
    const headers = new Headers(options2?.headers || {});
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Convex ${adminKey}`);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!headers.has("Convex-Client")) {
      headers.set("Convex-Client", `npm-cli-${import_version.version}`);
    }
    const func = throwingFetch(url, {
      retryDelay,
      retryOn: deploymentFetchRetryOn(onErrorWithAttempt, options2?.method),
      ...options2,
      headers
    });
    return func;
  };
}
function isWebContainer() {
  if (process.env.CONVEX_RUNNING_LIVE_IN_MONOREPO) {
    return false;
  }
  const dynamicRequire = require;
  if (process.versions.webcontainer === void 0) {
    return false;
  }
  let blitzInternalEnv;
  try {
    blitzInternalEnv = dynamicRequire("@blitz/internal/env");
  } catch {
  }
  return blitzInternalEnv !== null && blitzInternalEnv !== void 0;
}
async function currentPackageHomepage(ctx) {
  const { parentPackageJson: packageJsonPath } = await findParentConfigs(ctx);
  let packageJson;
  try {
    const packageJsonString = ctx.fs.readUtf8File(packageJsonPath);
    packageJson = JSON.parse(packageJsonString);
  } catch (error) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Couldn't parse "${packageJsonPath}". Make sure it's a valid JSON. Error: ${error}`
    });
  }
  const name = packageJson["homepage"];
  if (typeof name !== "string") {
    return null;
  }
  return name;
}
//# sourceMappingURL=utils.js.map
