type TokenxModule = typeof import('tokenx');

let tokenxModulePromise: Promise<TokenxModule> | undefined;

/**
 * Loads the ESM-only `tokenx` module without making CommonJS consumers require
 * it while evaluating Mastra's entry point.
 */
export function loadTokenx(): Promise<TokenxModule> {
  return (tokenxModulePromise ??= import('tokenx'));
}
