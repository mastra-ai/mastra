"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deferSet = exports.OrderedAsynchrony = exports.funnel = exports.wrapFunction = exports.rethrow = exports.specific = exports.deferInspectable = exports.inspect = exports.reflect = exports.defer = exports.retry = exports.once = exports.some = exports.eachImpl = exports.each = exports.reduce = exports.map = exports.filter = exports.props = exports.tap = exports.delayChain = exports.delay = exports.concurrent = void 0;
exports.default = {
    defer,
    deferSet,
    delay,
    delayChain,
    each,
    filter,
    funnel,
    inspect,
    map,
    once,
    props,
    reduce,
    rethrow,
    retry,
    some,
    specific,
    tap,
    wrapFunction,
};
function toReadonlyArray(arr) {
    /* istanbul ignore else */
    if (typeof arr.map === "function")
        return arr;
    else
        return Array.from(arr);
}
function concurrent(size, fn) {
    const queue = makeQueue(size);
    if (size < 1)
        throw new RangeError(`Size must be at least 1`);
    if (!fn)
        return (cb, ...args) => queue.enqueue(() => cb(...args));
    else
        return (...args) => queue.enqueue(() => fn(...args));
}
exports.concurrent = concurrent;
function makeQueue(size) {
    const queue = {
        size,
        count: 0,
        queue: [],
        process: () => {
            if (queue.queue.length) {
                const first = queue.queue.shift();
                const { cb, deferred } = first;
                queue.runOne(cb).then(deferred.resolve, deferred.reject);
            }
        },
        runOne: (cb) => {
            ++queue.count;
            return (async () => cb())()
                .finally(() => {
                --queue.count;
                queue.process();
            });
        },
        enqueue: async (cb) => {
            if (queue.count >= queue.size) {
                const deferred = defer();
                queue.queue.push({ cb, deferred });
                return deferred.promise;
            }
            return queue.runOne(cb);
        }
    };
    return queue;
}
function delay(milliseconds, t) {
    return new Promise(resolve => {
        setTimeout(() => resolve(t), milliseconds);
    });
}
exports.delay = delay;
function delayChain(milliseconds) {
    return tap(() => delay(milliseconds));
}
exports.delayChain = delayChain;
function tap(fn) {
    return async (t) => {
        await fn(t);
        return t;
    };
}
exports.tap = tap;
function props(obj) {
    const ret = {};
    const awaiters = [];
    for (const prop of Object.keys(obj))
        awaiters.push(Promise.resolve(obj[prop])
            .then(val => { ret[prop] = val; }));
    return Promise.all(awaiters).then(() => ret);
}
exports.props = props;
const defaultFilterMapOptions = { concurrency: Infinity };
function filter(arr, opts, filterFn) {
    if (Array.isArray(arr)) {
        if (typeof opts === "function") {
            filterFn = opts;
            opts = defaultFilterMapOptions;
        }
        const intermediate = filter(opts, filterFn);
        return intermediate(arr);
    }
    filterFn = typeof arr === "function" ? arr : opts;
    opts =
        typeof arr === "function"
            ? defaultFilterMapOptions
            : arr;
    const wrappedFilterFn = (val, index, arr) => Promise.resolve(filterFn(val, index, arr))
        .then(ok => ({ ok, val }));
    return (t) => {
        return map(opts, wrappedFilterFn)(t)
            .then(values => values
            .filter(({ ok }) => ok)
            .map(({ val }) => val));
    };
}
exports.filter = filter;
function map(arr, opts, mapFn) {
    if (Array.isArray(arr)) {
        if (typeof opts === "function") {
            mapFn = opts;
            opts = defaultFilterMapOptions;
        }
        return map(opts, mapFn)(arr);
    }
    mapFn = typeof arr === "function" ? arr : opts;
    opts =
        typeof arr === "function"
            ? defaultFilterMapOptions
            : arr;
    const { concurrency = Infinity } = opts;
    const promiseMapFn = (t, index, arr) => Promise.resolve(mapFn(t, index, arr));
    const concurrently = concurrent(concurrency);
    return (t) => {
        return Promise.resolve(t)
            .then((values) => toReadonlyArray(values).map((val, index, arr) => (() => Promise.resolve(val))()
            .then((val) => concurrently(promiseMapFn, val, index, arr))))
            .then(values => Promise.all(values));
    };
}
exports.map = map;
function reduce(input, reducer, initialValue) {
    if (typeof input === "function") {
        initialValue = reducer;
        const _reducer = input;
        return async (input) => {
            return reduceImpl(input, _reducer, initialValue);
        };
    }
    return reduceImpl(input, reducer, initialValue);
}
exports.reduce = reduce;
async function reduceImpl(input, reducer, initialValue) {
    const _input = Array.from(await input);
    const _initialValue = await initialValue;
    if (_input.length === 0)
        return _initialValue;
    const usingInitialValue = typeof _initialValue !== "undefined";
    const length = _input.length;
    let index = usingInitialValue ? 0 : 1;
    let accumulator = usingInitialValue
        ? _initialValue
        // This cast should be safe if the interface is respected
        : await _input.shift();
    while (_input.length > 0)
        accumulator = await reducer(accumulator, await _input.shift(), index++, length);
    return accumulator;
}
function each(arr, eachFn) {
    if (Array.isArray(arr))
        return eachImpl(eachFn)(arr);
    return eachImpl(arr);
}
exports.each = each;
function eachImpl(eachFn) {
    return async (arr) => {
        const length = arr.length;
        async function iterator(t, index) {
            await eachFn(t, index, length);
            return t;
        }
        return map(arr, { concurrency: 1 }, iterator);
    };
}
exports.eachImpl = eachImpl;
function some(list, fn) {
    if (typeof list === "function") {
        fn = list;
        return (list) => someImpl(list, fn);
    }
    return someImpl(list, fn);
}
exports.some = some;
async function someImpl(list, fn) {
    const _list = toReadonlyArray(await list);
    for (const val of _list) {
        const ret = await fn(await val);
        if (ret)
            return ret;
    }
    return false;
}
function once(fn) {
    if (fn) {
        const _once = onceDynamic();
        return ((t) => _once(fn, t));
    }
    else
        return onceDynamic();
}
exports.once = once;
function onceDynamic() {
    const state = new WeakMap();
    const ensureState = (fn) => {
        if (!state.has(fn))
            state.set(fn, { hasRun: false });
    };
    return ((fn, t) => {
        ensureState(fn);
        const stateObject = state.get(fn);
        if (stateObject.hasRun) {
            if (stateObject.deferred)
                return stateObject.deferred.promise;
            return stateObject.returnValue;
        }
        stateObject.hasRun = true;
        const ret = fn(t);
        const pret = ret;
        if (pret !== undefined && pret && typeof pret.then === "function") {
            stateObject.deferred = defer(void 0);
            return pret
                .then(stateObject.deferred.resolve, rethrow(stateObject.deferred.reject))
                .then(() => stateObject.deferred.promise);
        }
        stateObject.returnValue = ret;
        return ret;
    });
}
function retry(times, fn, retryable = () => true) {
    const retryAsync = (promise) => promise
        .catch((err) => {
        if (--times < 0 || !retryable(err))
            throw err;
        return retryAsync(fn());
    });
    const retrySync = (_err) => {
        while (--times >= 0) {
            try {
                return fn();
            }
            catch (err) {
                if (!retryable(err))
                    throw err;
                _err = err;
            }
        }
        throw _err;
    };
    try {
        const ret = fn();
        if (ret &&
            typeof ret === "object" &&
            typeof ret.then === "function") {
            return retryAsync(ret);
        }
        return ret;
    }
    catch (err) {
        if (!retryable(err))
            throw err;
        return retrySync(err);
    }
}
exports.retry = retry;
function defer() {
    var _a;
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    /* istanbul ignore next */
    if (((_a = process === null || process === void 0 ? void 0 : process.env) === null || _a === void 0 ? void 0 : _a.JEST_WORKER_ID) !== undefined)
        try {
            // Jest has decided for many versions to break async catching,
            // so this is needed for unit tests not to break unnecessarily.
            deferred.promise.catch(() => { });
        }
        catch (_err) { }
    return deferred;
}
exports.defer = defer;
function reflect(promise) {
    const inspection = inspect(promise);
    function handleResolution(value) {
        return {
            isRejected: false,
            isResolved: true,
            value,
        };
    }
    function handleRejection(error) {
        return {
            error,
            isRejected: true,
            isResolved: false,
        };
    }
    return inspection.promise
        .then(handleResolution, handleRejection);
}
exports.reflect = reflect;
function inspect(promise) {
    const inspectable = {
        isPending: true,
        isRejected: false,
        isResolved: false,
        promise: void 0,
    };
    inspectable.promise = promise.then(value => {
        inspectable.isResolved = true;
        inspectable.isPending = false;
        return value;
    })
        .catch(err => {
        inspectable.isRejected = true;
        inspectable.isPending = false;
        return Promise.reject(err);
    });
    return inspectable;
}
exports.inspect = inspect;
function deferInspectable() {
    const deferred = defer();
    const ret = {
        isPending: true,
        isRejected: false,
        isResolved: false,
        promise: deferred.promise,
        resolve(t) {
            if (!ret.isPending)
                return;
            deferred.resolve(t);
            ret.isPending = false;
            ret.isRejected = false;
            ret.isResolved = true;
        },
        reject(err) {
            if (!ret.isPending)
                return;
            deferred.reject(err);
            ret.isPending = false;
            ret.isRejected = true;
            ret.isResolved = false;
        },
    };
    return ret;
}
exports.deferInspectable = deferInspectable;
// This logic is taken from Bluebird
function catchFilter(filters, err) {
    return (Array.isArray(filters) ? filters : [filters])
        .some((filter) => {
        if (filter == null)
            return false;
        if (filter === Error ||
            filter.prototype instanceof Error) {
            if (err instanceof filter)
                return true;
        }
        else if (typeof filter === "function") {
            const filterFn = filter;
            // It is "ok" for this to throw. It'll be thrown back to the catch
            // handler, and the promise chain will contain this error.
            return filterFn(err);
        }
        else if (typeof filter === "object") {
            const obj = filter;
            for (const key of Object.keys(obj))
                if (obj[key] !== err[key])
                    return false;
            return true;
        }
        return false;
    });
}
function specific(filters, handler) {
    return (err) => {
        if (!catchFilter(filters, err))
            throw err;
        return handler(err);
    };
}
exports.specific = specific;
function rethrow(fn) {
    return async (err) => {
        await fn(err);
        throw err;
    };
}
exports.rethrow = rethrow;
function wrapFunction(wrap) {
    // tslint:disable-next-line
    return function (t, cb) {
        if (arguments.length === 1) {
            if (wrap.length > 0)
                throw new EvalError("Invalid invocation, function requires 2 arguments");
            cb = t;
            t = void 0;
        }
        const anyCleanup = wrap(t);
        const callCleanup = (cleanup) => {
            if (typeof cleanup === "function")
                return cleanup();
            else if (cleanup != null)
                // Allow 'before' to just return null/undefined, but non-empty
                // value would've been silently ignored.
                throw new EvalError("Invalid return value in 'before' handler");
        };
        if (anyCleanup &&
            typeof anyCleanup.then === "function") {
            let doCleanup;
            return anyCleanup
                .then(async (cleanup) => {
                doCleanup = () => callCleanup(cleanup);
                return cb();
            })
                .finally(() => {
                if (doCleanup)
                    return doCleanup();
            });
        }
        else {
            const cleanup = anyCleanup;
            let cbRet;
            try {
                cbRet = cb();
            }
            catch (err) {
                const cleanupRet = callCleanup(cleanup);
                if (cleanupRet &&
                    typeof cleanupRet.then === "function") {
                    return cleanupRet
                        .then(() => { throw err; });
                }
                else {
                    throw err;
                }
            }
            if (cbRet && typeof cbRet.then === "function") {
                return cbRet
                    .finally(() => callCleanup(cleanup));
            }
            else {
                const cleanupRet = callCleanup(cleanup);
                if (cleanupRet &&
                    typeof cleanupRet.then === "function") {
                    return cleanupRet
                        .then(() => cbRet);
                }
                else {
                    return cbRet;
                }
            }
        }
    };
}
exports.wrapFunction = wrapFunction;
function funnel(opts = {}) {
    const { onEmpty, concurrency = 1 } = (opts || {});
    let FunnelState;
    (function (FunnelState) {
        FunnelState[FunnelState["DEFAULT"] = 0] = "DEFAULT";
        FunnelState[FunnelState["SHOULD_RETRY"] = 1] = "SHOULD_RETRY";
        FunnelState[FunnelState["WAITING"] = 2] = "WAITING";
        FunnelState[FunnelState["COMPLETED"] = 3] = "COMPLETED";
    })(FunnelState || (FunnelState = {}));
    /**
     * All ongoing tasks (functions) regardless of state they are in.
     * If they return/throw or shortcut, they get cleared from this map.
     * The order is preserved for fifo fairness.
     */
    const tasks = new Map();
    const countWaiting = () => {
        return [...tasks.values()]
            .filter(({ state }) => state === FunnelState.WAITING)
            .length;
    };
    const countWorking = () => {
        return [...tasks.values()]
            .filter(({ state }) => state === FunnelState.SHOULD_RETRY)
            .length;
    };
    const freeSlots = () => {
        return Math.max(0, concurrency - countWorking());
    };
    const triggerWaiting = () => {
        const amountToResume = freeSlots();
        [...tasks.values()]
            .filter(({ state }) => state === FunnelState.WAITING)
            .slice(0, amountToResume)
            .forEach(task => {
            task.resume();
        });
    };
    return (fn) => {
        const sentry = {};
        const store = {
            state: FunnelState.DEFAULT,
            counted: false,
            resume: undefined,
        };
        tasks.set(sentry, store);
        const shouldRetry = () => {
            if (store.state === FunnelState.COMPLETED)
                // shortcut before should/retry shortcuts through
                return false;
            const free = freeSlots();
            const shouldContinue = free > 0;
            if (store.state !== FunnelState.DEFAULT)
                throw new Error("Invalid use of 'shouldRetry'");
            store.state = FunnelState.SHOULD_RETRY;
            store.counted = true;
            return !shouldContinue;
        };
        const retry = () => {
            if (store.state !== FunnelState.SHOULD_RETRY)
                throw new Error("Invalid use of 'retry', " +
                    "must only be called after 'shouldRetry'");
            store.state = FunnelState.WAITING;
            const deferred = defer();
            const resume = () => {
                store.state = FunnelState.DEFAULT;
                store.resume = undefined;
                deferred.resolve(runner());
            };
            store.resume = resume;
            return deferred.promise;
        };
        const shortcut = () => {
            if (store.state === FunnelState.COMPLETED)
                return;
            store.state = FunnelState.COMPLETED;
            tasks.delete(sentry);
            if (countWaiting() === 0)
                onEmpty === null || onEmpty === void 0 ? void 0 : onEmpty();
            else
                triggerWaiting();
        };
        const runner = () => {
            return (async () => fn(shouldRetry, retry, shortcut))()
                .finally(shortcut);
        };
        return runner();
    };
}
exports.funnel = funnel;
class OrderedAsynchrony {
    constructor() {
        this.deferrals = [];
    }
    wait(waitForIndex, resolveIndex, rejectIndex) {
        this.ensureDeferral([
            ...([].concat(waitForIndex)),
            ...(resolveIndex == null ? [] :
                [].concat(resolveIndex)),
            ...(rejectIndex == null ? [] :
                [].concat(rejectIndex)),
        ]);
        return this.decorate(Promise.all([].concat(waitForIndex)
            .map(index => this.deferrals[index].promise))
            .then(() => Promise.all([
            resolveIndex == null
                ? void 0
                : this.resolve(resolveIndex),
            rejectIndex == null
                ? void 0
                : this.reject(rejectIndex),
        ])
            .then(() => { })));
    }
    resolve(index) {
        this.ensureDeferral(index);
        return this.decorate(delay(0).then(() => {
            [].concat(index)
                .forEach(index => {
                this.deferrals[index].resolve();
            });
        }));
    }
    reject(index, error = new Error("OrderedAsynchrony rejection")) {
        this.ensureDeferral(index);
        return this.decorate(delay(0).then(() => {
            [].concat(index)
                .forEach(index => {
                this.deferrals[index].reject(error);
            });
        }));
    }
    ensureDeferral(index) {
        const indices = []
            .concat(index)
            .sort((a, b) => b - a);
        const highest = indices[0];
        for (let i = this.deferrals.length; i <= highest; ++i)
            this.deferrals.push(defer(void 0));
        return this;
    }
    decorate(promise) {
        // tslint:disable-next-line:variable-name
        const This = {
            decorate: this.decorate.bind(this),
            deferrals: this.deferrals,
            ensureDeferral: this.ensureDeferral.bind(this),
            reject: this.reject.bind(this),
            resolve: this.resolve.bind(this),
            wait: this.wait.bind(this),
        };
        return Object.assign(promise, This);
    }
}
exports.OrderedAsynchrony = OrderedAsynchrony;
function deferSet() {
    return new OrderedAsynchrony();
}
exports.deferSet = deferSet;
