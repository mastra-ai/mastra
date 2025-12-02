import { Disposable } from './disposable';
/**
 * Provides credentials asynchronously.
 */
export interface AsyncCredentialsProvider {
    readonly type: 'async-credentials-provider';
    credentials: () => Promise<BasicAuth>;
}
/**
 * Provides credentials asynchronously with support for continuous updates via a subscription model.
 * This is useful for environments where credentials are frequently rotated or updated or can be revoked.
 */
export interface StreamingCredentialsProvider {
    readonly type: 'streaming-credentials-provider';
    /**
     * Provides initial credentials and subscribes to subsequent updates. This is used internally by the node-redis client
     * to handle credential rotation and re-authentication.
     *
     * Note: The node-redis client manages the subscription lifecycle automatically. Users only need to implement
     * onReAuthenticationError if they want to be notified about authentication failures.
     *
     * Error handling:
     * - Errors received via onError indicate a fatal issue with the credentials stream
     * - The stream is automatically closed(disposed) when onError occurs
     * - onError typically mean the provider failed to fetch new credentials after retrying
     *
     * @example
     * ```ts
     * const provider = getStreamingProvider();
     * const [initialCredentials, disposable] = await provider.subscribe({
     *   onNext: (newCredentials) => {
     *     // Handle credential update
     *   },
     *   onError: (error) => {
     *     // Handle fatal stream error
     *   }
     * });
     *
     * @param listener - Callbacks to handle credential updates and errors
     * @returns A Promise resolving to [initial credentials, cleanup function]
     */
    subscribe: (listener: StreamingCredentialsListener<BasicAuth>) => Promise<[BasicAuth, Disposable]>;
    /**
     * Called when authentication fails or credentials cannot be renewed in time.
     * Implement this to handle authentication errors in your application.
     *
     * @param error - Either a CredentialsError (invalid/expired credentials) or
     *                UnableToObtainNewCredentialsError (failed to fetch new credentials on time)
     */
    onReAuthenticationError: (error: ReAuthenticationError) => void;
}
/**
 * Type representing basic authentication credentials.
 */
export type BasicAuth = {
    username?: string;
    password?: string;
};
/**
 * Callback to handle credential updates and errors.
 */
export type StreamingCredentialsListener<T> = {
    onNext: (credentials: T) => void;
    onError: (e: Error) => void;
};
/**
 * Providers that can supply authentication credentials
 */
export type CredentialsProvider = AsyncCredentialsProvider | StreamingCredentialsProvider;
/**
 * Errors that can occur during re-authentication.
 */
export type ReAuthenticationError = CredentialsError | UnableToObtainNewCredentialsError;
/**
 * Thrown when re-authentication fails with provided credentials .
 * e.g. when the credentials are invalid, expired or revoked.
 *
 */
export declare class CredentialsError extends Error {
    constructor(message: string);
}
/**
 * Thrown when new credentials cannot be obtained before current ones expire
 */
export declare class UnableToObtainNewCredentialsError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=credentials-provider.d.ts.map