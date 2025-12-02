"use strict";
exports.__esModule = true;
exports.WaitGroup = void 0;
/**
 * A WaitGroup waits for a collection of actions to finish.
 * The main goroutine calls `add` to set the number of actions to wait for.
 * Then each of the actions runs and calls `done` when finished.
 * At the same time, `wait` can be used to return a promise that resolves when all actions have finished.
 *
 * The class doesn't implement the race-condition requirements that the Golang package has due to the
 * way Node functions, meaning `add`, `done` and `wait` can be called at any time, in any order.
 */
var WaitGroup = /** @class */ (function () {
    function WaitGroup() {
        this.current = 0;
        this.queued = [];
    }
    WaitGroup.prototype.queue = function (fn) {
        if (this.current === 0) {
            fn();
        }
        else {
            this.queued.push(fn);
        }
    };
    WaitGroup.prototype.resolveQueue = function () {
        var _a;
        while (this.queued.length > 0) {
            (_a = this.queued.shift()) === null || _a === void 0 ? void 0 : _a();
        }
    };
    /**
   * Adds a delta, which may be negative, to the WaitGroup counter.
   * If the counter becomes zero, all promises returned from `wait` are resolved.
   * If the counter goes negative, an error is thrown.
   */
    WaitGroup.prototype.add = function (delta) {
        if (delta === void 0) { delta = 1; }
        this.current += delta;
        if (this.current < 0)
            throw new Error('Negative WaitGroup counter');
        if (this.current === 0)
            this.resolveQueue();
    };
    /**
   * Decrements the WaitGroup counter by one.
   */
    WaitGroup.prototype.done = function () {
        this.add(-1);
    };
    /**
   * Returns a promise that resolves when the WaitGroup counter is zero.
   * If the counter is zero when the method is called, it's resolved immediately.
   */
    WaitGroup.prototype.wait = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.queue(function () { return resolve(); });
        });
    };
    return WaitGroup;
}());
exports.WaitGroup = WaitGroup;
