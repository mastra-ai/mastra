import { logFailure, logMessage } from "../../../bundler/log.js";

export class LocalDeploymentError extends Error {}

export function printLocalDeploymentOnError() {
  // Note: Not printing the error message here since it should already be printed by
  // ctx.crash.
  logFailure(`Hit an error while running local deployment.`);
  logMessage(
    "Your error has been reported to our team, and we'll be working on it. " +
      "To opt out, run `npx convex disable-local-deployments`. " +
      "Then re-run your original command.",
  );
}
