import { errors, BaseClient, custom } from "openid-client";
import {
  bigBrainAPI,
  logAndHandleFetchError,
  throwingFetch,
  isWebContainer,
} from "./utils/utils.js";
import open from "open";
import chalk from "chalk";
import { provisionHost } from "./config.js";
import { version } from "../version.js";
import { Context } from "../../bundler/context.js";
import {
  changeSpinner,
  logError,
  logFailure,
  logFinishedStep,
  logMessage,
  logOutput,
  logVerbose,
  showSpinner,
} from "../../bundler/log.js";
import { Issuer } from "openid-client";
import { hostname } from "os";
import { execSync } from "child_process";
import { promptString, promptYesNo } from "./utils/prompts.js";
import {
  formatPathForPrinting,
  globalConfigPath,
  modifyGlobalConfig,
} from "./utils/globalConfig.js";
import { updateBigBrainAuthAfterLogin } from "./deploymentSelection.js";

// Per https://github.com/panva/node-openid-client/tree/main/docs#customizing
custom.setHttpOptionsDefaults({
  timeout: parseInt(process.env.OPENID_CLIENT_TIMEOUT || "10000"),
});

interface AuthorizeArgs {
  authnToken: string;
  deviceName: string;
  anonymousId?: string | undefined;
}

export async function checkAuthorization(
  ctx: Context,
  acceptOptIns: boolean,
): Promise<boolean> {
  const header = ctx.bigBrainAuth()?.header ?? null;
  if (header === null) {
    return false;
  }
  try {
    const resp = await fetch(`${provisionHost}/api/authorize`, {
      method: "HEAD",
      headers: {
        Authorization: header,
        "Convex-Client": `npm-cli-${version}`,
      },
    });
    // Don't throw an error if this request returns a non-200 status.
    // Big Brain responds with a variety of error codes -- 401 if the token is correctly-formed but not valid, and either 400 or 500 if the token is ill-formed.
    // We only care if this check returns a 200 code (so we can skip logging in again) -- any other errors should be silently skipped and we'll run the whole login flow again.
    if (resp.status !== 200) {
      return false;
    }
  } catch (e: any) {
    // This `catch` block should only be hit if a network error was encountered
    logError(
      `Unexpected error when authorizing - are you connected to the internet?`,
    );
    return await logAndHandleFetchError(ctx, e);
  }

  // Check that we have optin as well
  const shouldContinue = await optins(ctx, acceptOptIns);
  if (!shouldContinue) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null,
    });
  }
  return true;
}

async function performDeviceAuthorization(
  ctx: Context,
  authClient: BaseClient,
  shouldOpen: boolean,
  vercel?: boolean,
  vercelOverride?: string,
): Promise<string> {
  // Device authorization flow follows this guide: https://github.com/auth0/auth0-device-flow-cli-sample/blob/9f0f3b76a6cd56ea8d99e76769187ea5102d519d/cli.js
  // License: MIT License
  // Copyright (c) 2019 Auth0 Samples
  /*
  The MIT License (MIT)

  Copyright (c) 2019 Auth0 Samples

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  */

  // Device Authorization Request - https://tools.ietf.org/html/rfc8628#section-3.1
  // Get authentication URL
  let handle;
  try {
    handle = await authClient.deviceAuthorization();
  } catch {
    // We couldn't get verification URL from the auth provider, proceed with manual auth
    return promptString(ctx, {
      message:
        "Open https://dashboard.convex.dev/auth, log in and paste the token here:",
    });
  }

  // Device Authorization Response - https://tools.ietf.org/html/rfc8628#section-3.2
  // Open authentication URL
  const { verification_uri_complete, user_code, expires_in } = handle;

  // Construct Vercel URL if --vercel flag is used
  const urlToOpen = vercel
    ? `https://vercel.com/sso/integrations/${vercelOverride || "convex"}?url=${verification_uri_complete}`
    : verification_uri_complete;

  logMessage(
    `Visit ${urlToOpen} to finish logging in.\n` +
      `You should see the following code which expires in ${
        expires_in % 60 === 0
          ? `${expires_in / 60} minutes`
          : `${expires_in} seconds`
      }: ${user_code}`,
  );
  if (shouldOpen) {
    shouldOpen = await promptYesNo(ctx, {
      message: `Open the browser?`,
      default: true,
    });
  }

  if (shouldOpen) {
    showSpinner(`Opening ${urlToOpen} in your browser to log in...\n`);
    try {
      const p = await open(urlToOpen);
      p.once("error", () => {
        changeSpinner(`Manually open ${urlToOpen} in your browser to log in.`);
      });
      changeSpinner("Waiting for the confirmation...");
    } catch {
      logError(chalk.red(`Unable to open browser.`));
      changeSpinner(`Manually open ${urlToOpen} in your browser to log in.`);
    }
  } else {
    showSpinner(`Open ${urlToOpen} in your browser to log in.`);
  }

  // Device Access Token Request - https://tools.ietf.org/html/rfc8628#section-3.4
  // Device Access Token Response - https://tools.ietf.org/html/rfc8628#section-3.5
  try {
    const tokens = await handle.poll();
    if (typeof tokens.access_token === "string") {
      return tokens.access_token;
    } else {
      // Unexpected error
      // eslint-disable-next-line no-restricted-syntax
      throw Error("Access token is missing");
    }
  } catch (err: any) {
    switch (err.error) {
      case "access_denied": // end-user declined the device confirmation prompt, consent or rules failed
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Access denied.",
          errForSentry: err,
        });
      case "expired_token": // end-user did not complete the interaction in time
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Device flow expired.",
          errForSentry: err,
        });
      default: {
        const message =
          err instanceof errors.OPError
            ? `Error = ${err.error}; error_description = ${err.error_description}`
            : `Login failed with error: ${err}`;
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: message,
          errForSentry: err,
        });
      }
    }
  }
}

async function performPasswordAuthentication(
  ctx: Context,
  clientId: string,
  username: string,
  password: string,
): Promise<string> {
  if (!process.env.WORKOS_API_SECRET) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "WORKOS_API_SECRET environment variable is not set",
    });
  }

  // Unfortunately, `openid-client` doesn't support the resource owner password credentials flow so we need to manually send the requests.
  const options: Parameters<typeof throwingFetch>[1] = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      email: username,
      password: password,
      client_id: clientId,
      client_secret: process.env.WORKOS_API_SECRET,
    }),
  };

  try {
    const response = await throwingFetch(
      "https://apiauth.convex.dev/user_management/authenticate",
      options,
    );
    const data = await response.json();
    if (typeof data.access_token === "string") {
      return data.access_token;
    } else {
      // Unexpected error
      // eslint-disable-next-line no-restricted-syntax
      throw Error("Access token is missing");
    }
  } catch (err: any) {
    logFailure(`Password flow failed: ${err}`);
    if (err.response) {
      logError(chalk.red(`${JSON.stringify(err.response.data)}`));
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: err,
      printedMessage: null,
    });
  }
}

export async function performLogin(
  ctx: Context,
  {
    overrideAuthUrl,
    overrideAuthClient,
    overrideAuthUsername,
    overrideAuthPassword,
    overrideAccessToken,
    loginFlow,
    open,
    acceptOptIns,
    dumpAccessToken,
    deviceName: deviceNameOverride,
    anonymousId,
    vercel,
    vercelOverride,
  }: {
    overrideAuthUrl?: string | undefined;
    overrideAuthClient?: string | undefined;
    overrideAuthUsername?: string | undefined;
    overrideAuthPassword?: string | undefined;
    overrideAccessToken?: string | undefined;
    loginFlow?: "auto" | "paste" | "poll" | undefined;
    // default `true`
    open?: boolean | undefined;
    // default `false`
    acceptOptIns?: boolean | undefined;
    dumpAccessToken?: boolean | undefined;
    deviceName?: string | undefined;
    anonymousId?: string | undefined;
    vercel?: boolean | undefined;
    vercelOverride?: string | undefined;
  } = {},
) {
  loginFlow = loginFlow || "auto";
  // Get access token from big-brain
  // Default the device name to the hostname, but allow the user to change this if the terminal is interactive.
  // On Macs, the `hostname()` may be a weirdly-truncated form of the computer name. Attempt to read the "real" name before falling back to hostname.
  let deviceName = deviceNameOverride ?? "";
  if (!deviceName && process.platform === "darwin") {
    try {
      deviceName = execSync("scutil --get ComputerName").toString().trim();
    } catch {
      // Just fall back to the hostname default below.
    }
  }
  if (!deviceName) {
    deviceName = hostname();
  }
  if (!deviceNameOverride) {
    logMessage(
      chalk.bold(`Welcome to developing with Convex, let's get you logged in.`),
    );
    deviceName = await promptString(ctx, {
      message: "Device name:",
      default: deviceName,
    });
  }

  const issuer = overrideAuthUrl ?? "https://auth.convex.dev";
  let authIssuer;
  let accessToken: string;

  if (loginFlow === "paste" || (loginFlow === "auto" && isWebContainer())) {
    accessToken = await promptString(ctx, {
      message:
        "Open https://dashboard.convex.dev/auth, log in and paste the token here:",
    });
  } else {
    try {
      authIssuer = await Issuer.discover(issuer);
    } catch {
      // Couldn't contact https://auth.convex.dev/.well-known/openid-configuration,
      // proceed with manual auth.
      accessToken = await promptString(ctx, {
        message:
          "Open https://dashboard.convex.dev/auth, log in and paste the token here:",
      });
    }
  }

  // typical path
  if (authIssuer) {
    const clientId = overrideAuthClient ?? "HFtA247jp9iNs08NTLIB7JsNPMmRIyfi";
    const authClient = new authIssuer.Client({
      client_id: clientId,
      token_endpoint_auth_method: "none",
      id_token_signed_response_alg: "RS256",
    });

    if (overrideAccessToken) {
      accessToken = overrideAccessToken;
    } else if (overrideAuthUsername && overrideAuthPassword) {
      accessToken = await performPasswordAuthentication(
        ctx,
        clientId,
        overrideAuthUsername,
        overrideAuthPassword,
      );
    } else {
      accessToken = await performDeviceAuthorization(
        ctx,
        authClient,
        open ?? true,
        vercel,
        vercelOverride,
      );
    }
  }

  if (dumpAccessToken) {
    logOutput(`${accessToken!}`);
    return await ctx.crash({
      exitCode: 0,
      errorType: "fatal",
      printedMessage: null,
    });
  }

  const authorizeArgs: AuthorizeArgs = {
    authnToken: accessToken!,
    deviceName: deviceName,
    anonymousId: anonymousId,
  };
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: "authorize",
    data: authorizeArgs,
  });
  const globalConfig = { accessToken: data.accessToken };
  try {
    await modifyGlobalConfig(ctx, globalConfig);
    const path = globalConfigPath();
    logFinishedStep(`Saved credentials to ${formatPathForPrinting(path)}`);
  } catch (err: unknown) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: null,
    });
  }

  logVerbose(`performLogin: updating big brain auth after login`);
  await updateBigBrainAuthAfterLogin(ctx, data.accessToken);

  logVerbose(`performLogin: checking opt ins, acceptOptIns: ${acceptOptIns}`);
  // Do opt in to TOS and Privacy Policy stuff
  const shouldContinue = await optins(ctx, acceptOptIns ?? false);
  if (!shouldContinue) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null,
    });
  }
}

/// There are fields like version, but we keep them opaque
type OptIn = Record<string, unknown>;

type OptInToAccept = {
  optIn: OptIn;
  message: string;
};

type AcceptOptInsArgs = {
  optInsAccepted: OptIn[];
};

// Returns whether we can proceed or not.
async function optins(ctx: Context, acceptOptIns: boolean): Promise<boolean> {
  const bbAuth = ctx.bigBrainAuth();
  if (bbAuth === null) {
    // This should never happen, but if we're not even logged in, we can't proceed.
    return false;
  }
  switch (bbAuth.kind) {
    case "accessToken":
      break;
    case "deploymentKey":
    case "projectKey":
    case "previewDeployKey":
      // If we have a key configured as auth, we do not need to check opt ins.
      return true;
    default: {
      bbAuth satisfies never;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: `Unexpected auth kind ${(bbAuth as any).kind}`,
        printedMessage: "Hit an unexpected error while logging in.",
      });
    }
  }
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: "check_opt_ins",
  });
  if (data.optInsToAccept.length === 0) {
    return true;
  }
  for (const optInToAccept of data.optInsToAccept) {
    const confirmed =
      acceptOptIns ||
      (await promptYesNo(ctx, {
        message: optInToAccept.message,
      }));
    if (!confirmed) {
      logFailure("Please accept the Terms of Service to use Convex.");
      return Promise.resolve(false);
    }
  }

  const optInsAccepted = data.optInsToAccept.map((o: OptInToAccept) => o.optIn);
  const args: AcceptOptInsArgs = { optInsAccepted };
  await bigBrainAPI({ ctx, method: "POST", url: "accept_opt_ins", data: args });
  return true;
}

export async function ensureLoggedIn(
  ctx: Context,
  options?: {
    message?: string | undefined;
    overrideAuthUrl?: string | undefined;
    overrideAuthClient?: string | undefined;
    overrideAuthUsername?: string | undefined;
    overrideAuthPassword?: string | undefined;
  },
) {
  const isLoggedIn = await checkAuthorization(ctx, false);
  if (!isLoggedIn) {
    if (options?.message) {
      logMessage(options.message);
    }
    await performLogin(ctx, {
      acceptOptIns: false,
      overrideAuthUrl: options?.overrideAuthUrl,
      overrideAuthClient: options?.overrideAuthClient,
      overrideAuthUsername: options?.overrideAuthUsername,
      overrideAuthPassword: options?.overrideAuthPassword,
    });
  }
}
