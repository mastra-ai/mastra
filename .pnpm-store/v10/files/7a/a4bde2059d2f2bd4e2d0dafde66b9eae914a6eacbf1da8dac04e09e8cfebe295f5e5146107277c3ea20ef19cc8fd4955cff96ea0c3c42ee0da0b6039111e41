"use strict";
import { errors, custom } from "openid-client";
import {
  bigBrainAPI,
  logAndHandleFetchError,
  throwingFetch,
  isWebContainer
} from "./utils/utils.js";
import open from "open";
import chalk from "chalk";
import { provisionHost } from "./config.js";
import { version } from "../version.js";
import {
  changeSpinner,
  logError,
  logFailure,
  logFinishedStep,
  logMessage,
  logOutput,
  logVerbose,
  showSpinner
} from "../../bundler/log.js";
import { Issuer } from "openid-client";
import { hostname } from "os";
import { execSync } from "child_process";
import { promptString, promptYesNo } from "./utils/prompts.js";
import {
  formatPathForPrinting,
  globalConfigPath,
  modifyGlobalConfig
} from "./utils/globalConfig.js";
import { updateBigBrainAuthAfterLogin } from "./deploymentSelection.js";
custom.setHttpOptionsDefaults({
  timeout: parseInt(process.env.OPENID_CLIENT_TIMEOUT || "10000")
});
export async function checkAuthorization(ctx, acceptOptIns) {
  const header = ctx.bigBrainAuth()?.header ?? null;
  if (header === null) {
    return false;
  }
  try {
    const resp = await fetch(`${provisionHost}/api/authorize`, {
      method: "HEAD",
      headers: {
        Authorization: header,
        "Convex-Client": `npm-cli-${version}`
      }
    });
    if (resp.status !== 200) {
      return false;
    }
  } catch (e) {
    logError(
      `Unexpected error when authorizing - are you connected to the internet?`
    );
    return await logAndHandleFetchError(ctx, e);
  }
  const shouldContinue = await optins(ctx, acceptOptIns);
  if (!shouldContinue) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null
    });
  }
  return true;
}
async function performDeviceAuthorization(ctx, authClient, shouldOpen, vercel, vercelOverride) {
  let handle;
  try {
    handle = await authClient.deviceAuthorization();
  } catch {
    return promptString(ctx, {
      message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
    });
  }
  const { verification_uri_complete, user_code, expires_in } = handle;
  const urlToOpen = vercel ? `https://vercel.com/sso/integrations/${vercelOverride || "convex"}?url=${verification_uri_complete}` : verification_uri_complete;
  logMessage(
    `Visit ${urlToOpen} to finish logging in.
You should see the following code which expires in ${expires_in % 60 === 0 ? `${expires_in / 60} minutes` : `${expires_in} seconds`}: ${user_code}`
  );
  if (shouldOpen) {
    shouldOpen = await promptYesNo(ctx, {
      message: `Open the browser?`,
      default: true
    });
  }
  if (shouldOpen) {
    showSpinner(`Opening ${urlToOpen} in your browser to log in...
`);
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
  try {
    const tokens = await handle.poll();
    if (typeof tokens.access_token === "string") {
      return tokens.access_token;
    } else {
      throw Error("Access token is missing");
    }
  } catch (err) {
    switch (err.error) {
      case "access_denied":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Access denied.",
          errForSentry: err
        });
      case "expired_token":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Device flow expired.",
          errForSentry: err
        });
      default: {
        const message = err instanceof errors.OPError ? `Error = ${err.error}; error_description = ${err.error_description}` : `Login failed with error: ${err}`;
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: message,
          errForSentry: err
        });
      }
    }
  }
}
async function performPasswordAuthentication(ctx, clientId, username, password) {
  if (!process.env.WORKOS_API_SECRET) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "WORKOS_API_SECRET environment variable is not set"
    });
  }
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      email: username,
      password,
      client_id: clientId,
      client_secret: process.env.WORKOS_API_SECRET
    })
  };
  try {
    const response = await throwingFetch(
      "https://apiauth.convex.dev/user_management/authenticate",
      options
    );
    const data = await response.json();
    if (typeof data.access_token === "string") {
      return data.access_token;
    } else {
      throw Error("Access token is missing");
    }
  } catch (err) {
    logFailure(`Password flow failed: ${err}`);
    if (err.response) {
      logError(chalk.red(`${JSON.stringify(err.response.data)}`));
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: err,
      printedMessage: null
    });
  }
}
export async function performLogin(ctx, {
  overrideAuthUrl,
  overrideAuthClient,
  overrideAuthUsername,
  overrideAuthPassword,
  overrideAccessToken,
  loginFlow,
  open: open2,
  acceptOptIns,
  dumpAccessToken,
  deviceName: deviceNameOverride,
  anonymousId,
  vercel,
  vercelOverride
} = {}) {
  loginFlow = loginFlow || "auto";
  let deviceName = deviceNameOverride ?? "";
  if (!deviceName && process.platform === "darwin") {
    try {
      deviceName = execSync("scutil --get ComputerName").toString().trim();
    } catch {
    }
  }
  if (!deviceName) {
    deviceName = hostname();
  }
  if (!deviceNameOverride) {
    logMessage(
      chalk.bold(`Welcome to developing with Convex, let's get you logged in.`)
    );
    deviceName = await promptString(ctx, {
      message: "Device name:",
      default: deviceName
    });
  }
  const issuer = overrideAuthUrl ?? "https://auth.convex.dev";
  let authIssuer;
  let accessToken;
  if (loginFlow === "paste" || loginFlow === "auto" && isWebContainer()) {
    accessToken = await promptString(ctx, {
      message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
    });
  } else {
    try {
      authIssuer = await Issuer.discover(issuer);
    } catch {
      accessToken = await promptString(ctx, {
        message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
      });
    }
  }
  if (authIssuer) {
    const clientId = overrideAuthClient ?? "HFtA247jp9iNs08NTLIB7JsNPMmRIyfi";
    const authClient = new authIssuer.Client({
      client_id: clientId,
      token_endpoint_auth_method: "none",
      id_token_signed_response_alg: "RS256"
    });
    if (overrideAccessToken) {
      accessToken = overrideAccessToken;
    } else if (overrideAuthUsername && overrideAuthPassword) {
      accessToken = await performPasswordAuthentication(
        ctx,
        clientId,
        overrideAuthUsername,
        overrideAuthPassword
      );
    } else {
      accessToken = await performDeviceAuthorization(
        ctx,
        authClient,
        open2 ?? true,
        vercel,
        vercelOverride
      );
    }
  }
  if (dumpAccessToken) {
    logOutput(`${accessToken}`);
    return await ctx.crash({
      exitCode: 0,
      errorType: "fatal",
      printedMessage: null
    });
  }
  const authorizeArgs = {
    authnToken: accessToken,
    deviceName,
    anonymousId
  };
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: "authorize",
    data: authorizeArgs
  });
  const globalConfig = { accessToken: data.accessToken };
  try {
    await modifyGlobalConfig(ctx, globalConfig);
    const path = globalConfigPath();
    logFinishedStep(`Saved credentials to ${formatPathForPrinting(path)}`);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: null
    });
  }
  logVerbose(`performLogin: updating big brain auth after login`);
  await updateBigBrainAuthAfterLogin(ctx, data.accessToken);
  logVerbose(`performLogin: checking opt ins, acceptOptIns: ${acceptOptIns}`);
  const shouldContinue = await optins(ctx, acceptOptIns ?? false);
  if (!shouldContinue) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null
    });
  }
}
async function optins(ctx, acceptOptIns) {
  const bbAuth = ctx.bigBrainAuth();
  if (bbAuth === null) {
    return false;
  }
  switch (bbAuth.kind) {
    case "accessToken":
      break;
    case "deploymentKey":
    case "projectKey":
    case "previewDeployKey":
      return true;
    default: {
      bbAuth;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: `Unexpected auth kind ${bbAuth.kind}`,
        printedMessage: "Hit an unexpected error while logging in."
      });
    }
  }
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: "check_opt_ins"
  });
  if (data.optInsToAccept.length === 0) {
    return true;
  }
  for (const optInToAccept of data.optInsToAccept) {
    const confirmed = acceptOptIns || await promptYesNo(ctx, {
      message: optInToAccept.message
    });
    if (!confirmed) {
      logFailure("Please accept the Terms of Service to use Convex.");
      return Promise.resolve(false);
    }
  }
  const optInsAccepted = data.optInsToAccept.map((o) => o.optIn);
  const args = { optInsAccepted };
  await bigBrainAPI({ ctx, method: "POST", url: "accept_opt_ins", data: args });
  return true;
}
export async function ensureLoggedIn(ctx, options) {
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
      overrideAuthPassword: options?.overrideAuthPassword
    });
  }
}
//# sourceMappingURL=login.js.map
