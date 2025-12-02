"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import chalk from "chalk";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { InvalidArgumentError } from "commander";
import fetchRetryFactory from "fetch-retry";
import {
  failExistingSpinner,
  logError,
  logMessage,
  logWarning
} from "../../../bundler/log.js";
import { version } from "../../version.js";
import { promptOptions, promptSearch, promptYesNo } from "./prompts.js";
import {
  bigBrainEnableFeatureMetadata,
  projectHasExistingCloudDev
} from "../localDeployment/bigBrain.js";
import createClient from "openapi-fetch";
const retryingFetch = fetchRetryFactory(fetch);
export const productionProvisionHost = "https://api.convex.dev";
export const provisionHost = process.env.CONVEX_PROVISION_HOST || productionProvisionHost;
const BIG_BRAIN_URL = `${provisionHost}/api/`;
export const ENV_VAR_FILE_PATH = ".env.local";
export const CONVEX_DEPLOY_KEY_ENV_VAR_NAME = "CONVEX_DEPLOY_KEY";
export const CONVEX_DEPLOYMENT_ENV_VAR_NAME = "CONVEX_DEPLOYMENT";
export const CONVEX_SELF_HOSTED_URL_VAR_NAME = "CONVEX_SELF_HOSTED_URL";
export const CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME = "CONVEX_SELF_HOSTED_ADMIN_KEY";
const MAX_RETRIES = 6;
const RETRY_LOG_THRESHOLD = 3;
export async function processDeployKeyValue(ctx, deployKey) {
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
export function parsePositiveInteger(value) {
  const parsedValue = parseInteger(value);
  if (parsedValue <= 0) {
    throw new InvalidArgumentError("Not a positive number.");
  }
  return parsedValue;
}
export function parseInteger(value) {
  const parsedValue = +value;
  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError("Not a number.");
  }
  return parsedValue;
}
export class ThrowingFetchError extends Error {
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
      printedMessage: chalk.red(msg.trim())
    });
  }
}
export async function throwingFetch(resource, options) {
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
export async function logAndHandleFetchError(ctx, err) {
  failExistingSpinner();
  if (err instanceof ThrowingFetchError) {
    return await err.handle(ctx);
  } else {
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: err,
      printedMessage: chalk.red(err)
    });
  }
}
function logDeprecationWarning(ctx, deprecationMessage) {
  if (ctx.deprecationMessagePrinted) {
    return;
  }
  ctx.deprecationMessagePrinted = true;
  logWarning(chalk.yellow(deprecationMessage));
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
          printedMessage: chalk.red(deprecationMessage)
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
export function deprecationCheckWarning(ctx, resp) {
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
export async function hasTeam(ctx, teamSlug) {
  const teams = await bigBrainAPI({ ctx, method: "GET", url: "teams" });
  return teams.some((team) => team.slug === teamSlug);
}
export async function validateOrSelectTeam(ctx, teamSlug, promptMessage) {
  const teams = await bigBrainAPI({ ctx, method: "GET", url: "teams" });
  if (teams.length === 0) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: "No teams found",
      printedMessage: chalk.red("Error: No teams found")
    });
  }
  if (!teamSlug) {
    switch (teams.length) {
      case 1:
        return { teamSlug: teams[0].slug, chosen: false };
      default:
        return {
          teamSlug: await promptSearch(ctx, {
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
export async function selectDevDeploymentType(ctx, {
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
    if (await projectHasExistingCloudDev(ctx, { projectSlug, teamSlug })) {
      return { devDeployment: "cloud" };
    }
  }
  if (chosenConfiguration !== "ask" && !userHasChosenSomethingInteractively) {
    return { devDeployment: "cloud" };
  }
  const isFirstProject = (await bigBrainEnableFeatureMetadata(ctx)).totalProjects.kind !== "multiple";
  if (isFirstProject) {
    return { devDeployment: "cloud" };
  }
  const devDeployment = await promptOptions(ctx, {
    message: "Use cloud or local dev deployment? For more see https://docs.convex.dev/cli/local-deployments",
    default: "cloud",
    choices: [
      { name: "cloud deployment", value: "cloud" },
      { name: "local deployment (BETA)", value: "local" }
    ]
  });
  return { devDeployment };
}
export async function hasProject(ctx, teamSlug, projectSlug) {
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
export async function hasProjects(ctx) {
  return !!await bigBrainAPI({ ctx, method: "GET", url: `has_projects` });
}
export async function validateOrSelectProject(ctx, projectSlug, teamSlug, singleProjectPrompt, multiProjectPrompt) {
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
        const confirmed = await promptYesNo(ctx, {
          message: `${singleProjectPrompt} ${project.name} (${project.slug})?`
        });
        if (!confirmed) {
          return null;
        }
        return nonDemoProjects[0].slug;
      }
      default:
        return await promptSearch(ctx, {
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
export async function loadPackageJson(ctx, includePeerDeps = false) {
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
export async function ensureHasConvexDependency(ctx, cmd) {
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
export const sorted = (arr, key) => {
  const newArr = [...arr];
  const cmp = (a, b) => {
    if (key(a) < key(b)) return -1;
    if (key(a) > key(b)) return 1;
    return 0;
  };
  return newArr.sort(cmp);
};
export function functionsDir(configPath, projectConfig) {
  return path.join(path.dirname(configPath), projectConfig.functions);
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
export function rootDirectory() {
  return path.join(os.homedir(), `.${convexName()}`);
}
export function cacheDir() {
  const name = convexName();
  const platform = process.platform;
  if (platform === "win32") {
    if (process.env.LOCALAPPDATA) {
      return path.join(process.env.LOCALAPPDATA, name);
    }
    if (process.env.USERPROFILE) {
      return path.join(process.env.USERPROFILE, "AppData", "Local", name);
    }
    return path.join(os.homedir(), "AppData", "Local", name);
  }
  return path.join(os.homedir(), ".cache", name);
}
export async function bigBrainFetch(ctx) {
  const authHeader = ctx.bigBrainAuth()?.header;
  const bigBrainHeaders = authHeader ? {
    Authorization: authHeader,
    "Convex-Client": `npm-cli-${version}`
  } : {
    "Convex-Client": `npm-cli-${version}`
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
export async function bigBrainAPI({
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
export function typedBigBrainClient(ctx, options = {}) {
  const bigBrainClient = createClient({
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
export async function bigBrainAPIMaybeThrows({
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
export const poll = async function(fetch2, condition, waitMs = 1e3) {
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
export function waitForever() {
  return new Promise((_) => {
  });
}
export function waitUntilCalled() {
  let onCalled;
  const waitPromise = new Promise((resolve) => onCalled = resolve);
  return [waitPromise, () => onCalled(null)];
}
export function formatSize(n) {
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
export function formatDuration(ms) {
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
export function getCurrentTimeString() {
  const now = /* @__PURE__ */ new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
export async function findParentConfigs(ctx) {
  const parentPackageJson = findUp(ctx, "package.json");
  if (!parentPackageJson) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "No package.json found. To create a new project using Convex, see https://docs.convex.dev/home#quickstarts"
    });
  }
  const candidateConvexJson = parentPackageJson && path.join(path.dirname(parentPackageJson), "convex.json");
  const parentConvexJson = candidateConvexJson && ctx.fs.exists(candidateConvexJson) ? candidateConvexJson : void 0;
  return {
    parentPackageJson,
    parentConvexJson
  };
}
function findUp(ctx, filename) {
  let curDir = path.resolve(".");
  let parentDir = curDir;
  do {
    const candidate = path.join(curDir, filename);
    if (ctx.fs.exists(candidate)) {
      return candidate;
    }
    curDir = parentDir;
    parentDir = path.dirname(curDir);
  } while (parentDir !== curDir);
  return;
}
export async function isInExistingProject(ctx) {
  const { parentPackageJson, parentConvexJson } = await findParentConfigs(ctx);
  if (parentPackageJson !== path.resolve("package.json")) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Run this command from the root directory of a project."
    });
  }
  return !!parentConvexJson;
}
export function spawnAsync(_ctx, command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: options?.shell });
    let stdout = "";
    let stderr = "";
    const pipeOutput = options?.stdio === "inherit";
    if (pipeOutput) {
      child.stdout.on(
        "data",
        (text) => logMessage(text.toString("utf-8").trimEnd())
      );
      child.stderr.on(
        "data",
        (text) => logError(text.toString("utf-8").trimEnd())
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
export function bareDeploymentFetch(_ctx, options) {
  const { deploymentUrl, onError } = options;
  const onErrorWithAttempt = (err, attempt) => {
    onError?.(err);
    if (attempt >= RETRY_LOG_THRESHOLD) {
      logMessage(
        chalk.gray(`Retrying request (attempt ${attempt}/${MAX_RETRIES})...`)
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
export function deploymentFetch(_ctx, options) {
  const { deploymentUrl, adminKey, onError } = options;
  const onErrorWithAttempt = (err, attempt) => {
    onError?.(err);
    if (attempt >= RETRY_LOG_THRESHOLD) {
      logMessage(
        chalk.gray(`Retrying request (attempt ${attempt}/${MAX_RETRIES})...`)
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
      headers.set("Convex-Client", `npm-cli-${version}`);
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
export function isWebContainer() {
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
export async function currentPackageHomepage(ctx) {
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
