"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = exports.IDPError = void 0;
const token_1 = require("./token");
/**
 * IDPError indicates a failure from the identity provider.
 *
 * The `isRetryable` flag is determined by the RetryPolicy's error classification function - if an error is
 * classified as retryable, it will be marked as transient and the token manager will attempt to recover.
 */
class IDPError extends Error {
    message;
    isRetryable;
    constructor(message, isRetryable) {
        super(message);
        this.message = message;
        this.isRetryable = isRetryable;
        this.name = 'IDPError';
    }
}
exports.IDPError = IDPError;
/**
 * TokenManager is responsible for obtaining/refreshing tokens and notifying listeners about token changes.
 * It uses an IdentityProvider to request tokens. The token refresh is scheduled based on the token's TTL and
 * the expirationRefreshRatio configuration.
 *
 * The TokenManager should be disposed when it is no longer needed by calling the dispose method on the Disposable
 * returned by start.
 */
class TokenManager {
    identityProvider;
    config;
    currentToken = null;
    refreshTimeout = null;
    listener = null;
    retryAttempt = 0;
    constructor(identityProvider, config) {
        this.identityProvider = identityProvider;
        this.config = config;
        if (this.config.expirationRefreshRatio > 1) {
            throw new Error('expirationRefreshRatio must be less than or equal to 1');
        }
        if (this.config.expirationRefreshRatio < 0) {
            throw new Error('expirationRefreshRatio must be greater or equal to 0');
        }
    }
    /**
     * Starts the token manager and returns a Disposable that can be used to stop the token manager.
     *
     * @param listener The listener that will receive token updates.
     * @param initialDelayMs The initial delay in milliseconds before the first token refresh.
     */
    start(listener, initialDelayMs = 0) {
        if (this.listener) {
            this.stop();
        }
        this.listener = listener;
        this.retryAttempt = 0;
        this.scheduleNextRefresh(initialDelayMs);
        return {
            dispose: () => this.stop()
        };
    }
    calculateRetryDelay() {
        if (!this.config.retry)
            return 0;
        const { initialDelayMs, maxDelayMs, backoffMultiplier, jitterPercentage } = this.config.retry;
        let delay = initialDelayMs * Math.pow(backoffMultiplier, this.retryAttempt - 1);
        delay = Math.min(delay, maxDelayMs);
        if (jitterPercentage) {
            const jitterRange = delay * (jitterPercentage / 100);
            const jitterAmount = Math.random() * jitterRange - (jitterRange / 2);
            delay += jitterAmount;
        }
        let result = Math.max(0, Math.floor(delay));
        return result;
    }
    shouldRetry(error) {
        if (!this.config.retry)
            return false;
        const { maxAttempts, isRetryable } = this.config.retry;
        if (this.retryAttempt >= maxAttempts) {
            return false;
        }
        if (isRetryable) {
            return isRetryable(error, this.retryAttempt);
        }
        return false;
    }
    isRunning() {
        return this.listener !== null;
    }
    async refresh() {
        if (!this.listener) {
            throw new Error('TokenManager is not running, but refresh was called');
        }
        try {
            await this.identityProvider.requestToken().then(this.handleNewToken);
            this.retryAttempt = 0;
        }
        catch (error) {
            if (this.shouldRetry(error)) {
                this.retryAttempt++;
                const retryDelay = this.calculateRetryDelay();
                this.notifyError(`Token refresh failed (attempt ${this.retryAttempt}), retrying in ${retryDelay}ms: ${error}`, true);
                this.scheduleNextRefresh(retryDelay);
            }
            else {
                this.notifyError(error, false);
                this.stop();
            }
        }
    }
    handleNewToken = async ({ token: nativeToken, ttlMs }) => {
        if (!this.listener) {
            throw new Error('TokenManager is not running, but a new token was received');
        }
        const token = this.wrapAndSetCurrentToken(nativeToken, ttlMs);
        this.listener.onNext(token);
        this.scheduleNextRefresh(this.calculateRefreshTime(token));
    };
    /**
     * Creates a Token object from a native token and sets it as the current token.
     *
     * @param nativeToken - The raw token received from the identity provider
     * @param ttlMs - Time-to-live in milliseconds for the token
     *
     * @returns A new Token instance containing the wrapped native token and expiration details
     *
     */
    wrapAndSetCurrentToken(nativeToken, ttlMs) {
        const now = Date.now();
        const token = new token_1.Token(nativeToken, now + ttlMs, now);
        this.currentToken = token;
        return token;
    }
    scheduleNextRefresh(delayMs) {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        if (delayMs === 0) {
            this.refresh();
        }
        else {
            this.refreshTimeout = setTimeout(() => this.refresh(), delayMs);
        }
    }
    /**
     * Calculates the time in milliseconds when the token should be refreshed
     * based on the token's TTL and the expirationRefreshRatio configuration.
     *
     * @param token The token to calculate the refresh time for.
     * @param now The current time in milliseconds. Defaults to Date.now().
     */
    calculateRefreshTime(token, now = Date.now()) {
        const ttlMs = token.getTtlMs(now);
        return Math.floor(ttlMs * this.config.expirationRefreshRatio);
    }
    stop() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        this.listener = null;
        this.currentToken = null;
        this.retryAttempt = 0;
    }
    /**
     * Returns the current token or null if no token is available.
     */
    getCurrentToken() {
        return this.currentToken;
    }
    notifyError(error, isRetryable) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!this.listener) {
            throw new Error(`TokenManager is not running but received an error: ${errorMessage}`);
        }
        this.listener.onError(new IDPError(errorMessage, isRetryable));
    }
}
exports.TokenManager = TokenManager;
//# sourceMappingURL=token-manager.js.map