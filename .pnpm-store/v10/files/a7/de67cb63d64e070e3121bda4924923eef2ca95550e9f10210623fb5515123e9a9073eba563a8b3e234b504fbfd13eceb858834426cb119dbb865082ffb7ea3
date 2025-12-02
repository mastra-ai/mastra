import chalk from "chalk";
import { logOutput } from "../../bundler/log.js";
import { runSystemQuery } from "./run.js";
import { Context } from "../../bundler/context.js";

export async function functionSpecForDeployment(
  ctx: Context,
  options: {
    deploymentUrl: string;
    adminKey: string;
    file: boolean;
  },
) {
  const functions = (await runSystemQuery(ctx, {
    deploymentUrl: options.deploymentUrl,
    adminKey: options.adminKey,
    functionName: "_system/cli/modules:apiSpec",
    componentPath: undefined,
    args: {},
  })) as any[];
  const url = (await runSystemQuery(ctx, {
    deploymentUrl: options.deploymentUrl,
    adminKey: options.adminKey,
    functionName: "_system/cli/convexUrl:cloudUrl",
    componentPath: undefined,
    args: {},
  })) as string;

  const output = JSON.stringify({ url, functions }, null, 2);

  if (options.file) {
    const fileName = `function_spec_${Date.now().valueOf()}.json`;
    ctx.fs.writeUtf8File(fileName, output);
    logOutput(chalk.green(`Wrote function spec to ${fileName}`));
  } else {
    logOutput(output);
  }
}
