import inquirer from "inquirer";
import { Context } from "../../../bundler/context.js";
import { logOutput } from "../../../bundler/log.js";
export const promptString = async (
  ctx: Context,
  options: {
    message: string;
    default?: string;
  },
): Promise<string> => {
  if (process.stdin.isTTY) {
    const result = (
      await inquirer.prompt([
        {
          type: "input",
          name: "result",
          message: options.message,
          default: options.default,
        },
      ])
    ).result;
    return result;
  } else {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`,
    });
  }
};

export const promptOptions = async <V>(
  ctx: Context,
  options: {
    message: string;
    choices: Array<{ name: string; value: V }>;
    default?: V;
    prefix?: string;
    suffix?: string;
  },
): Promise<V> => {
  if (process.stdin.isTTY) {
    const result = (
      await inquirer.prompt([
        {
          // In the Convex mono-repo, `list` seems to cause the command to not
          // respond to CTRL+C while `search-list` does not.
          type: process.env.CONVEX_RUNNING_LIVE_IN_MONOREPO
            ? "search-list"
            : "list",
          name: "result",
          message: options.message,
          ...(options.prefix ? { prefix: options.prefix } : {}),
          ...(options.suffix ? { suffix: options.suffix } : {}),
          choices: options.choices,
          default: options.default,
        },
      ])
    ).result;
    return result;
  } else {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`,
    });
  }
};

export const promptSearch = async <V>(
  ctx: Context,
  options: {
    message: string;
    choices: Array<{ name: string; value: V }>;
    default?: V;
  },
): Promise<V> => {
  if (process.stdin.isTTY) {
    const result = (
      await inquirer.prompt([
        {
          type: "search-list",
          name: "result",
          message: options.message,
          choices: options.choices,
          default: options.default,
        },
      ])
    ).result;
    return result;
  } else {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`,
    });
  }
};

export const promptYesNo = async (
  ctx: Context,
  options: {
    message: string;
    default?: boolean;
    prefix?: string;
  },
): Promise<boolean> => {
  if (process.stdin.isTTY) {
    const { result } = await inquirer.prompt([
      {
        type: "confirm",
        name: "result",
        message: options.message,
        default: options.default,
        ...(options.prefix ? { prefix: options.prefix } : {}),
      },
    ]);
    return result;
  } else {
    logOutput(options.message);
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Cannot prompt for input in non-interactive terminals. (${options.message})`,
    });
  }
};
