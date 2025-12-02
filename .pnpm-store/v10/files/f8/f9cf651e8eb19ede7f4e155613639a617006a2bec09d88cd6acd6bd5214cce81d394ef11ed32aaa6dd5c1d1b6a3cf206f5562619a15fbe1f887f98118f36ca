import { Context } from "../../bundler/context.js";
declare const _FRAMEWORKS: readonly ["create-react-app", "Next.js", "Vite", "Remix", "SvelteKit", "Expo", "TanStackStart"];
type Framework = (typeof _FRAMEWORKS)[number];
type ConvexUrlWriteConfig = {
    envFile: string;
    envVar: string;
    existingFileContent: string | null;
} | null;
export declare function writeConvexUrlToEnvFile(ctx: Context, value: string): Promise<ConvexUrlWriteConfig>;
export declare function changedEnvVarFile({ existingFileContent, envVarName, envVarValue, commentAfterValue, commentOnPreviousLine, }: {
    existingFileContent: string | null;
    envVarName: string;
    envVarValue: string;
    commentAfterValue: string | null;
    commentOnPreviousLine: string | null;
}): string | null;
export declare function getEnvVarRegex(envVarName: string): RegExp;
export declare function suggestedEnvVarName(ctx: Context): Promise<{
    detectedFramework?: Framework;
    envVar: string;
    frontendDevUrl?: string;
    publicPrefix?: string;
}>;
export declare function detectSuspiciousEnvironmentVariables(ctx: Context, ignoreSuspiciousEnvVars?: boolean): Promise<undefined>;
export declare function getBuildEnvironment(): string | false;
export declare function gitBranchFromEnvironment(): string | null;
export declare function isNonProdBuildEnvironment(): boolean;
export {};
//# sourceMappingURL=envvars.d.ts.map