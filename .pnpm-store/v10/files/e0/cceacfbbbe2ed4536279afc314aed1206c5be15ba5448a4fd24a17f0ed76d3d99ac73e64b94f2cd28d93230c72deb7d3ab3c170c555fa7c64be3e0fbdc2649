import { OneoffCtx } from "../../bundler/context.js";
import { LogMode } from "./logs.js";
declare module "@commander-js/extra-typings" {
    interface Command<Args extends any[] = [], Opts extends OptionValues = {}> {
        /**
         * For a command that talks to the configured dev deployment by default,
         * add flags for talking to prod, preview, or other deployment in the same
         * project.
         *
         * These flags are added to the end of `command` (ordering matters for `--help`
         * output). `action` should look like "Import data into" because it is prefixed
         * onto help strings.
         *
         * The options can be passed to `deploymentSelectionFromOptions`.
         *
         * NOTE: This method only exists at runtime if this file is imported.
         * To help avoid this bug, this method takes in an `ActionDescription` which
         * can only be constructed via `actionDescription` from this file.
         */
        addDeploymentSelectionOptions(action: ActionDescription): Command<Args, Opts & {
            envFile?: string;
            url?: string;
            adminKey?: string;
            prod?: boolean;
            previewName?: string;
            deploymentName?: string;
        }>;
        /**
         * Adds options for the `deploy` command.
         */
        addDeployOptions(): Command<Args, Opts & {
            verbose?: boolean;
            dryRun?: boolean;
            yes?: boolean;
            typecheck: "enable" | "try" | "disable";
            typecheckComponents: boolean;
            codegen: "enable" | "disable";
            cmd?: string;
            cmdUrlEnvVarName?: string;
            debugBundlePath?: string;
            debug?: boolean;
            writePushRequest?: string;
            liveComponentSources?: boolean;
        }>;
        /**
         * Adds options for `self-host` subcommands.
         */
        addSelfHostOptions(): Command<Args, Opts & {
            url?: string;
            adminKey?: string;
            env?: string;
        }>;
        /**
         * Adds options and arguments for the `run` command.
         */
        addRunOptions(): Command<[
            ...Args,
            string,
            string | undefined
        ], Opts & {
            watch?: boolean;
            push?: boolean;
            identity?: string;
            typecheck: "enable" | "try" | "disable";
            typecheckComponents: boolean;
            codegen: "enable" | "disable";
            component?: string;
            liveComponentSources?: boolean;
        }>;
        /**
         * Adds options for the `import` command.
         */
        addImportOptions(): Command<[
            ...Args,
            string
        ], Opts & {
            table?: string;
            format?: "csv" | "jsonLines" | "jsonArray" | "zip";
            replace?: boolean;
            append?: boolean;
            replaceAll?: boolean;
            yes?: boolean;
            component?: string;
        }>;
        /**
         * Adds options for the `export` command.
         */
        addExportOptions(): Command<Args, Opts & {
            path: string;
            includeFileStorage?: boolean;
        }>;
        /**
         * Adds options for the `data` command.
         */
        addDataOptions(): Command<[
            ...Args,
            string | undefined
        ], Opts & {
            limit: number;
            order: "asc" | "desc";
            component?: string;
            format?: "json" | "jsonArray" | "jsonLines" | "jsonl" | "pretty";
        }>;
        /**
         * Adds options for the `logs` command.
         */
        addLogsOptions(): Command<Args, Opts & {
            history: number;
            success: boolean;
            jsonl: boolean;
        }>;
        /**
         * Adds options for the `network-test` command.
         */
        addNetworkTestOptions(): Command<Args, Opts & {
            timeout?: string;
            ipFamily?: string;
            speedTest?: boolean;
        }>;
    }
}
declare const tag: unique symbol;
type ActionDescription = string & {
    readonly [tag]: "noop";
};
export declare function actionDescription(action: string): ActionDescription;
export declare function normalizeDevOptions(ctx: OneoffCtx, cmdOptions: {
    verbose?: boolean;
    typecheck: "enable" | "try" | "disable";
    typecheckComponents?: boolean;
    codegen: "enable" | "disable";
    once?: boolean;
    untilSuccess: boolean;
    run?: string | undefined;
    runSh?: string;
    runComponent?: string;
    tailLogs?: string | true;
    traceEvents: boolean;
    debugBundlePath?: string | undefined;
    debugNodeApis?: boolean;
    liveComponentSources?: boolean;
    while?: string;
}): Promise<{
    verbose: boolean;
    typecheck: "enable" | "try" | "disable";
    typecheckComponents: boolean;
    codegen: boolean;
    once: boolean;
    untilSuccess: boolean;
    run?: {
        kind: "function";
        name: string;
        component?: string | undefined;
    } | {
        kind: "shell";
        command: string;
    } | undefined;
    tailLogs: LogMode;
    traceEvents: boolean;
    debugBundlePath?: string | undefined;
    debugNodeApis: boolean;
    liveComponentSources: boolean;
}>;
export {};
//# sourceMappingURL=command.d.ts.map