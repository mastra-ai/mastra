import type { PostHog } from '../posthog-core';
/**
 * An *unknown* action.
 * This is the most minimal possible shape for an action.
 * Allows for type-safe usage of actions without dependencies.
 */
export interface UnknownAction {
    type: string;
    [extraProps: string]: unknown;
}
/**
 * A *dispatching function* (or simply *dispatch function*) is a function that
 * accepts an action or an async action; it then may or may not dispatch one
 * or more actions to the store.
 */
export interface Dispatch<A extends UnknownAction = UnknownAction> {
    <T extends A>(action: T): T;
}
/**
 * A middleware is a higher-order function that composes a dispatch function
 * to return a new dispatch function. It often turns async actions into
 * actions.
 *
 * This matches Redux Toolkit's Middleware interface for compatibility.
 */
export interface ReduxMiddleware<_DispatchExt = {}, S = any, D extends Dispatch = Dispatch> {
    (api: MiddlewareAPI<D, S>): (next: (action: unknown) => unknown) => (action: unknown) => unknown;
}
/**
 * A middleware API is an object containing the store's dispatch function and getState function.
 * A middleware is given the middleware API as its first parameter.
 */
export interface MiddlewareAPI<D extends Dispatch = Dispatch, S = any> {
    dispatch: D;
    getState(): S;
}
export interface StateEvent {
    type: string;
    payload?: any;
    timestamp: number;
    executionTimeMs?: number;
    prevState: any;
    nextState: any;
    changedState: any;
}
export type PostHogStateLogger = (title: string, stateEvent: StateEvent) => void;
export interface PostHogStateLoggerConfig<S = any> {
    maskAction?: (action: UnknownAction) => UnknownAction | null;
    maskState?: (state: S, action?: UnknownAction) => S;
    titleFunction?: (stateEvent: StateEvent) => string;
    logger?: PostHogStateLogger;
    /**
     * actions logging is token bucket rate limited to avoid flooding
     * this controls the rate limiter's refill rate, see BucketedRateLimiter docs for details
     * normally this is only changed with posthog support assistance
     */
    rateLimiterRefillRate?: number;
    /**
     * actions logging is token bucket rate limited to avoid flooding
     * this controls the rate limiter's bucket size, see BucketedRateLimiter docs for details
     * normally this is only changed with posthog support assistance
     */
    rateLimiterBucketSize?: number;
    /**
     * Controls how many levels deep the state diffing goes when looking for changed keys
     * Defaults to 5
     * Increase this if you have nested state changes that are not being captured
     * Decrease this if you are seeing too much state in the diffs and want to reduce noise
     * Note that increasing this will increase the CPU cost of diffing, so use with caution
     * and only increase if necessary
     * Normally this is only changed with posthog support assistance
     */
    __stateComparisonDepth?: number;
    /**
     * Which parts of the state event to include in the logged event
     * By default we include, previous and changed keys only
     *
     * NB the more you include the more likely a log will be dropped by rate limiting or max size limits
     */
    include?: {
        prevState?: boolean;
        nextState?: boolean;
        changedState?: boolean;
    };
}
export declare function browserConsoleLogger(title: string, stateEvent: StateEvent): void;
/**
 * Logger that sends state events to PostHog session recordings
 * Requires that the loaded posthog instance is provided
 * And returns the function to use as the logger
 *
 * e.g. const config = { logger: sessionRecordingLoggerForPostHogInstance(posthog) }
 */
export declare const sessionRecordingLoggerForPostHogInstance: (posthog: PostHog) => PostHogStateLogger;
/**
 * Get only the changed keys from two states
 * NB exported for testing purposes only, not part of the public API and may change without warning
 *
 * Returns { prevState: changedKeysOnly, nextState: changedKeysOnly }
 */
export declare function getChangedState<S>(prevState: S, nextState: S, maxDepth?: number): Partial<S>;
/**
 * Creates a Kea plugin that logs actions and state changes to a provided logger
 * This can be used as a plugin in any Kea setup to capture state changes
 */
export declare function posthogKeaLogger<S = any>(config?: PostHogStateLoggerConfig<S>): {
    name: string;
    events: {
        beforeReduxStore(options: any): void;
    };
};
/**
 * Creates a Redux middleware that logs actions and state changes to a provided logger
 * This can be used as middleware in any Redux store to capture state changes
 *
 * The logging uses token-bucket rate limiting to avoid flooding the logging with many changes
 * by default logging rate limiting captures ten action instances before rate limiting by action type
 * refills at a rate of one token / 1-second period
 * e.g. will capture 1 rate limited action every 1 second until the burst ends
 */
export declare function posthogReduxLogger<S = any>(config?: PostHogStateLoggerConfig<S>): ReduxMiddleware<{}, S>;
