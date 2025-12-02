import { ProjectConfig } from "../config.js";
import { RequestInitRetryParams } from "fetch-retry";
import { Context } from "../../../bundler/context.js";
import type { paths as ManagementPaths } from "../../generatedApi.js";
export declare const productionProvisionHost = "https://api.convex.dev";
export declare const provisionHost: string;
export declare const ENV_VAR_FILE_PATH = ".env.local";
export declare const CONVEX_DEPLOY_KEY_ENV_VAR_NAME = "CONVEX_DEPLOY_KEY";
export declare const CONVEX_DEPLOYMENT_ENV_VAR_NAME = "CONVEX_DEPLOYMENT";
export declare const CONVEX_SELF_HOSTED_URL_VAR_NAME = "CONVEX_SELF_HOSTED_URL";
export declare const CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME = "CONVEX_SELF_HOSTED_ADMIN_KEY";
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
export declare function processDeployKeyValue(ctx: Context, deployKey: string | undefined): Promise<string | undefined>;
export declare function parsePositiveInteger(value: string): number;
export declare function parseInteger(value: string): number;
export type ErrorData = {
    code: string;
    message: string;
};
/**
 * Error thrown on non-2XX reponse codes to make most `fetch()` error handling
 * follow a single code path.
 */
export declare class ThrowingFetchError extends Error {
    response: Response;
    serverErrorData?: ErrorData;
    constructor(msg: string, { code, message, response, }: {
        cause?: Error;
        code?: string;
        message?: string;
        response: Response;
    });
    static fromResponse(response: Response, msg?: string): Promise<ThrowingFetchError>;
    handle(ctx: Context): Promise<never>;
}
/**
 * Thin wrapper around `fetch()` which throws a FetchDataError on non-2XX
 * responses which includes error code and message from the response JSON.
 * (Axios-style)
 *
 * It also accepts retry options from fetch-retry.
 */
export declare function throwingFetch(resource: RequestInfo | URL, options: (RequestInit & RequestInitRetryParams<typeof fetch>) | undefined): Promise<Response>;
/**
 * Handle an error a fetch error or non-2xx response.
 */
export declare function logAndHandleFetchError(ctx: Context, err: unknown): Promise<never>;
export declare function deprecationCheckWarning(ctx: Context, resp: Response): void;
export declare function hasTeam(ctx: Context, teamSlug: string): Promise<boolean>;
export declare function validateOrSelectTeam(ctx: Context, teamSlug: string | undefined, promptMessage: string): Promise<{
    teamSlug: string;
    chosen: boolean;
}>;
export declare function selectDevDeploymentType(ctx: Context, { chosenConfiguration, newOrExisting, teamSlug, projectSlug, userHasChosenSomethingInteractively, devDeploymentFromFlag, forceDevDeployment, }: {
    chosenConfiguration: "new" | "existing" | "ask" | null;
    newOrExisting: "existing";
    teamSlug: string;
    projectSlug: string;
    userHasChosenSomethingInteractively: boolean;
    devDeploymentFromFlag: "cloud" | "local" | undefined;
    forceDevDeployment: "cloud" | "local" | undefined;
} | {
    chosenConfiguration: "new" | "existing" | "ask" | null;
    newOrExisting: "new";
    teamSlug: string;
    projectSlug: undefined;
    userHasChosenSomethingInteractively: boolean;
    devDeploymentFromFlag: "cloud" | "local" | undefined;
    forceDevDeployment: "cloud" | "local" | undefined;
}): Promise<{
    devDeployment: "cloud" | "local";
}>;
export declare function hasProject(ctx: Context, teamSlug: string, projectSlug: string): Promise<boolean>;
export declare function hasProjects(ctx: Context): Promise<boolean>;
export declare function validateOrSelectProject(ctx: Context, projectSlug: string | undefined, teamSlug: string, singleProjectPrompt: string, multiProjectPrompt: string): Promise<string | null>;
/**
 * @param ctx
 * @returns a Record of dependency name to dependency version for dependencies
 * and devDependencies
 */
export declare function loadPackageJson(ctx: Context, includePeerDeps?: boolean): Promise<Record<string, string>>;
export declare function ensureHasConvexDependency(ctx: Context, cmd: string): Promise<undefined>;
/** Return a new array with elements of the passed in array sorted by a key lambda */
export declare const sorted: <T>(arr: T[], key: (el: T) => any) => T[];
export declare function functionsDir(configPath: string, projectConfig: ProjectConfig): string;
export declare function rootDirectory(): string;
export declare function cacheDir(): string;
/**
 * Fetch with appropriate headers for the Convex Management API.
 *
 * This fetch() also has retries and throws if the response is not ok.
 */
export declare function bigBrainFetch(ctx: Context): Promise<typeof fetch>;
export declare function bigBrainAPI<T = any>({ ctx, method, url, data, }: {
    ctx: Context;
    method: "GET" | "POST" | "HEAD";
    url: string;
    data?: any;
}): Promise<T>;
/**
 * Typed API client with a fetch() implemention that includes retries and crashes on errors.
 * It is always safe to call `.data!` on the response: any error would throw or crash.
 *
 * Pass { throw: true } to throw ThrowingFetchErrors instead of exiting the process.
 */
export declare function typedBigBrainClient(ctx: Context, options?: {
    throw?: boolean;
}): import("openapi-fetch").Client<ManagementPaths, `${string}/${string}`>;
export declare function bigBrainAPIMaybeThrows({ ctx, method, url, data, }: {
    ctx: Context;
    method: "GET" | "POST" | "HEAD";
    url: string;
    data?: any;
}): Promise<any>;
/**
 * Polls an arbitrary function until a condition is met.
 *
 * @param fetch Function performing a fetch, returning resulting data.
 * @param condition This function will terminate polling when it returns `true`.
 * @param waitMs How long to wait in between fetches.
 * @returns The resulting data from `fetch`.
 */
export declare const poll: <Result>(fetch: () => Promise<Result>, condition: (data: Result) => boolean, waitMs?: number) => Promise<Result>;
export declare function waitForever(): Promise<unknown>;
export declare function waitUntilCalled(): [Promise<unknown>, () => void];
export declare function formatSize(n: number): string;
export declare function formatDuration(ms: number): string;
export declare function getCurrentTimeString(): string;
export declare function findParentConfigs(ctx: Context): Promise<{
    parentPackageJson: string;
    parentConvexJson?: string | undefined;
}>;
/**
 * Returns whether there's an existing project config. Throws
 * if this is not a valid directory for a project config.
 */
export declare function isInExistingProject(ctx: Context): Promise<boolean>;
export declare function spawnAsync(ctx: Context, command: string, args: ReadonlyArray<string>): Promise<{
    stdout: string;
    stderr: string;
    status: null | number;
    error?: Error | undefined;
}>;
export declare function spawnAsync(ctx: Context, command: string, args: ReadonlyArray<string>, options: {
    stdio: "inherit";
    shell?: boolean;
}): Promise<void>;
/**
 * Unlike `deploymentFetch`, this does not add on any headers, so the caller
 * must supply any headers.
 */
export declare function bareDeploymentFetch(_ctx: Context, options: {
    deploymentUrl: string;
    onError?: (err: any) => void;
}): typeof throwingFetch;
/**
 * This returns a `fetch` function that will fetch against `deploymentUrl`.
 *
 * It will also set the `Authorization` header, `Content-Type` header, and
 * the `Convex-Client` header if they are not set in the `fetch`.
 */
export declare function deploymentFetch(_ctx: Context, options: {
    deploymentUrl: string;
    adminKey: string;
    onError?: (err: any) => void;
}): typeof throwingFetch;
/**
 * Whether this is likely to be a WebContainer,
 * WebContainers can't complete the WorkOS  login but where that login flow
 * fails has changed with the environment.
 */
export declare function isWebContainer(): boolean;
export declare function currentPackageHomepage(ctx: Context): Promise<string | null>;
//# sourceMappingURL=utils.d.ts.map