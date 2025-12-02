import { Context } from "../../../bundler/context.js";
import { logMessage } from "../../../bundler/log.js";
import { detect } from "detect-port";
import crypto from "crypto";
import chalk from "chalk";

export async function choosePorts(
  ctx: Context,
  {
    count,
    requestedPorts,
    startPort,
  }: {
    count: number;
    requestedPorts?: Array<number | null>;
    startPort: number;
  },
): Promise<Array<number>> {
  const ports: Array<number> = [];
  for (let i = 0; i < count; i++) {
    const requestedPort = requestedPorts?.[i];
    if (requestedPort !== null) {
      const port = await detect(requestedPort);
      if (port !== requestedPort) {
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Requested port is not available",
        });
      }
      ports.push(port);
    } else {
      const portToTry =
        ports.length > 0 ? ports[ports.length - 1] + 1 : startPort;
      const port = await detect(portToTry);
      ports.push(port);
    }
  }
  return ports;
}

export async function isOffline(): Promise<boolean> {
  // TODO(ENG-7080) -- implement this for real
  return false;
}

export function printLocalDeploymentWelcomeMessage() {
  logMessage(
    chalk.cyan("You're trying out the beta local deployment feature!"),
  );
  logMessage(
    chalk.cyan(
      "To learn more, read the docs: https://docs.convex.dev/cli/local-deployments",
    ),
  );
  logMessage(
    chalk.cyan(
      "To opt out at any time, run `npx convex disable-local-deployments`",
    ),
  );
}

export function generateInstanceSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export const LOCAL_BACKEND_INSTANCE_SECRET =
  "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974";
