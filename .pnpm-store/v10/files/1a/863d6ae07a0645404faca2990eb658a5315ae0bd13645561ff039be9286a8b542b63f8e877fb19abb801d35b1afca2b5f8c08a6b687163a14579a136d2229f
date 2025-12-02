import { Without, ClerkOptions, SDKMetadata } from '@clerk/types';

/**
 * Sets the package name for error messages during ClerkJS script loading.
 *
 * @param packageName - The name of the package to use in error messages (e.g., '@clerk/clerk-react').
 * @example
 * ```typescript
 * setClerkJsLoadingErrorPackageName('@clerk/clerk-react');
 * ```
 */
declare function setClerkJsLoadingErrorPackageName(packageName: string): void;
type LoadClerkJsScriptOptions = Without<ClerkOptions, 'isSatellite'> & {
    publishableKey: string;
    clerkJSUrl?: string;
    clerkJSVariant?: 'headless' | '';
    clerkJSVersion?: string;
    sdkMetadata?: SDKMetadata;
    proxyUrl?: string;
    domain?: string;
    nonce?: string;
    /**
     * Timeout in milliseconds to wait for clerk-js to load before considering it failed.
     *
     * @default 15000 (15 seconds)
     */
    scriptLoadTimeout?: number;
};
/**
 * Hotloads the Clerk JS script with robust failure detection.
 *
 * Uses a timeout-based approach to ensure absolute certainty about load success/failure.
 * If the script fails to load within the timeout period, or loads but doesn't create
 * a proper Clerk instance, the promise rejects with an error.
 *
 * @param opts - The options used to build the Clerk JS script URL and load the script.
 *               Must include a `publishableKey` if no existing script is found.
 * @returns Promise that resolves with null if Clerk loads successfully, or rejects with an error.
 *
 * @example
 * ```typescript
 * try {
 *   await loadClerkJsScript({ publishableKey: 'pk_test_...' });
 *   console.log('Clerk loaded successfully');
 * } catch (error) {
 *   console.error('Failed to load Clerk:', error.message);
 * }
 * ```
 */
declare const loadClerkJsScript: (opts?: LoadClerkJsScriptOptions) => Promise<HTMLScriptElement | null>;
/**
 * Generates a Clerk JS script URL based on the provided options.
 *
 * @param opts - The options to use when building the Clerk JS script URL.
 * @returns The complete URL to the Clerk JS script.
 *
 * @example
 * ```typescript
 * const url = clerkJsScriptUrl({ publishableKey: 'pk_test_...' });
 * // Returns: "https://example.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
 * ```
 */
declare const clerkJsScriptUrl: (opts: LoadClerkJsScriptOptions) => string;
/**
 * Builds an object of Clerk JS script attributes based on the provided options.
 *
 * @param options - The options containing the values for script attributes.
 * @returns An object containing data attributes to be applied to the script element.
 */
declare const buildClerkJsScriptAttributes: (options: LoadClerkJsScriptOptions) => Record<string, string>;

export { type LoadClerkJsScriptOptions, buildClerkJsScriptAttributes, clerkJsScriptUrl, loadClerkJsScript, setClerkJsLoadingErrorPackageName };
