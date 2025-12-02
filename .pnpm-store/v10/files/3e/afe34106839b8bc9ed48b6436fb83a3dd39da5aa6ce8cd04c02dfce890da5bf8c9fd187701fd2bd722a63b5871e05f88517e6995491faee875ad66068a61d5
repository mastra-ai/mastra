import { BigBrainAuth, Context, ErrorType } from "../../../bundler/context.js";
import { Filesystem, nodeFs } from "../../../bundler/fs.js";
import { Ora } from "ora";
import {
  DeploymentSelectionWithinProject,
  deploymentSelectionWithinProjectSchema,
  DeploymentSelectionOptions,
} from "../api.js";
import { z } from "zod";

export interface McpOptions extends DeploymentSelectionOptions {
  projectDir?: string;
  disableTools?: string;
  dangerouslyEnableProductionDeployments?: boolean;
}

export class RequestContext implements Context {
  fs: Filesystem;
  deprecationMessagePrinted = false;
  spinner: Ora | undefined;
  _cleanupFns: Record<string, (exitCode: number, err?: any) => Promise<void>> =
    {};
  _bigBrainAuth: BigBrainAuth | null = null;
  constructor(public options: McpOptions) {
    this.fs = nodeFs;
    this.deprecationMessagePrinted = false;
  }

  async crash(args: {
    exitCode: number;
    errorType?: ErrorType;
    errForSentry?: any;
    printedMessage: string | null;
  }): Promise<never> {
    const cleanupFns = this._cleanupFns;
    this._cleanupFns = {};
    for (const fn of Object.values(cleanupFns)) {
      await fn(args.exitCode, args.errForSentry);
    }
    // eslint-disable-next-line no-restricted-syntax
    throw new RequestCrash(args.exitCode, args.errorType, args.printedMessage);
  }

  flushAndExit() {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error("Not implemented");
  }

  registerCleanup(fn: (exitCode: number, err?: any) => Promise<void>): string {
    const handle = crypto.randomUUID();
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
    this._bigBrainAuth = auth;
  }

  async decodeDeploymentSelector(encoded: string) {
    const { projectDir, deployment } = decodeDeploymentSelector(encoded);
    if (
      deployment.kind === "prod" &&
      !this.options.dangerouslyEnableProductionDeployments
    ) {
      return await this.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage:
          "Production deployments are disabled due to the --disable-production-deployments flag.",
      });
    }
    return { projectDir, deployment };
  }

  get productionDeploymentsDisabled() {
    return !this.options.dangerouslyEnableProductionDeployments;
  }
}

export class RequestCrash {
  printedMessage: string;
  constructor(
    private exitCode: number,
    private errorType: ErrorType | undefined,
    printedMessage: string | null,
  ) {
    this.printedMessage = printedMessage ?? "Unknown error";
  }
}

// Unfortunately, MCP clients don't seem to handle nested JSON objects very
// well (even though this is within spec). To work around this, encode the
// deployment selectors as an obfuscated string that the MCP client can
// opaquely pass around.
export function encodeDeploymentSelector(
  projectDir: string,
  deployment: DeploymentSelectionWithinProject,
) {
  const payload = {
    projectDir,
    deployment,
  };
  return `${deployment.kind}:${btoa(JSON.stringify(payload))}`;
}

const payloadSchema = z.object({
  projectDir: z.string(),
  deployment: deploymentSelectionWithinProjectSchema,
});

function decodeDeploymentSelector(encoded: string) {
  const [_, serializedPayload] = encoded.split(":");
  return payloadSchema.parse(JSON.parse(atob(serializedPayload)));
}
