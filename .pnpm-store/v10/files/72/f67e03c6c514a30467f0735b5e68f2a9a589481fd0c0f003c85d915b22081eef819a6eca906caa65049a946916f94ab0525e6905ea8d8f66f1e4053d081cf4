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
var envvars_exports = {};
__export(envvars_exports, {
  changedEnvVarFile: () => changedEnvVarFile,
  detectSuspiciousEnvironmentVariables: () => detectSuspiciousEnvironmentVariables,
  getBuildEnvironment: () => getBuildEnvironment,
  getEnvVarRegex: () => getEnvVarRegex,
  gitBranchFromEnvironment: () => gitBranchFromEnvironment,
  isNonProdBuildEnvironment: () => isNonProdBuildEnvironment,
  suggestedEnvVarName: () => suggestedEnvVarName,
  writeConvexUrlToEnvFile: () => writeConvexUrlToEnvFile
});
module.exports = __toCommonJS(envvars_exports);
var import_chalk = __toESM(require("chalk"), 1);
var dotenv = __toESM(require("dotenv"), 1);
var import_log = require("../../bundler/log.js");
var import_utils = require("./utils/utils.js");
const _FRAMEWORKS = [
  "create-react-app",
  "Next.js",
  "Vite",
  "Remix",
  "SvelteKit",
  "Expo",
  "TanStackStart"
];
async function writeConvexUrlToEnvFile(ctx, value) {
  const writeConfig = await envVarWriteConfig(ctx, value);
  if (writeConfig === null) {
    return null;
  }
  const { envFile, envVar, existingFileContent } = writeConfig;
  const modified = changedEnvVarFile({
    existingFileContent,
    envVarName: envVar,
    envVarValue: value,
    commentAfterValue: null,
    commentOnPreviousLine: null
  });
  ctx.fs.writeUtf8File(envFile, modified);
  return writeConfig;
}
function changedEnvVarFile({
  existingFileContent,
  envVarName,
  envVarValue,
  commentAfterValue,
  commentOnPreviousLine
}) {
  const varAssignment = `${envVarName}=${envVarValue}${commentAfterValue === null ? "" : ` # ${commentAfterValue}`}`;
  const commentOnPreviousLineWithLineBreak = commentOnPreviousLine === null ? "" : `${commentOnPreviousLine}
`;
  if (existingFileContent === null) {
    return `${commentOnPreviousLineWithLineBreak}${varAssignment}
`;
  }
  const config = dotenv.parse(existingFileContent);
  const existing = config[envVarName];
  if (existing === envVarValue) {
    return null;
  }
  if (existing !== void 0) {
    return existingFileContent.replace(
      getEnvVarRegex(envVarName),
      `${varAssignment}`
    );
  } else {
    const doubleLineBreak = existingFileContent.endsWith("\n") ? "\n" : "\n\n";
    return existingFileContent + doubleLineBreak + commentOnPreviousLineWithLineBreak + varAssignment + "\n";
  }
}
function getEnvVarRegex(envVarName) {
  return new RegExp(`^${envVarName}.*$`, "m");
}
async function suggestedEnvVarName(ctx) {
  if (!ctx.fs.exists("package.json")) {
    return {
      envVar: "CONVEX_URL"
    };
  }
  const packages = await (0, import_utils.loadPackageJson)(ctx);
  const isCreateReactApp = "react-scripts" in packages;
  if (isCreateReactApp) {
    return {
      detectedFramework: "create-react-app",
      envVar: "REACT_APP_CONVEX_URL",
      frontendDevUrl: "http://localhost:3000",
      publicPrefix: "REACT_APP_"
    };
  }
  const isNextJs = "next" in packages;
  if (isNextJs) {
    return {
      detectedFramework: "Next.js",
      envVar: "NEXT_PUBLIC_CONVEX_URL",
      frontendDevUrl: "http://localhost:3000",
      publicPrefix: "NEXT_PUBLIC_"
    };
  }
  const isExpo = "expo" in packages;
  if (isExpo) {
    return {
      detectedFramework: "Expo",
      envVar: "EXPO_PUBLIC_CONVEX_URL",
      publicPrefix: "EXPO_PUBLIC_"
    };
  }
  const isRemix = "@remix-run/dev" in packages;
  if (isRemix) {
    return {
      detectedFramework: "Remix",
      envVar: "CONVEX_URL",
      frontendDevUrl: "http://localhost:3000"
    };
  }
  const isSvelteKit = "@sveltejs/kit" in packages;
  if (isSvelteKit) {
    return {
      detectedFramework: "SvelteKit",
      envVar: "PUBLIC_CONVEX_URL",
      frontendDevUrl: "http://localhost:5173",
      publicPrefix: "PUBLIC_"
    };
  }
  const isTanStackStart = "@tanstack/start" in packages || "@tanstack/react-start" in packages;
  if (isTanStackStart) {
    return {
      detectedFramework: "TanStackStart",
      envVar: "VITE_CONVEX_URL",
      frontendDevUrl: "http://localhost:3000",
      publicPrefix: "VITE_"
    };
  }
  const isVite = "vite" in packages;
  if (isVite) {
    return {
      detectedFramework: "Vite",
      envVar: "VITE_CONVEX_URL",
      frontendDevUrl: "http://localhost:5173",
      publicPrefix: "VITE_"
    };
  }
  return {
    envVar: "CONVEX_URL"
  };
}
async function envVarWriteConfig(ctx, value) {
  const { detectedFramework, envVar } = await suggestedEnvVarName(ctx);
  const { envFile, existing } = suggestedDevEnvFile(ctx, detectedFramework);
  if (!existing) {
    return { envFile, envVar, existingFileContent: null };
  }
  const existingFileContent = ctx.fs.readUtf8File(envFile);
  const config = dotenv.parse(existingFileContent);
  const matching = Object.keys(config).filter((key) => EXPECTED_NAMES.has(key));
  if (matching.length > 1) {
    (0, import_log.logWarning)(
      import_chalk.default.yellow(
        `Found multiple CONVEX_URL environment variables in ${envFile} so cannot update automatically.`
      )
    );
    return null;
  }
  if (matching.length === 1) {
    const [existingEnvVar, oldValue] = [matching[0], config[matching[0]]];
    if (oldValue === value) {
      return null;
    }
    if (oldValue !== "" && Object.values(config).filter((v) => v === oldValue).length !== 1) {
      (0, import_log.logWarning)(
        import_chalk.default.yellow(`Can't safely modify ${envFile}, please edit manually.`)
      );
      return null;
    }
    return { envFile, envVar: existingEnvVar, existingFileContent };
  }
  return { envFile, envVar, existingFileContent };
}
function suggestedDevEnvFile(ctx, framework) {
  if (ctx.fs.exists(".env.local")) {
    return {
      existing: true,
      envFile: ".env.local"
    };
  }
  if (framework === "Remix") {
    return {
      existing: ctx.fs.exists(".env"),
      envFile: ".env"
    };
  }
  return {
    existing: ctx.fs.exists(".env.local"),
    envFile: ".env.local"
  };
}
const EXPECTED_NAMES = /* @__PURE__ */ new Set([
  "CONVEX_URL",
  "PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "VITE_CONVEX_URL",
  "REACT_APP_CONVEX_URL",
  "EXPO_PUBLIC_CONVEX_URL"
]);
async function detectSuspiciousEnvironmentVariables(ctx, ignoreSuspiciousEnvVars = false) {
  for (const [key, value] of Object.entries(process.env)) {
    if (value === "" && key.startsWith("ey")) {
      try {
        const decoded = JSON.parse(
          Buffer.from(key + "=", "base64").toString("utf8")
        );
        if (!("v2" in decoded)) {
          continue;
        }
      } catch {
        continue;
      }
      if (ignoreSuspiciousEnvVars) {
        (0, import_log.logWarning)(
          `ignoring suspicious environment variable ${key}, did you mean to use quotes like CONVEX_DEPLOY_KEY='...'?`
        );
      } else {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Quotes are required around environment variable values by your shell: CONVEX_DEPLOY_KEY='project:name:project|${key.slice(0, 4)}...${key.slice(key.length - 4)}=' npx convex dev`
        });
      }
    }
  }
}
function getBuildEnvironment() {
  return process.env.VERCEL ? "Vercel" : process.env.NETLIFY ? "Netlify" : false;
}
function gitBranchFromEnvironment() {
  if (process.env.VERCEL) {
    return process.env.VERCEL_GIT_COMMIT_REF ?? null;
  }
  if (process.env.NETLIFY) {
    return process.env.HEAD ?? null;
  }
  if (process.env.CI) {
    return process.env.GITHUB_HEAD_REF ?? process.env.CI_COMMIT_REF_NAME ?? null;
  }
  return null;
}
function isNonProdBuildEnvironment() {
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV !== "production";
  }
  if (process.env.NETLIFY) {
    return process.env.CONTEXT !== "production";
  }
  return false;
}
//# sourceMappingURL=envvars.js.map
