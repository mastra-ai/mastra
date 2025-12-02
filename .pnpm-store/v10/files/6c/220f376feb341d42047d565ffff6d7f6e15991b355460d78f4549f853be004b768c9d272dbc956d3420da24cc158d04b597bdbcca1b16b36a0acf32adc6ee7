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
var login_exports = {};
__export(login_exports, {
  checkAuthorization: () => checkAuthorization,
  ensureLoggedIn: () => ensureLoggedIn,
  performLogin: () => performLogin
});
module.exports = __toCommonJS(login_exports);
var import_openid_client = require("openid-client");
var import_utils = require("./utils/utils.js");
var import_open = __toESM(require("open"), 1);
var import_chalk = __toESM(require("chalk"), 1);
var import_config = require("./config.js");
var import_version = require("../version.js");
var import_log = require("../../bundler/log.js");
var import_openid_client2 = require("openid-client");
var import_os = require("os");
var import_child_process = require("child_process");
var import_prompts = require("./utils/prompts.js");
var import_globalConfig = require("./utils/globalConfig.js");
var import_deploymentSelection = require("./deploymentSelection.js");
import_openid_client.custom.setHttpOptionsDefaults({
  timeout: parseInt(process.env.OPENID_CLIENT_TIMEOUT || "10000")
});
async function checkAuthorization(ctx, acceptOptIns) {
  const header = ctx.bigBrainAuth()?.header ?? null;
  if (header === null) {
    return false;
  }
  try {
    const resp = await fetch(`${import_config.provisionHost}/api/authorize`, {
      method: "HEAD",
      headers: {
        Authorization: header,
        "Convex-Client": `npm-cli-${import_version.version}`
      }
    });
    if (resp.status !== 200) {
      return false;
    }
  } catch (e) {
    (0, import_log.logError)(
      `Unexpected error when authorizing - are you connected to the internet?`
    );
    return await (0, import_utils.logAndHandleFetchError)(ctx, e);
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
    return (0, import_prompts.promptString)(ctx, {
      message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
    });
  }
  const { verification_uri_complete, user_code, expires_in } = handle;
  const urlToOpen = vercel ? `https://vercel.com/sso/integrations/${vercelOverride || "convex"}?url=${verification_uri_complete}` : verification_uri_complete;
  (0, import_log.logMessage)(
    `Visit ${urlToOpen} to finish logging in.
You should see the following code which expires in ${expires_in % 60 === 0 ? `${expires_in / 60} minutes` : `${expires_in} seconds`}: ${user_code}`
  );
  if (shouldOpen) {
    shouldOpen = await (0, import_prompts.promptYesNo)(ctx, {
      message: `Open the browser?`,
      default: true
    });
  }
  if (shouldOpen) {
    (0, import_log.showSpinner)(`Opening ${urlToOpen} in your browser to log in...
`);
    try {
      const p = await (0, import_open.default)(urlToOpen);
      p.once("error", () => {
        (0, import_log.changeSpinner)(`Manually open ${urlToOpen} in your browser to log in.`);
      });
      (0, import_log.changeSpinner)("Waiting for the confirmation...");
    } catch {
      (0, import_log.logError)(import_chalk.default.red(`Unable to open browser.`));
      (0, import_log.changeSpinner)(`Manually open ${urlToOpen} in your browser to log in.`);
    }
  } else {
    (0, import_log.showSpinner)(`Open ${urlToOpen} in your browser to log in.`);
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
        const message = err instanceof import_openid_client.errors.OPError ? `Error = ${err.error}; error_description = ${err.error_description}` : `Login failed with error: ${err}`;
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
    const response = await (0, import_utils.throwingFetch)(
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
    (0, import_log.logFailure)(`Password flow failed: ${err}`);
    if (err.response) {
      (0, import_log.logError)(import_chalk.default.red(`${JSON.stringify(err.response.data)}`));
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: err,
      printedMessage: null
    });
  }
}
async function performLogin(ctx, {
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
      deviceName = (0, import_child_process.execSync)("scutil --get ComputerName").toString().trim();
    } catch {
    }
  }
  if (!deviceName) {
    deviceName = (0, import_os.hostname)();
  }
  if (!deviceNameOverride) {
    (0, import_log.logMessage)(
      import_chalk.default.bold(`Welcome to developing with Convex, let's get you logged in.`)
    );
    deviceName = await (0, import_prompts.promptString)(ctx, {
      message: "Device name:",
      default: deviceName
    });
  }
  const issuer = overrideAuthUrl ?? "https://auth.convex.dev";
  let authIssuer;
  let accessToken;
  if (loginFlow === "paste" || loginFlow === "auto" && (0, import_utils.isWebContainer)()) {
    accessToken = await (0, import_prompts.promptString)(ctx, {
      message: "Open https://dashboard.convex.dev/auth, log in and paste the token here:"
    });
  } else {
    try {
      authIssuer = await import_openid_client2.Issuer.discover(issuer);
    } catch {
      accessToken = await (0, import_prompts.promptString)(ctx, {
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
    (0, import_log.logOutput)(`${accessToken}`);
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
  const data = await (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "authorize",
    data: authorizeArgs
  });
  const globalConfig = { accessToken: data.accessToken };
  try {
    await (0, import_globalConfig.modifyGlobalConfig)(ctx, globalConfig);
    const path = (0, import_globalConfig.globalConfigPath)();
    (0, import_log.logFinishedStep)(`Saved credentials to ${(0, import_globalConfig.formatPathForPrinting)(path)}`);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: null
    });
  }
  (0, import_log.logVerbose)(`performLogin: updating big brain auth after login`);
  await (0, import_deploymentSelection.updateBigBrainAuthAfterLogin)(ctx, data.accessToken);
  (0, import_log.logVerbose)(`performLogin: checking opt ins, acceptOptIns: ${acceptOptIns}`);
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
  const data = await (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "check_opt_ins"
  });
  if (data.optInsToAccept.length === 0) {
    return true;
  }
  for (const optInToAccept of data.optInsToAccept) {
    const confirmed = acceptOptIns || await (0, import_prompts.promptYesNo)(ctx, {
      message: optInToAccept.message
    });
    if (!confirmed) {
      (0, import_log.logFailure)("Please accept the Terms of Service to use Convex.");
      return Promise.resolve(false);
    }
  }
  const optInsAccepted = data.optInsToAccept.map((o) => o.optIn);
  const args = { optInsAccepted };
  await (0, import_utils.bigBrainAPI)({ ctx, method: "POST", url: "accept_opt_ins", data: args });
  return true;
}
async function ensureLoggedIn(ctx, options) {
  const isLoggedIn = await checkAuthorization(ctx, false);
  if (!isLoggedIn) {
    if (options?.message) {
      (0, import_log.logMessage)(options.message);
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
