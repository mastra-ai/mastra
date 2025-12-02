import { IdentityProvider } from './identity-provider';
import { Token } from './token';
import { Disposable } from './disposable';
/**
 * The configuration for retrying token refreshes.
 */
export interface RetryPolicy {
    /**
     * The maximum number of attempts to retry token refreshes.
     */
    maxAttempts: number;
    /**
     * The initial delay in milliseconds before the first retry.
     */
    initialDelayMs: number;
    /**
     * The maximum delay in milliseconds between retries.
     * The calculated delay will be capped at this value.
     */
    maxDelayMs: number;
    /**
     * The multiplier for exponential backoff between retries.
     * @example
     * A value of 2 will double the delay each time:
     * - 1st retry: initialDelayMs
     * - 2nd retry: initialDelayMs * 2
     * - 3rd retry: initialDelayMs * 4
     */
    backoffMultiplier: number;
    /**
     * The percentage of jitter to apply to the delay.
     * @example
     * A value of 0.1 will add or subtract up to 10% of the delay.
     */
    jitterPercentage?: number;
    /**
     * Function to classify errors from the identity provider as retryable or non-retryable.
     * Used to determine if a token refresh failure should be retried based on the type of error.
     *
     * The default behavior is to retry all types of errors if no function is provided.
     *
     * Common use cases:
     * - Network errors that may be transient (should retry)
     * - Invalid credentials (should not retry)
     * - Rate limiting responses (should retry)
     *
     * @param error - The error from the identity provider3
     * @param attempt - Current retry attempt (0-based)
     * @returns `true` if the error is considered transient and the operation should be retried
     *
     * @example
     * ```typescript
     * const retryPolicy: RetryPolicy = {
     *   maxAttempts: 3,
     *   initialDelayMs: 1000,
     *   maxDelayMs: 5000,
     *   backoffMultiplier: 2,
     *   isRetryable: (error) => {
     *     // Retry on network errors or rate limiting
     *     return error instanceof NetworkError ||
     *            error instanceof RateLimitError;
     *   }
     * };
     * ```
     */
    isRetryable?: (error: unknown, attempt: number) => boolean;
}
/**
 * the configuration for the TokenManager.
 */
export interface TokenManagerConfig {
    /**
     * Represents the ratio of a token's lifetime at which a refresh should be triggered.
     * For example, a value of 0.75 means the token should be refreshed when 75% of its lifetime has elapsed (or when
     * 25% of its lifetime remains).
     */
    expirationRefreshRatio: number;
    retry?: RetryPolicy;
}
/**
 * IDPError indicates a failure from the identity provider.
 *
 * The `isRetryable` flag is determined by the RetryPolicy's error classification function - if an error is
 * classified as retryable, it will be marked as transient and the token manager will attempt to recover.
 */
export declare class IDPError extends Error {
    readonly message: string;
    readonly isRetryable: boolean;
    constructor(message: string, isRetryable: boolean);
}
/**
 * TokenStreamListener is an interface for objects that listen to token changes.
 */
export type TokenStreamListener<T> = {
    /**
     * Called each time a new token is received.
     * @param token
     */
    onNext: (token: Token<T>) => void;
    /**
     * Called when an error occurs while calling the underlying IdentityProvider. The error can be
     * transient and the token manager will attempt to obtain a token again if retry policy is configured.
     *
     * Only fatal errors will terminate the stream and stop the token manager.
     *
     * @param error
     */
    onError: (error: IDPError) => void;
};
/**
 * TokenManager is responsible for obtaining/refreshing tokens and notifying listeners about token changes.
 * It uses an IdentityProvider to request tokens. The token refresh is scheduled based on the token's TTL and
 * the expirationRefreshRatio configuration.
 *
 * The TokenManager should be disposed when it is no longer needed by calling the dispose method on the Disposable
 * returned by start.
 */
export declare class TokenManager<T> {
    private readonly identityProvider;
    private readonly config;
    private currentToken;
    private refreshTimeout;
    private listener;
    private retryAttempt;
    constructor(identityProvider: IdentityProvider<T>, config: TokenManagerConfig);
    /**
     * Starts the token manager and returns a Disposable that can be used to stop the token manager.
     *
     * @param listener The listener that will receive token updates.
     * @param initialDelayMs The initial delay in milliseconds before the first token refresh.
     */
    start(listener: TokenStreamListener<T>, initialDelayMs?: number): Disposable;
    calculateRetryDelay(): number;
    private shouldRetry;
    isRunning(): boolean;
    private refresh;
    private handleNewToken;
    /**
     * Creates a Token object from a native token and sets it as the current token.
     *
     * @param nativeToken - The raw token received from the identity provider
     * @param ttlMs - Time-to-live in milliseconds for the token
     *
     * @returns A new Token instance containing the wrapped native token and expiration details
     *
     */
    wrapAndSetCurrentToken(nativeToken: T, ttlMs: number): Token<T>;
    private scheduleNextRefresh;
    /**
     * Calculates the time in milliseconds when the token should be refreshed
     * based on the token's TTL and the expirationRefreshRatio configuration.
     *
     * @param token The token to calculate the refresh time for.
     * @param now The current time in milliseconds. Defaults to Date.now().
     */
    calculateRefreshTime(token: Token<T>, now?: number): number;
    private stop;
    /**
     * Returns the current token or null if no token is available.
     */
    getCurrentToken(): Token<T> | null;
    private notifyError;
}
//# sourceMappingURL=token-manager.d.ts.map