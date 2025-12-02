/**
 * Help the developer store the CONVEX_URL environment variable.
 */
import chalk from "chalk";
import * as dotenv from "dotenv";

import { Context } from "../../bundler/context.js";
import { logWarning } from "../../bundler/log.js";
import { loadPackageJson } from "./utils/utils.js";

const _FRAMEWORKS = [
  "create-react-app",
  "Next.js",
  "Vite",
  "Remix",
  "SvelteKit",
  "Expo",
  "TanStackStart",
] as const;
type Framework = (typeof _FRAMEWORKS)[number];

type ConvexUrlWriteConfig = {
  envFile: string;
  envVar: string;
  existingFileContent: string | null;
} | null;

export async function writeConvexUrlToEnvFile(
  ctx: Context,
  value: string,
): Promise<ConvexUrlWriteConfig> {
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
    commentOnPreviousLine: null,
  })!;
  ctx.fs.writeUtf8File(envFile, modified);
  return writeConfig;
}

export function changedEnvVarFile({
  existingFileContent,
  envVarName,
  envVarValue,
  commentAfterValue,
  commentOnPreviousLine,
}: {
  existingFileContent: string | null;
  envVarName: string;
  envVarValue: string;
  commentAfterValue: string | null;
  commentOnPreviousLine: string | null;
}): string | null {
  const varAssignment = `${envVarName}=${envVarValue}${
    commentAfterValue === null ? "" : ` # ${commentAfterValue}`
  }`;
  const commentOnPreviousLineWithLineBreak =
    commentOnPreviousLine === null ? "" : `${commentOnPreviousLine}\n`;
  if (existingFileContent === null) {
    return `${commentOnPreviousLineWithLineBreak}${varAssignment}\n`;
  }
  const config = dotenv.parse(existingFileContent);
  const existing = config[envVarName];
  if (existing === envVarValue) {
    return null;
  }
  if (existing !== undefined) {
    return existingFileContent.replace(
      getEnvVarRegex(envVarName),
      `${varAssignment}`,
    );
  } else {
    const doubleLineBreak = existingFileContent.endsWith("\n") ? "\n" : "\n\n";
    return (
      existingFileContent +
      doubleLineBreak +
      commentOnPreviousLineWithLineBreak +
      varAssignment +
      "\n"
    );
  }
}

export function getEnvVarRegex(envVarName: string) {
  return new RegExp(`^${envVarName}.*$`, "m");
}

export async function suggestedEnvVarName(ctx: Context): Promise<{
  detectedFramework?: Framework;
  envVar: string;
  frontendDevUrl?: string;
  publicPrefix?: string;
}> {
  // no package.json, that's fine, just guess
  if (!ctx.fs.exists("package.json")) {
    return {
      envVar: "CONVEX_URL",
    };
  }

  const packages = await loadPackageJson(ctx);

  // Is it create-react-app?
  const isCreateReactApp = "react-scripts" in packages;
  if (isCreateReactApp) {
    return {
      detectedFramework: "create-react-app",
      envVar: "REACT_APP_CONVEX_URL",
      frontendDevUrl: "http://localhost:3000",
      publicPrefix: "REACT_APP_",
    };
  }

  const isNextJs = "next" in packages;
  if (isNextJs) {
    return {
      detectedFramework: "Next.js",
      envVar: "NEXT_PUBLIC_CONVEX_URL",
      frontendDevUrl: "http://localhost:3000",
      publicPrefix: "NEXT_PUBLIC_",
    };
  }

  const isExpo = "expo" in packages;
  if (isExpo) {
    return {
      detectedFramework: "Expo",
      envVar: "EXPO_PUBLIC_CONVEX_URL",
      publicPrefix: "EXPO_PUBLIC_",
    };
  }

  const isRemix = "@remix-run/dev" in packages;
  if (isRemix) {
    return {
      detectedFramework: "Remix",
      envVar: "CONVEX_URL",
      frontendDevUrl: "http://localhost:3000",
    };
  }

  const isSvelteKit = "@sveltejs/kit" in packages;
  if (isSvelteKit) {
    return {
      detectedFramework: "SvelteKit",
      envVar: "PUBLIC_CONVEX_URL",
      frontendDevUrl: "http://localhost:5173",
      publicPrefix: "PUBLIC_",
    };
  }

  // TanStackStart currently supports VITE_FOO for browser-side envvars.
  const isTanStackStart =
    "@tanstack/start" in packages || "@tanstack/react-start" in packages;

  if (isTanStackStart) {
    return {
      detectedFramework: "TanStackStart",
      envVar: "VITE_CONVEX_URL",
      frontendDevUrl: "http://localhost:3000",
      publicPrefix: "VITE_",
    };
  }

  // Vite is a dependency of a lot of things; vite appearing in dependencies is not a strong indicator.
  const isVite = "vite" in packages;

  if (isVite) {
    return {
      detectedFramework: "Vite",
      envVar: "VITE_CONVEX_URL",
      frontendDevUrl: "http://localhost:5173",
      publicPrefix: "VITE_",
    };
  }

  return {
    envVar: "CONVEX_URL",
  };
}

async function envVarWriteConfig(
  ctx: Context,
  value: string | null,
): Promise<ConvexUrlWriteConfig> {
  const { detectedFramework, envVar } = await suggestedEnvVarName(ctx);

  const { envFile, existing } = suggestedDevEnvFile(ctx, detectedFramework);

  if (!existing) {
    return { envFile, envVar, existingFileContent: null };
  }

  const existingFileContent = ctx.fs.readUtf8File(envFile);
  const config = dotenv.parse(existingFileContent);

  const matching = Object.keys(config).filter((key) => EXPECTED_NAMES.has(key));
  if (matching.length > 1) {
    logWarning(
      chalk.yellow(
        `Found multiple CONVEX_URL environment variables in ${envFile} so cannot update automatically.`,
      ),
    );
    return null;
  }
  if (matching.length === 1) {
    const [existingEnvVar, oldValue] = [matching[0], config[matching[0]]];
    if (oldValue === value) {
      return null;
    }
    if (
      oldValue !== "" &&
      Object.values(config).filter((v) => v === oldValue).length !== 1
    ) {
      logWarning(
        chalk.yellow(`Can't safely modify ${envFile}, please edit manually.`),
      );
      return null;
    }
    return { envFile, envVar: existingEnvVar, existingFileContent };
  }
  return { envFile, envVar, existingFileContent };
}

function suggestedDevEnvFile(
  ctx: Context,
  framework?: Framework,
): {
  existing: boolean;
  envFile: string;
} {
  // If a .env.local file exists, that's unequivocally the right file
  if (ctx.fs.exists(".env.local")) {
    return {
      existing: true,
      envFile: ".env.local",
    };
  }

  // Remix is on team "don't commit the .env file," so .env is for dev.
  if (framework === "Remix") {
    return {
      existing: ctx.fs.exists(".env"),
      envFile: ".env",
    };
  }

  // The most dev-looking env file that exists, or .env.local
  return {
    existing: ctx.fs.exists(".env.local"),
    envFile: ".env.local",
  };
}

const EXPECTED_NAMES = new Set([
  "CONVEX_URL",
  "PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "VITE_CONVEX_URL",
  "REACT_APP_CONVEX_URL",
  "EXPO_PUBLIC_CONVEX_URL",
]);

// Crash or warn on
// CONVEX_DEPLOY_KEY=project:me:new-project|eyABCD0= npx convex
// which parses as
// CONVEX_DEPLOY_KEY=project:me:new-project | eyABCD0='' npx convex
// when what was intended was
// CONVEX_DEPLOY_KEY=project:me:new-project|eyABCD0= npx convex
// This only fails so catastrophically when the key ends with `=`.
export async function detectSuspiciousEnvironmentVariables(
  ctx: Context,
  ignoreSuspiciousEnvVars = false,
) {
  for (const [key, value] of Object.entries(process.env)) {
    if (value === "" && key.startsWith("ey")) {
      try {
        // add a "=" to the end and try to base64 decode (expected format of Convex keys)
        const decoded = JSON.parse(
          Buffer.from(key + "=", "base64").toString("utf8"),
        );
        // Only parseable v2 tokens to be sure this is a Convex token before complaining.
        if (!("v2" in decoded)) {
          continue;
        }
      } catch {
        continue;
      }

      if (ignoreSuspiciousEnvVars) {
        logWarning(
          `ignoring suspicious environment variable ${key}, did you mean to use quotes like CONVEX_DEPLOY_KEY='...'?`,
        );
      } else {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Quotes are required around environment variable values by your shell: CONVEX_DEPLOY_KEY='project:name:project|${key.slice(0, 4)}...${key.slice(key.length - 4)}=' npx convex dev`,
        });
      }
    }
  }
}

export function getBuildEnvironment(): string | false {
  return process.env.VERCEL
    ? "Vercel"
    : process.env.NETLIFY
      ? "Netlify"
      : false;
}

export function gitBranchFromEnvironment(): string | null {
  if (process.env.VERCEL) {
    // https://vercel.com/docs/projects/environment-variables/system-environment-variables
    return process.env.VERCEL_GIT_COMMIT_REF ?? null;
  }
  if (process.env.NETLIFY) {
    // https://docs.netlify.com/configure-builds/environment-variables/
    return process.env.HEAD ?? null;
  }

  if (process.env.CI) {
    // https://docs.github.com/en/actions/learn-github-actions/variables
    // https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
    return (
      process.env.GITHUB_HEAD_REF ?? process.env.CI_COMMIT_REF_NAME ?? null
    );
  }

  return null;
}

export function isNonProdBuildEnvironment(): boolean {
  if (process.env.VERCEL) {
    // https://vercel.com/docs/projects/environment-variables/system-environment-variables
    return process.env.VERCEL_ENV !== "production";
  }
  if (process.env.NETLIFY) {
    // https://docs.netlify.com/configure-builds/environment-variables/
    return process.env.CONTEXT !== "production";
  }
  return false;
}
