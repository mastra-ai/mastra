import chalk from "chalk";

//#region src/helpers/consts.ts
/**
* Keys for accessing query parameters included in requests from Inngest to run
* functions.
*
* Used internally to create handlers using `InngestCommHandler`, but can be
* imported to be used if creating a custom handler outside of the package.
*
* @public
*/
let queryKeys = /* @__PURE__ */ function(queryKeys$1) {
	queryKeys$1["DeployId"] = "deployId";
	queryKeys$1["FnId"] = "fnId";
	queryKeys$1["Probe"] = "probe";
	queryKeys$1["StepId"] = "stepId";
	return queryKeys$1;
}({});
let probe = /* @__PURE__ */ function(probe$1) {
	probe$1["Trust"] = "trust";
	return probe$1;
}({});
let envKeys = /* @__PURE__ */ function(envKeys$1) {
	envKeys$1["InngestSigningKey"] = "INNGEST_SIGNING_KEY";
	envKeys$1["InngestSigningKeyFallback"] = "INNGEST_SIGNING_KEY_FALLBACK";
	envKeys$1["InngestEventKey"] = "INNGEST_EVENT_KEY";
	/**
	* @deprecated Removed in v3. Use {@link InngestBaseUrl} instead.
	*/
	envKeys$1["InngestDevServerUrl"] = "INNGEST_DEVSERVER_URL";
	envKeys$1["InngestEnvironment"] = "INNGEST_ENV";
	envKeys$1["InngestBaseUrl"] = "INNGEST_BASE_URL";
	envKeys$1["InngestEventApiBaseUrl"] = "INNGEST_EVENT_API_BASE_URL";
	envKeys$1["InngestApiBaseUrl"] = "INNGEST_API_BASE_URL";
	envKeys$1["InngestServeHost"] = "INNGEST_SERVE_HOST";
	envKeys$1["InngestServePath"] = "INNGEST_SERVE_PATH";
	envKeys$1["InngestLogLevel"] = "INNGEST_LOG_LEVEL";
	envKeys$1["InngestStreaming"] = "INNGEST_STREAMING";
	envKeys$1["InngestDevMode"] = "INNGEST_DEV";
	envKeys$1["InngestAllowInBandSync"] = "INNGEST_ALLOW_IN_BAND_SYNC";
	/**
	* @deprecated It's unknown what this env var was used for, but we do not
	* provide explicit support for it. Prefer using `INNGEST_ENV` instead.
	*/
	envKeys$1["BranchName"] = "BRANCH_NAME";
	/**
	* The git branch of the commit the deployment was triggered by. Example:
	* `improve-about-page`.
	*
	* {@link https://vercel.com/docs/concepts/projects/environment-variables/system-environment-variables#system-environment-variables}
	*/
	envKeys$1["VercelBranch"] = "VERCEL_GIT_COMMIT_REF";
	/**
	* Expected to be `"1"` if defined.
	*/
	envKeys$1["IsVercel"] = "VERCEL";
	/**
	* The branch name of the current deployment. May only be accessible at build
	* time, but included here just in case.
	*
	* {@link https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables}
	*/
	envKeys$1["CloudflarePagesBranch"] = "CF_PAGES_BRANCH";
	/**
	* Expected to be `"1"` if defined.
	*/
	envKeys$1["IsCloudflarePages"] = "CF_PAGES";
	/**
	* The branch name of the deployment from Git to Netlify, if available.
	*
	* {@link https://docs.netlify.com/configure-builds/environment-variables/#git-metadata}
	*/
	envKeys$1["NetlifyBranch"] = "BRANCH";
	/**
	* Expected to be `"true"` if defined.
	*/
	envKeys$1["IsNetlify"] = "NETLIFY";
	/**
	* The Git branch for a service or deploy.
	*
	* {@link https://render.com/docs/environment-variables#all-services}
	*/
	envKeys$1["RenderBranch"] = "RENDER_GIT_BRANCH";
	/**
	* Expected to be `"true"` if defined.
	*/
	envKeys$1["IsRender"] = "RENDER";
	/**
	* The branch that triggered the deployment. Example: `main`
	*
	* {@link https://docs.railway.app/develop/variables#railway-provided-variables}
	*/
	envKeys$1["RailwayBranch"] = "RAILWAY_GIT_BRANCH";
	/**
	* The railway environment for the deployment. Example: `production`
	*
	* {@link https://docs.railway.app/develop/variables#railway-provided-variables}
	*/
	envKeys$1["RailwayEnvironment"] = "RAILWAY_ENVIRONMENT";
	envKeys$1["VercelEnvKey"] = "VERCEL_ENV";
	envKeys$1["OpenAiApiKey"] = "OPENAI_API_KEY";
	envKeys$1["GeminiApiKey"] = "GEMINI_API_KEY";
	envKeys$1["AnthropicApiKey"] = "ANTHROPIC_API_KEY";
	return envKeys$1;
}({});
/**
* Keys for accessing headers included in requests from Inngest to run
* functions.
*
* Used internally to create handlers using `InngestCommHandler`, but can be
* imported to be used if creating a custom handler outside of the package.
*
* @public
*/
let headerKeys = /* @__PURE__ */ function(headerKeys$1) {
	headerKeys$1["ContentLength"] = "content-length";
	headerKeys$1["Signature"] = "x-inngest-signature";
	headerKeys$1["SdkVersion"] = "x-inngest-sdk";
	headerKeys$1["Environment"] = "x-inngest-env";
	headerKeys$1["Platform"] = "x-inngest-platform";
	headerKeys$1["Framework"] = "x-inngest-framework";
	headerKeys$1["NoRetry"] = "x-inngest-no-retry";
	headerKeys$1["RequestVersion"] = "x-inngest-req-version";
	headerKeys$1["RetryAfter"] = "retry-after";
	headerKeys$1["InngestServerKind"] = "x-inngest-server-kind";
	headerKeys$1["InngestExpectedServerKind"] = "x-inngest-expected-server-kind";
	headerKeys$1["InngestSyncKind"] = "x-inngest-sync-kind";
	headerKeys$1["EventIdSeed"] = "x-inngest-event-id-seed";
	headerKeys$1["TraceParent"] = "traceparent";
	headerKeys$1["TraceState"] = "tracestate";
	return headerKeys$1;
}({});
const defaultInngestApiBaseUrl = "https://api.inngest.com/";
const defaultInngestEventBaseUrl = "https://inn.gs/";
const defaultDevServerHost = "http://localhost:8288/";
/**
* Events that Inngest may send internally that can be used to trigger
* functions.
*
* @public
*/
let internalEvents = /* @__PURE__ */ function(internalEvents$1) {
	/**
	* A function has failed after exhausting all available retries. This event
	* will contain the original event and the error that caused the failure.
	*/
	internalEvents$1["FunctionFailed"] = "inngest/function.failed";
	internalEvents$1["FunctionInvoked"] = "inngest/function.invoked";
	internalEvents$1["FunctionFinished"] = "inngest/function.finished";
	internalEvents$1["FunctionCancelled"] = "inngest/function.cancelled";
	internalEvents$1["ScheduledTimer"] = "inngest/scheduled.timer";
	return internalEvents$1;
}({});
const logPrefix = chalk.magenta.bold("[Inngest]");
const debugPrefix = "inngest";
const dummyEventKey = "NO_EVENT_KEY_SET";
let syncKind = /* @__PURE__ */ function(syncKind$1) {
	syncKind$1["InBand"] = "in_band";
	syncKind$1["OutOfBand"] = "out_of_band";
	return syncKind$1;
}({});
/**
* The execution models the SDK is aware of.
*
* This is used in a number of places to ensure all execution versions are
* accounted for for a given operation.
*/
let ExecutionVersion = /* @__PURE__ */ function(ExecutionVersion$1) {
	/**
	* Very legacy, initial version of the executor. Uses hashed op objects and
	* `pos` to determine the order of execution and which ops to run.
	*
	* Very stubborn about determinism.
	*/
	ExecutionVersion$1[ExecutionVersion$1["V0"] = 0] = "V0";
	/**
	* Uses a more flexible approach to execution and is more lenient about
	* determinism, allowing non-step async actions and non-determinism.
	*
	* Nowhere near as stubborn about determinism and so can silently migrate
	* between versions after bug fixes.
	*/
	ExecutionVersion$1[ExecutionVersion$1["V1"] = 1] = "V1";
	/**
	* Identical to V1, but allows the Executor to optimize parallel calls, hugely
	* reducing traffic going to/from the SDK.
	*/
	ExecutionVersion$1[ExecutionVersion$1["V2"] = 2] = "V2";
	return ExecutionVersion$1;
}({});

//#endregion
export { ExecutionVersion, debugPrefix, defaultDevServerHost, defaultInngestApiBaseUrl, defaultInngestEventBaseUrl, dummyEventKey, envKeys, headerKeys, internalEvents, logPrefix, probe, queryKeys, syncKind };
//# sourceMappingURL=consts.js.map