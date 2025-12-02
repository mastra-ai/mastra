"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRecordingLoggerForPostHogInstance = void 0;
exports.browserConsoleLogger = browserConsoleLogger;
exports.getChangedState = getChangedState;
exports.posthogKeaLogger = posthogKeaLogger;
exports.posthogReduxLogger = posthogReduxLogger;
var core_1 = require("@posthog/core");
var logger_1 = require("../utils/logger");
/**
 * Default title function for Redux events
 */
function defaultTitleFunction(stateEvent) {
    var type = stateEvent.type, executionTimeMs = stateEvent.executionTimeMs;
    var timeText = (0, core_1.isNullish)(executionTimeMs) ? '' : " (".concat(executionTimeMs.toFixed(2), "ms)");
    return "".concat(type).concat(timeText);
}
// we need a posthog logger for the rate limiter
var phConsoleLogger = (0, logger_1.createLogger)('[PostHog Action RateLimiting]');
function browserConsoleLogger(title, stateEvent) {
    // but the posthog logger swallows messages unless debug is on
    // so we don't want to use it in this default logger
    // eslint-disable-next-line no-console
    console.log(title, stateEvent);
}
/**
 * Logger that sends state events to PostHog session recordings
 * Requires that the loaded posthog instance is provided
 * And returns the function to use as the logger
 *
 * e.g. const config = { logger: sessionRecordingLoggerForPostHogInstance(posthog) }
 */
var sessionRecordingLoggerForPostHogInstance = function (postHogInstance) {
    return function (title, stateEvent) {
        var _a;
        (_a = postHogInstance === null || postHogInstance === void 0 ? void 0 : postHogInstance.sessionRecording) === null || _a === void 0 ? void 0 : _a.tryAddCustomEvent('app-state', { title: title, stateEvent: stateEvent });
    };
};
exports.sessionRecordingLoggerForPostHogInstance = sessionRecordingLoggerForPostHogInstance;
/**
 * Get only the changed keys from two states
 * NB exported for testing purposes only, not part of the public API and may change without warning
 *
 * Returns { prevState: changedKeysOnly, nextState: changedKeysOnly }
 */
function getChangedState(prevState, nextState, maxDepth) {
    var e_1, _a;
    if (maxDepth === void 0) { maxDepth = 5; }
    // Fast bailouts
    if (typeof prevState !== 'object' || typeof nextState !== 'object')
        return {};
    if (prevState === nextState)
        return {};
    // all keys changed when no previous state
    if (!prevState && nextState)
        return nextState;
    // something weird has happened, return empty
    if (!nextState || !prevState)
        return {};
    var changed = {};
    var allKeys = new Set(__spreadArray(__spreadArray([], __read(Object.keys(prevState)), false), __read(Object.keys(nextState)), false));
    try {
        for (var allKeys_1 = __values(allKeys), allKeys_1_1 = allKeys_1.next(); !allKeys_1_1.done; allKeys_1_1 = allKeys_1.next()) {
            var key = allKeys_1_1.value;
            var prevValue = prevState[key];
            var nextValue = nextState[key];
            // Key exists in only one object
            if ((0, core_1.isUndefined)(prevValue)) {
                changed[key] = nextValue;
                continue;
            }
            if ((0, core_1.isUndefined)(nextValue)) {
                changed[key] = prevValue;
                continue;
            }
            // Same value
            if (prevValue === nextValue) {
                continue;
            }
            // Both null/undefined
            if ((0, core_1.isNullish)(prevValue) && (0, core_1.isNullish)(nextValue)) {
                continue;
            }
            // Primitive or one is null
            if (!(0, core_1.isObject)(prevValue) || !(0, core_1.isObject)(nextValue)) {
                changed[key] = nextValue;
                continue;
            }
            // Both are objects, recurse if under max depth
            if (maxDepth > 1) {
                var childChanged = getChangedState(prevValue, nextValue, maxDepth - 1);
                if (!(0, core_1.isEmptyObject)(childChanged)) {
                    changed[key] = childChanged;
                }
            }
            else {
                changed[key] = "max depth reached, checking for changed value";
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (allKeys_1_1 && !allKeys_1_1.done && (_a = allKeys_1.return)) _a.call(allKeys_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return changed;
}
// Debounced logger for rate limit messages
var createDebouncedActionRateLimitedLogger = function () {
    var timeout = null;
    var ignoredCount = 0;
    var lastActionType = null;
    return {
        info: function (actionType) {
            if (lastActionType !== actionType) {
                // Reset counter when action type changes
                ignoredCount = 0;
                lastActionType = actionType;
            }
            ignoredCount++;
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(function () {
                var count = ignoredCount;
                if (count === 1) {
                    phConsoleLogger.info("action \"".concat(actionType, "\" has been rate limited"));
                }
                else {
                    phConsoleLogger.info("action \"".concat(actionType, "\" has been rate limited (").concat(count, " times)"));
                }
                ignoredCount = 0;
                timeout = null;
            }, 1000);
        },
    };
};
var debouncedActionRateLimitedLogger = createDebouncedActionRateLimitedLogger();
/**
 * Creates a Kea plugin that logs actions and state changes to a provided logger
 * This can be used as a plugin in any Kea setup to capture state changes
 */
function posthogKeaLogger(config) {
    if (config === void 0) { config = {}; }
    var middleware = posthogReduxLogger(config);
    return {
        name: 'posthog-kea-logger',
        events: {
            beforeReduxStore: function (options) {
                options.middleware.push(middleware);
            },
        },
    };
}
/**
 * Creates a Redux middleware that logs actions and state changes to a provided logger
 * This can be used as middleware in any Redux store to capture state changes
 *
 * The logging uses token-bucket rate limiting to avoid flooding the logging with many changes
 * by default logging rate limiting captures ten action instances before rate limiting by action type
 * refills at a rate of one token / 1-second period
 * e.g. will capture 1 rate limited action every 1 second until the burst ends
 */
function posthogReduxLogger(config
// the empty object is the recommended typing from redux docs
//eslint-disable-next-line @typescript-eslint/no-empty-object-type
) {
    if (config === void 0) { config = {}; }
    var maskAction = config.maskAction, maskState = config.maskState, _a = config.titleFunction, titleFunction = _a === void 0 ? defaultTitleFunction : _a, _b = config.logger, logger = _b === void 0 ? browserConsoleLogger : _b, _c = config.include, include = _c === void 0 ? {
        prevState: true,
        nextState: false,
        changedState: true,
    } : _c, _d = config.rateLimiterRefillRate, rateLimiterRefillRate = _d === void 0 ? 1 : _d, _e = config.rateLimiterBucketSize, rateLimiterBucketSize = _e === void 0 ? 10 : _e, __stateComparisonDepth = config.__stateComparisonDepth;
    var rateLimiter = new core_1.BucketedRateLimiter({
        refillRate: rateLimiterRefillRate,
        bucketSize: rateLimiterBucketSize,
        refillInterval: 1000, // one second in milliseconds,
        _logger: phConsoleLogger,
    });
    return function (store) {
        return function (next) {
            return function (action) {
                var typedAction = action;
                // Get the state before the action
                var prevState = store.getState();
                // Track execution time
                // eslint-disable-next-line compat/compat
                var startTime = performance.now();
                var result = next(typedAction);
                // eslint-disable-next-line compat/compat
                var endTime = performance.now();
                var executionTimeMs = endTime - startTime;
                // Get the state after the action
                var nextState = store.getState();
                var maskedAction = maskAction ? maskAction(typedAction) : typedAction;
                if (!maskedAction) {
                    return result;
                }
                var isRateLimited = rateLimiter.consumeRateLimit(typedAction.type);
                if (isRateLimited) {
                    debouncedActionRateLimitedLogger.info(typedAction.type);
                }
                else {
                    // Apply masking to states
                    try {
                        var maskedPrevState = maskState ? maskState(prevState, maskedAction) : prevState;
                        var maskedNextState = maskState ? maskState(nextState, maskedAction) : nextState;
                        var changedState = include.changedState
                            ? getChangedState(maskedPrevState, maskedNextState, __stateComparisonDepth !== null && __stateComparisonDepth !== void 0 ? __stateComparisonDepth : 5)
                            : undefined;
                        var type = maskedAction.type, actionData = __rest(maskedAction, ["type"]);
                        var reduxEvent = {
                            type: type,
                            payload: actionData,
                            timestamp: Date.now(),
                            executionTimeMs: executionTimeMs,
                            prevState: include.prevState ? maskedPrevState : undefined,
                            nextState: include.nextState ? maskedNextState : undefined,
                            changedState: include.changedState ? changedState : undefined,
                        };
                        var title = titleFunction(reduxEvent);
                        logger(title, reduxEvent);
                    }
                    catch (e) {
                        // logging should never throw errors and break someone's app
                        phConsoleLogger.error('Error logging state:', e);
                    }
                }
                return result;
            };
        };
    };
}
//# sourceMappingURL=posthogReduxLogger.js.map