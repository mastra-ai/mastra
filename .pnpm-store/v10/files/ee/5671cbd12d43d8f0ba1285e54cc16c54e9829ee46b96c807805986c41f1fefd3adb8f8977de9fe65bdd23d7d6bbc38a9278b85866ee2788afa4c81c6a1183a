import chalk from "chalk";
import os from "os";
import path from "path";

import { ProjectConfig } from "../config.js";

import { spawn } from "child_process";
import { InvalidArgumentError } from "commander";
import fetchRetryFactory, { RequestInitRetryParams } from "fetch-retry";
import { Context, ErrorType } from "../../../bundler/context.js";
import {
  failExistingSpinner,
  logError,
  logMessage,
  logWarning,
} from "../../../bundler/log.js";
import { version } from "../../version.js";
import { Project } from "../api.js";
import { promptOptions, promptSearch, promptYesNo } from "./prompts.js";
import {
  bigBrainEnableFeatureMetadata,
  projectHasExistingCloudDev,
} from "../localDeployment/bigBrain.js";
import type { paths as ManagementPaths } from "../../generatedApi.js";
import createClient from "openapi-fetch";

const retryingFetch = fetchRetryFactory(fetch);

export const productionProvisionHost = "https://api.convex.dev";
export const provisionHost =
  process.env.CONVEX_PROVISION_HOST || productionProvisionHost;
const BIG_BRAIN_URL = `${provisionHost}/api/`;
export const ENV_VAR_FILE_PATH = ".env.local";
export const CONVEX_DEPLOY_KEY_ENV_VAR_NAME = "CONVEX_DEPLOY_KEY";
export const CONVEX_DEPLOYMENT_ENV_VAR_NAME = "CONVEX_DEPLOYMENT";
export const CONVEX_SELF_HOSTED_URL_VAR_NAME = "CONVEX_SELF_HOSTED_URL";
export const CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME =
  "CONVEX_SELF_HOSTED_ADMIN_KEY";
const MAX_RETRIES = 6;
// After 3 retries, log a progress message that we're retrying the request
const RETRY_LOG_THRESHOLD = 3;

/**
 * Processes the CONVEX_DEPLOY_KEY value to handle special sentinel values.
 *
 * - If the value is `<ignore_deploy_key>`, treats it as if the env var isn't set (returns undefined)
 * - If the value matches `<missing_deploy_key:$STRING>`, crashes with the message in $STRING
 * - Otherwise returns the value as-is
 *
 * @param ctx Context for crashing if needed
 * @param deployKey The raw deploy key value from environment or config
 * @returns The processed deploy key value or undefined
 */
export async function processDeployKeyValue(
  ctx: Context,
  deployKey: string | undefined,
): Promise<string | undefined> {
  if (deployKey === undefined) {
    return undefined;
  }

  // Check for <ignore_deploy_key> sentinel
  if (deployKey === "<ignore_deploy_key>") {
    return undefined;
  }

  // Check for <missing_deploy_key:$STRING> sentinel
  const missingKeyPattern = /^<missing_deploy_key:(.+)>$/;
  const match = deployKey.match(missingKeyPattern);
  if (match) {
    const errorMessage = match[1];
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: errorMessage,
    });
  }

  return deployKey;
}

export function parsePositiveInteger(value: string) {
  const parsedValue = parseInteger(value);
  if (parsedValue <= 0) {
    // eslint-disable-next-line no-restricted-syntax
    throw new InvalidArgumentError("Not a positive number.");
  }
  return parsedValue;
}

export function parseInteger(value: string) {
  const parsedValue = +value;
  if (isNaN(parsedValue)) {
    // eslint-disable-next-line no-restricted-syntax
    throw new InvalidArgumentError("Not a number.");
  }
  return parsedValue;
}

export type ErrorData = {
  code: string;
  message: string;
};

/**
 * Error thrown on non-2XX reponse codes to make most `fetch()` error handling
 * follow a single code path.
 */
export class ThrowingFetchError extends Error {
  response: Response;
  serverErrorData?: ErrorData;

  constructor(
    msg: string,
    {
      code,
      message,
      response,
    }: { cause?: Error; code?: string; message?: string; response: Response },
  ) {
    if (code !== undefined && message !== undefined) {
      super(`${msg}: ${code}: ${message}`);
      this.serverErrorData = { code, message };
    } else {
      super(msg);
    }

    Object.setPrototypeOf(this, ThrowingFetchError.prototype);

    this.response = response;
  }

  public static async fromResponse(
    response: Response,
    msg?: string,
  ): Promise<ThrowingFetchError> {
    msg = `${msg ? `${msg} ` : ""}${response.status} ${response.statusText}`;
    let code, message;
    try {
      ({ code, message } = await response.json());
    } catch {
      // Do nothing because the non-2XX response code is the primary error here.
    }
    return new ThrowingFetchError(msg, { code, message, response });
  }

  async handle(ctx: Context): Promise<never> {
    let error_type: ErrorType = "transient";
    await checkFetchErrorForDeprecation(ctx, this.response);

    let msg = this.message;

    if (this.response.status === 400) {
      error_type = "invalid filesystem or env vars";
    } else if (this.response.status === 401) {
      error_type = "fatal";
      msg = `${msg}\nAuthenticate with \`npx convex dev\``;
    } else if (this.response.status === 404) {
      error_type = "fatal";
      msg = `${msg}: ${this.response.url}`;
    }

    return await ctx.crash({
      exitCode: 1,
      errorType: error_type,
      errForSentry: this,
      printedMessage: chalk.red(msg.trim()),
    });
  }
}

/**
 * Thin wrapper around `fetch()` which throws a FetchDataError on non-2XX
 * responses which includes error code and message from the response JSON.
 * (Axios-style)
 *
 * It also accepts retry options from fetch-retry.
 */
export async function throwingFetch(
  resource: RequestInfo | URL,
  options: (RequestInit & RequestInitRetryParams<typeof fetch>) | undefined,
): Promise<Response> {
  const Headers = globalThis.Headers;
  const headers = new Headers((options || {})["headers"]);
  if (options?.body) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }
  const response = await retryingFetch(resource, options);
  if (!response.ok) {
    // This error must always be handled manually.
    // eslint-disable-next-line no-restricted-syntax
    throw await ThrowingFetchError.fromResponse(
      response,
      `Error fetching ${options?.method ? options.method + " " : ""} ${
        typeof resource === "string"
          ? resource
          : "url" in resource
            ? resource.url
            : resource.toString()
      }`,
    );
  }
  return response;
}

/**
 * Handle an error a fetch error or non-2xx response.
 */
export async function logAndHandleFetchError(
  ctx: Context,
  err: unknown,
): Promise<never> {
  // Fail the spinner so the stderr lines appear
  failExistingSpinner();

  if (err instanceof ThrowingFetchError) {
    return await err.handle(ctx);
  } else {
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: err,
      printedMessage: chalk.red(err),
    });
  }
}

function logDeprecationWarning(ctx: Context, deprecationMessage: string) {
  if (ctx.deprecationMessagePrinted) {
    return;
  }
  ctx.deprecationMessagePrinted = true;
  logWarning(chalk.yellow(deprecationMessage));
}

async function checkFetchErrorForDeprecation(ctx: Context, resp: Response) {
  const headers = resp.headers;
  if (headers) {
    const deprecationState = headers.get("x-convex-deprecation-state");
    const deprecationMessage = headers.get("x-convex-deprecation-message");
    switch (deprecationState) {
      case null:
        break;
      case "Deprecated":
        // This version is deprecated. Print a warning and crash.

        // Gotcha:
        // 1. Don't use `logDeprecationWarning` because we should always print
        // why this we crashed (even if we printed a warning earlier).
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: chalk.red(deprecationMessage),
        });
      default:
        // The error included a deprecation warning. Print, but handle the
        // error normally (it was for another reason).
        logDeprecationWarning(
          ctx,
          deprecationMessage || "(no deprecation message included)",
        );
        break;
    }
  }
}

/// Call this method after a successful API response to conditionally print the
/// "please upgrade" message.
export function deprecationCheckWarning(ctx: Context, resp: Response) {
  const headers = resp.headers;
  if (headers) {
    const deprecationState = headers.get("x-convex-deprecation-state");
    const deprecationMessage = headers.get("x-convex-deprecation-message");
    switch (deprecationState) {
      case null:
        break;
      case "Deprecated":
        // This should never happen because such states are errors, not warnings.
        // eslint-disable-next-line no-restricted-syntax
        throw new Error(
          "Called deprecationCheckWarning on a fatal error. This is a bug.",
        );
      default:
        logDeprecationWarning(
          ctx,
          deprecationMessage || "(no deprecation message included)",
        );
        break;
    }
  }
}

type Team = {
  id: number;
  name: string;
  slug: string;
};

export async function hasTeam(ctx: Context, teamSlug: string) {
  const teams: Team[] = await bigBrainAPI({ ctx, method: "GET", url: "teams" });
  return teams.some((team) => team.slug === teamSlug);
}

export async function validateOrSelectTeam(
  ctx: Context,
  teamSlug: string | undefined,
  promptMessage: string,
): Promise<{ teamSlug: string; chosen: boolean }> {
  const teams: Team[] = await bigBrainAPI({ ctx, method: "GET", url: "teams" });
  if (teams.length === 0) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: "No teams found",
      printedMessage: chalk.red("Error: No teams found"),
    });
  }
  if (!teamSlug) {
    // Prompt the user to select if they belong to more than one team.
    switch (teams.length) {
      case 1:
        return { teamSlug: teams[0].slug, chosen: false };
      default:
        return {
          teamSlug: await promptSearch(ctx, {
            message: promptMessage,
            choices: teams.map((team: Team) => ({
              name: `${team.name} (${team.slug})`,
              value: team.slug,
            })),
          }),
          chosen: true,
        };
    }
  } else {
    // Validate the chosen team.
    if (!teams.find((team) => team.slug === teamSlug)) {
      await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: Team ${teamSlug} not found, fix the --team option or remove it`,
      });
    }
    return { teamSlug, chosen: false };
  }
}

export async function selectDevDeploymentType(
  ctx: Context,
  {
    chosenConfiguration,
    newOrExisting,
    teamSlug,
    projectSlug,
    userHasChosenSomethingInteractively,
    // from `--configure --dev-deployment local|cloud`
    devDeploymentFromFlag,
    // from `--cloud or --local`
    forceDevDeployment,
  }:
    | {
        chosenConfiguration: "new" | "existing" | "ask" | null;
        newOrExisting: "existing";
        teamSlug: string;
        projectSlug: string;
        userHasChosenSomethingInteractively: boolean;
        devDeploymentFromFlag: "cloud" | "local" | undefined;
        forceDevDeployment: "cloud" | "local" | undefined;
      }
    | {
        chosenConfiguration: "new" | "existing" | "ask" | null;
        newOrExisting: "new";
        teamSlug: string;
        // For new projects we don't know the project slug yet.
        projectSlug: undefined;
        userHasChosenSomethingInteractively: boolean;
        devDeploymentFromFlag: "cloud" | "local" | undefined;
        forceDevDeployment: "cloud" | "local" | undefined;
      },
): Promise<{ devDeployment: "cloud" | "local" }> {
  if (forceDevDeployment) return { devDeployment: forceDevDeployment };
  if (devDeploymentFromFlag) return { devDeployment: devDeploymentFromFlag };

  if (newOrExisting === "existing" && chosenConfiguration === null) {
    // Don't suggest local dev if developer already has a cloud deployment.
    if (await projectHasExistingCloudDev(ctx, { projectSlug, teamSlug })) {
      // TODO Expand rollout to offer local dev in this case. ENG-8307
      return { devDeployment: "cloud" };
    }
  }

  // To avoid breaking previously non-interactive flows, don't prompt if enough
  // flags were specified for configure not to already have needed input.
  if (chosenConfiguration !== "ask" && !userHasChosenSomethingInteractively) {
    return { devDeployment: "cloud" };
  }

  // For creating a first project (no projects exist) or joining a first project
  // (one project exists), always use cloud since it's a smoother experience.
  const isFirstProject =
    (await bigBrainEnableFeatureMetadata(ctx)).totalProjects.kind !==
    "multiple";
  if (isFirstProject) {
    return { devDeployment: "cloud" };
  }

  // For now default is always cloud.
  const devDeployment: "cloud" | "local" = await promptOptions(ctx, {
    message:
      "Use cloud or local dev deployment? For more see https://docs.convex.dev/cli/local-deployments",
    default: "cloud",
    choices: [
      { name: "cloud deployment", value: "cloud" },
      { name: "local deployment (BETA)", value: "local" },
    ],
  });
  return { devDeployment };
}

export async function hasProject(
  ctx: Context,
  teamSlug: string,
  projectSlug: string,
) {
  try {
    const projects: Project[] = (
      await typedBigBrainClient(ctx).GET("/teams/{team_slug}/projects", {
        params: {
          path: {
            team_slug: teamSlug,
          },
        },
      })
    ).data!;
    return !!projects.find((project) => project.slug === projectSlug);
  } catch {
    return false;
  }
}

export async function hasProjects(ctx: Context) {
  return !!(await bigBrainAPI({ ctx, method: "GET", url: `has_projects` }));
}

export async function validateOrSelectProject(
  ctx: Context,
  projectSlug: string | undefined,
  teamSlug: string,
  singleProjectPrompt: string,
  multiProjectPrompt: string,
): Promise<string | null> {
  const projects: Project[] = (
    await typedBigBrainClient(ctx).GET("/teams/{team_slug}/projects", {
      params: {
        path: {
          team_slug: teamSlug,
        },
      },
    })
  ).data!;
  if (projects.length === 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `No existing projects! Run this command again and choose "create a new project."`,
    });
  }
  if (!projectSlug) {
    const nonDemoProjects = projects.filter((project) => !project.isDemo);
    if (nonDemoProjects.length === 0) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `No existing non-demo projects! Run this command again and choose "create a new project."`,
      });
    }
    // Prompt the user to select project.
    switch (nonDemoProjects.length) {
      case 1: {
        const project = nonDemoProjects[0];
        const confirmed = await promptYesNo(ctx, {
          message: `${singleProjectPrompt} ${project.name} (${project.slug})?`,
        });

        if (!confirmed) {
          return null;
        }
        return nonDemoProjects[0].slug;
      }
      default:
        return await promptSearch(ctx, {
          message: multiProjectPrompt,
          choices: nonDemoProjects.map((project: Project) => ({
            name: `${project.name} (${project.slug})`,
            value: project.slug,
          })),
        });
    }
  } else {
    // Validate the chosen project.
    if (!projects.find((project) => project.slug === projectSlug)) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: Project ${projectSlug} not found, fix the --project option or remove it`,
      });
    }
    return projectSlug;
  }
}

/**
 * @param ctx
 * @returns a Record of dependency name to dependency version for dependencies
 * and devDependencies
 */
export async function loadPackageJson(
  ctx: Context,
  includePeerDeps = false,
): Promise<Record<string, string>> {
  let packageJson;
  try {
    packageJson = ctx.fs.readUtf8File("package.json");
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Unable to read your package.json: ${
        err as any
      }. Make sure you're running this command from the root directory of a Convex app that contains the package.json`,
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
      printedMessage: `Unable to parse package.json: ${err as any}`,
    });
  }
  if (typeof obj !== "object") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Expected to parse an object from package.json",
    });
  }
  const packages = {
    ...(includePeerDeps ? (obj.peerDependencies ?? {}) : {}),
    ...(obj.dependencies ?? {}),
    ...(obj.devDependencies ?? {}),
  };
  return packages;
}

export async function ensureHasConvexDependency(ctx: Context, cmd: string) {
  const packages = await loadPackageJson(ctx, true);
  const hasConvexDependency = "convex" in packages;
  if (!hasConvexDependency) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `In order to ${cmd}, add \`convex\` to your package.json dependencies.`,
    });
  }
}

/** Return a new array with elements of the passed in array sorted by a key lambda */
export const sorted = <T>(arr: T[], key: (el: T) => any): T[] => {
  const newArr = [...arr];
  const cmp = (a: T, b: T) => {
    if (key(a) < key(b)) return -1;
    if (key(a) > key(b)) return 1;
    return 0;
  };
  return newArr.sort(cmp);
};

export function functionsDir(
  configPath: string,
  projectConfig: ProjectConfig,
): string {
  return path.join(path.dirname(configPath), projectConfig.functions);
}

function convexName() {
  // Use a different directory for config files generated for tests
  if (process.env.CONVEX_PROVISION_HOST) {
    const port = process.env.CONVEX_PROVISION_HOST.split(":")[2];
    if (port === undefined || port === "8050") {
      return `convex-test`;
    } else {
      return `convex-test-${port}`;
    }
  }
  return "convex";
}

export function rootDirectory(): string {
  return path.join(os.homedir(), `.${convexName()}`);
}

export function cacheDir() {
  const name = convexName();
  const platform = process.platform;
  if (platform === "win32") {
    // On Windows, `LOCALAPPDATA` is usually set, but fall back to
    // `USERPROFILE` if not, and fall back to homedir if all else fails.
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

/**
 * Fetch with appropriate headers for the Convex Management API.
 *
 * This fetch() also has retries and throws if the response is not ok.
 */
export async function bigBrainFetch(ctx: Context): Promise<typeof fetch> {
  const authHeader = ctx.bigBrainAuth()?.header;
  const bigBrainHeaders: Record<string, string> = authHeader
    ? {
        Authorization: authHeader,
        "Convex-Client": `npm-cli-${version}`,
      }
    : {
        "Convex-Client": `npm-cli-${version}`,
      };
  return (resource: RequestInfo | URL, options: RequestInit | undefined) => {
    const { headers: optionsHeaders, ...rest } = options || {};
    const headers = {
      ...bigBrainHeaders,
      ...(optionsHeaders || {}),
    };
    const opts = {
      retries: MAX_RETRIES,
      retryDelay,
      headers,
      ...rest,
    };

    const url =
      resource instanceof URL
        ? resource.pathname
        : typeof resource === "string"
          ? new URL(resource, BIG_BRAIN_URL)
          : new URL(resource.url, BIG_BRAIN_URL);
    return throwingFetch(url, opts);
  };
}

export async function bigBrainAPI<T = any>({
  ctx,
  method,
  url,
  data,
}: {
  ctx: Context;
  method: "GET" | "POST" | "HEAD";
  url: string;
  data?: any;
}): Promise<T> {
  const dataString =
    data === undefined
      ? undefined
      : typeof data === "string"
        ? data
        : JSON.stringify(data);
  try {
    return await bigBrainAPIMaybeThrows({
      ctx,
      method,
      url,
      data: dataString,
    });
  } catch (err: unknown) {
    return await logAndHandleFetchError(ctx, err);
  }
}

/**
 * Typed API client with a fetch() implemention that includes retries and crashes on errors.
 * It is always safe to call `.data!` on the response: any error would throw or crash.
 *
 * Pass { throw: true } to throw ThrowingFetchErrors instead of exiting the process.
 */
export function typedBigBrainClient(
  ctx: Context,
  options: { throw?: boolean } = {},
) {
  const bigBrainClient = createClient<ManagementPaths>({
    baseUrl: BIG_BRAIN_URL,
    fetch: async (
      resource: Request,
      options?: RequestInit,
    ): Promise<Response> => {
      const fetch = await bigBrainFetch(ctx);
      return fetch(resource, options);
    },
  });

  // Wrap the client with error handling - go back to proxy since middleware doesn't catch parsing errors
  return new Proxy(bigBrainClient, {
    get(target, prop) {
      const originalMethod = target[prop as keyof typeof target];

      if (
        prop === "GET" ||
        prop === "POST" ||
        prop === "HEAD" ||
        prop === "OPTIONS" ||
        prop === "PUT" ||
        prop === "DELETE" ||
        prop === "PATCH" ||
        prop === "TRACE"
      ) {
        return async (...args: any[]) => {
          try {
            return await (originalMethod as Function).apply(target, args);
          } catch (err: unknown) {
            if (options.throw) {
              // eslint-disable-next-line no-restricted-syntax
              throw err;
            }
            return await logAndHandleFetchError(ctx, err);
          }
        };
      }

      return originalMethod;
    },
  });
}

export async function bigBrainAPIMaybeThrows({
  ctx,
  method,
  url,
  data,
}: {
  ctx: Context;
  method: "GET" | "POST" | "HEAD";
  url: string;
  data?: any;
}): Promise<any> {
  const fetch = await bigBrainFetch(ctx);
  const dataString =
    data === undefined
      ? method === "POST"
        ? JSON.stringify({})
        : undefined
      : typeof data === "string"
        ? data
        : JSON.stringify(data);
  const res = await fetch(url, {
    method,
    ...(dataString ? { body: dataString } : {}),
    headers:
      method === "POST"
        ? {
            "Content-Type": "application/json",
          }
        : {},
  });
  deprecationCheckWarning(ctx, res);
  if (res.status === 200) {
    return await res.json();
  }
}

/**
 * Polls an arbitrary function until a condition is met.
 *
 * @param fetch Function performing a fetch, returning resulting data.
 * @param condition This function will terminate polling when it returns `true`.
 * @param waitMs How long to wait in between fetches.
 * @returns The resulting data from `fetch`.
 */
export const poll = async function <Result>(
  fetch: () => Promise<Result>,
  condition: (data: Result) => boolean,
  waitMs = 1000,
) {
  let result = await fetch();
  while (!condition(result)) {
    await wait(waitMs);
    result = await fetch();
  }
  return result;
};

const wait = function (waitMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, waitMs);
  });
};

export function waitForever() {
  // This never resolves
  return new Promise((_) => {
    // ignore
  });
}

// Returns a promise and a function that resolves the promise.
export function waitUntilCalled(): [Promise<unknown>, () => void] {
  let onCalled: (v: unknown) => void;
  const waitPromise = new Promise((resolve) => (onCalled = resolve));
  return [waitPromise, () => onCalled(null)];
}

// We can eventually switch to something like `filesize` for i18n and
// more robust formatting, but let's keep our CLI bundle small for now.
export function formatSize(n: number): string {
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

export function formatDuration(ms: number): string {
  const twoDigits = (n: number, unit: string) =>
    `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit}`;

  if (ms < 1e-3) {
    return twoDigits(ms * 1e9, "ns");
  }
  if (ms < 1) {
    return twoDigits(ms * 1e3, "µs");
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
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// We don't allow running commands in project subdirectories yet,
// but we can provide better errors if we look around.
export async function findParentConfigs(ctx: Context): Promise<{
  parentPackageJson: string;
  parentConvexJson?: string | undefined;
}> {
  const parentPackageJson = findUp(ctx, "package.json");
  if (!parentPackageJson) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage:
        "No package.json found. To create a new project using Convex, see https://docs.convex.dev/home#quickstarts",
    });
  }
  const candidateConvexJson =
    parentPackageJson &&
    path.join(path.dirname(parentPackageJson), "convex.json");
  const parentConvexJson =
    candidateConvexJson && ctx.fs.exists(candidateConvexJson)
      ? candidateConvexJson
      : undefined;
  return {
    parentPackageJson,
    parentConvexJson,
  };
}

/**
 * Finds a file in the current working directory or a parent.
 *
 * @returns The absolute path of the first file found or undefined.
 */
function findUp(ctx: Context, filename: string): string | undefined {
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

/**
 * Returns whether there's an existing project config. Throws
 * if this is not a valid directory for a project config.
 */
export async function isInExistingProject(ctx: Context) {
  const { parentPackageJson, parentConvexJson } = await findParentConfigs(ctx);
  if (parentPackageJson !== path.resolve("package.json")) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Run this command from the root directory of a project.",
    });
  }
  return !!parentConvexJson;
}

// `spawnAsync` is the async version of Node's `spawnSync` (and `spawn`).
//
// By default, this returns the produced `stdout` and `stderror` and
// an error if one was encountered (to mirror `spawnSync`).
//
// If `stdio` is set to `"inherit"`, pipes `stdout` and `stderror` (
// pausing the spinner if one is running) and rejects the promise
// on errors (to mirror `execFileSync`).
export function spawnAsync(
  ctx: Context,
  command: string,
  args: ReadonlyArray<string>,
): Promise<{
  stdout: string;
  stderr: string;
  status: null | number;
  error?: Error | undefined;
}>;
export function spawnAsync(
  ctx: Context,
  command: string,
  args: ReadonlyArray<string>,
  options: { stdio: "inherit"; shell?: boolean },
): Promise<void>;
export function spawnAsync(
  _ctx: Context,
  command: string,
  args: ReadonlyArray<string>,
  options?: { stdio: "inherit"; shell?: boolean },
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: options?.shell });
    let stdout = "";
    let stderr = "";

    const pipeOutput = options?.stdio === "inherit";

    if (pipeOutput) {
      child.stdout.on("data", (text) =>
        logMessage(text.toString("utf-8").trimEnd()),
      );
      child.stderr.on("data", (text) =>
        logError(text.toString("utf-8").trimEnd()),
      );
    } else {
      child.stdout.on("data", (data) => {
        stdout += data.toString("utf-8");
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString("utf-8");
      });
    }

    const completionListener = (code: number | null) => {
      child.removeListener("error", errorListener);
      const result = pipeOutput
        ? { status: code }
        : { stdout, stderr, status: code };
      if (code !== 0) {
        const argumentString =
          args && args.length > 0 ? ` ${args.join(" ")}` : "";
        const error = new Error(
          `\`${command}${argumentString}\` exited with non-zero code: ${code}`,
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

    const errorListener = (error: Error) => {
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

function retryDelay(
  attempt: number,
  _error: Error | null,
  _response: Response | null,
): number {
  // immediate, 1s delay, 2s delay, 4s delay, etc.
  const delay = attempt === 0 ? 1 : 2 ** (attempt - 1) * 1000;
  const randomSum = delay * 0.2 * Math.random();
  return delay + randomSum;
}

function deploymentFetchRetryOn(
  onError?: (err: any, attempt: number) => void,
  method?: string,
) {
  const shouldRetry = function (
    _attempt: number,
    error: Error | null,
    response: Response | null,
  ): { kind: "retry"; error: any } | { kind: "stop" } {
    // Retry on network errors.
    if (error !== null) {
      // TODO filter out all SSL errors
      // https://github.com/nodejs/node/blob/8a41d9b636be86350cd32847c3f89d327c4f6ff7/src/crypto/crypto_common.cc#L218-L245
      return { kind: "retry", error: error };
    }
    // Retry on 404s since these can sometimes happen with newly created
    // deployments for POSTs.
    if (response?.status === 404) {
      return {
        kind: "retry",
        error: `Received response with status ${response.status}`,
      };
    }

    // Whatever the error code it doesn't hurt to retry idempotent requests.
    if (
      response &&
      !response.ok &&
      method &&
      IDEMPOTENT_METHODS.includes(method.toUpperCase())
    ) {
      // ...but it's a bit annoying to wait for things we know won't succced
      if (
        [
          400, // Bad Request
          401, // Unauthorized
          402, // PaymentRequired
          403, // Forbidden
          405, // Method Not Allowed
          406, // Not Acceptable
          412, // Precondition Failed
          413, // Payload Too Large
          414, // URI Too Long
          415, // Unsupported Media Type
          416, // Range Not Satisfiable
        ].includes(response.status)
      ) {
        return {
          kind: "stop",
        };
      }
      return {
        kind: "retry",
        error: `Received response with status ${response.status}`,
      };
    }

    return { kind: "stop" };
  };

  return function (
    attempt: number,
    error: Error | null,
    response: Response | null,
  ) {
    const result = shouldRetry(attempt, error, response);
    if (result.kind === "retry") {
      onError?.(result.error, attempt);
    }
    if (attempt >= MAX_RETRIES) {
      // Stop retrying if we've exhausted all retries, but do this after we've
      // called `onError` so that the caller can still log the error.
      return false;
    }
    return result.kind === "retry";
  };
}

/**
 * Unlike `deploymentFetch`, this does not add on any headers, so the caller
 * must supply any headers.
 */
export function bareDeploymentFetch(
  _ctx: Context,
  options: {
    deploymentUrl: string;
    onError?: (err: any) => void;
  },
): typeof throwingFetch {
  const { deploymentUrl, onError } = options;
  const onErrorWithAttempt = (err: any, attempt: number) => {
    onError?.(err);
    if (attempt >= RETRY_LOG_THRESHOLD) {
      logMessage(
        chalk.gray(`Retrying request (attempt ${attempt}/${MAX_RETRIES})...`),
      );
    }
  };
  return (resource: RequestInfo | URL, options: RequestInit | undefined) => {
    const url =
      resource instanceof URL
        ? resource.pathname
        : typeof resource === "string"
          ? new URL(resource, deploymentUrl)
          : new URL(resource.url, deploymentUrl);
    const func = throwingFetch(url, {
      retryDelay,
      retryOn: deploymentFetchRetryOn(onErrorWithAttempt, options?.method),
      ...options,
    });
    return func;
  };
}

/**
 * This returns a `fetch` function that will fetch against `deploymentUrl`.
 *
 * It will also set the `Authorization` header, `Content-Type` header, and
 * the `Convex-Client` header if they are not set in the `fetch`.
 */
export function deploymentFetch(
  _ctx: Context,
  options: {
    deploymentUrl: string;
    adminKey: string;
    onError?: (err: any) => void;
  },
): typeof throwingFetch {
  const { deploymentUrl, adminKey, onError } = options;
  const onErrorWithAttempt = (err: any, attempt: number) => {
    onError?.(err);
    if (attempt >= RETRY_LOG_THRESHOLD) {
      logMessage(
        chalk.gray(`Retrying request (attempt ${attempt}/${MAX_RETRIES})...`),
      );
    }
  };
  return (resource: RequestInfo | URL, options: RequestInit | undefined) => {
    const url =
      resource instanceof URL
        ? resource.pathname
        : typeof resource === "string"
          ? new URL(resource, deploymentUrl)
          : new URL(resource.url, deploymentUrl);

    const headers = new Headers(options?.headers || {});
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
      retryOn: deploymentFetchRetryOn(onErrorWithAttempt, options?.method),
      ...options,
      headers,
    });
    return func;
  };
}

/**
 * Whether this is likely to be a WebContainer,
 * WebContainers can't complete the WorkOS  login but where that login flow
 * fails has changed with the environment.
 */
export function isWebContainer(): boolean {
  // Dynamic require as used here doesn't work with tsx
  if (process.env.CONVEX_RUNNING_LIVE_IN_MONOREPO) {
    return false;
  }
  const dynamicRequire = require;
  if (process.versions.webcontainer === undefined) {
    return false;
  }
  let blitzInternalEnv: unknown;
  try {
    blitzInternalEnv = dynamicRequire("@blitz/internal/env");
    // totally fine for this require to fail
    // eslint-disable-next-line no-empty
  } catch {}
  return blitzInternalEnv !== null && blitzInternalEnv !== undefined;
}

// For (rare) special behaviors based on package.json details.
export async function currentPackageHomepage(
  ctx: Context,
): Promise<string | null> {
  const { parentPackageJson: packageJsonPath } = await findParentConfigs(ctx);
  let packageJson: any;
  try {
    const packageJsonString = ctx.fs.readUtf8File(packageJsonPath);
    packageJson = JSON.parse(packageJsonString);
  } catch (error: any) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Couldn't parse "${packageJsonPath}". Make sure it's a valid JSON. Error: ${error}`,
    });
  }
  const name = packageJson["homepage"];
  if (typeof name !== "string") {
    // wrong type or missing
    return null;
  }
  return name;
}
