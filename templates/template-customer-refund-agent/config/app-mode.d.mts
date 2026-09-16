export type AppMode = "local" | "staging" | "production";
export interface DatabaseProfile {
  mode: AppMode;
  backend: string;
  client: string;
}
export const templateRoot: string;
export function appMode(environment?: NodeJS.ProcessEnv): AppMode;
export function isLocalMode(environment?: NodeJS.ProcessEnv): boolean;
export function hasExplicitExternalMode(
  environment?: NodeJS.ProcessEnv,
): boolean;
export function hasExplicitStagingMode(
  environment?: NodeJS.ProcessEnv,
): boolean;
export function externalDatabaseUrl(
  environment?: NodeJS.ProcessEnv,
): string | undefined;
export function databaseProfile(
  environment?: NodeJS.ProcessEnv,
): DatabaseProfile;
export function assertDatabaseIsolation(
  environment?: NodeJS.ProcessEnv,
): DatabaseProfile;
export function applyModeToEnvironment(
  environment?: NodeJS.ProcessEnv,
): DatabaseProfile;
