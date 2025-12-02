import * as Sentry from "@sentry/node";
import { Ora } from "ora";
import { Filesystem, nodeFs } from "./fs.js";
import { initializeBigBrainAuth } from "../cli/lib/deploymentSelection.js";
import { logFailure, logVerbose } from "./log.js";
// How the error should be handled when running `npx convex dev`.
export type ErrorType =
  // The error was likely caused by the state of the developer's local
  // file system (e.g. `tsc` fails due to a syntax error). The `convex dev`
  // command will then print out the error and wait for the file to change before
  // retrying.
  | "invalid filesystem data"
  // The error was caused by either the local state (ie schema.ts content)
  // or the state of the db (ie documents not matching the new schema).
  // The `convex dev` command will wait for either file OR table data change
  // to retry (if a table name is specified as the value in this Object).
  | {
      "invalid filesystem or db data": {
        tableName: string;
        componentPath?: string;
      } | null;
    }
  // The error was caused by either the local state (ie schema.ts content)
  // or the state of the deployment environment variables.
  // The `convex dev` command will wait for either file OR env var change
  // before retrying.
  | "invalid filesystem or env vars"
  // The error was some transient issue (e.g. a network
  // error). This will then cause a retry after an exponential backoff.
  | "transient"
  // This error was caught, handled, and now all that needs to happen
  // is for the proces to restart. No error is logged or reported.
  | "already handled"
  // This error is truly permanent. Exit `npx convex dev` because the
  // developer will need to take a manual commandline action.
  | "fatal";

export type BigBrainAuth = {
  header: string;
} & (
  | {
      kind: "projectKey";
      projectKey: string;
    }
  | {
      kind: "deploymentKey";
      deploymentKey: string;
    }
  | {
      kind: "previewDeployKey";
      previewDeployKey: string;
    }
  | {
      kind: "accessToken";
      accessToken: string;
    }
);

export interface Context {
  fs: Filesystem;
  deprecationMessagePrinted: boolean;
  // Reports to Sentry and either throws FatalError or exits the process.
  // Prints the `printedMessage` if provided
  crash(args: {
    exitCode: number;
    errorType: ErrorType;
    errForSentry?: any;
    printedMessage: string | null;
  }): Promise<never>;
  registerCleanup(fn: (exitCode: number, err?: any) => Promise<void>): string;
  removeCleanup(
    handle: string,
  ): (exitCode: number, err?: any) => Promise<void> | null;
  bigBrainAuth(): BigBrainAuth | null;
  /**
   * Prefer using `updateBigBrainAuthAfterLogin` in `deploymentSelection.ts` instead
   */
  _updateBigBrainAuth(auth: BigBrainAuth | null): void;
}

async function flushAndExit(exitCode: number, err?: any) {
  if (err) {
    Sentry.captureException(err);
  }
  await Sentry.close();
  return process.exit(exitCode);
}

export type OneoffCtx = Context & {
  // Generally `ctx.crash` is better to use since it handles printing a message
  // for the user, and then calls this.
  //
  // This function reports to Sentry + exits the process, but does not handle
  // printing a message for the user.
  flushAndExit: (exitCode: number, err?: any) => Promise<never>;
};

class OneoffContextImpl {
  private _cleanupFns: Record<
    string,
    (exitCode: number, err?: any) => Promise<void>
  > = {};
  public fs: Filesystem = nodeFs;
  public deprecationMessagePrinted: boolean = false;
  public spinner: Ora | undefined = undefined;
  private _bigBrainAuth: BigBrainAuth | null = null;

  crash = async (args: {
    exitCode: number;
    errorType?: ErrorType;
    errForSentry?: any;
    printedMessage: string | null;
  }) => {
    if (args.printedMessage !== null) {
      logFailure(args.printedMessage);
    }
    return await this.flushAndExit(args.exitCode, args.errForSentry);
  };
  flushAndExit = async (exitCode: number, err?: any) => {
    logVerbose("Flushing and exiting, error:", err);
    if (err) {
      logVerbose(err.stack);
    }
    const cleanupFns = this._cleanupFns;
    // Clear the cleanup functions so that there's no risk of running them twice
    // if this somehow gets triggered twice.
    this._cleanupFns = {};
    const fns = Object.values(cleanupFns);
    logVerbose(`Running ${fns.length} cleanup functions`);
    for (const fn of fns) {
      await fn(exitCode, err);
    }
    logVerbose("All cleanup functions ran");
    return flushAndExit(exitCode, err);
  };
  registerCleanup(fn: (exitCode: number, err?: any) => Promise<void>) {
    const handle = Math.random().toString(36).slice(2);
    this._cleanupFns[handle] = fn;
    return handle;
  }
  removeCleanup(handle: string) {
    const value = this._cleanupFns[handle];
    delete this._cleanupFns[handle];
    return value ?? null;
  }
  bigBrainAuth(): BigBrainAuth | null {
    return this._bigBrainAuth;
  }
  _updateBigBrainAuth(auth: BigBrainAuth | null): void {
    logVerbose(`Updating big brain auth to ${auth?.kind ?? "null"}`);
    this._bigBrainAuth = auth;
  }
}

export const oneoffContext: (args: {
  url?: string | undefined;
  adminKey?: string | undefined;
  envFile?: string | undefined;
}) => Promise<OneoffCtx> = async (args) => {
  const ctx = new OneoffContextImpl();
  await initializeBigBrainAuth(ctx, {
    url: args.url,
    adminKey: args.adminKey,
    envFile: args.envFile,
  });
  return ctx;
};
