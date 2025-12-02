"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.marshalPromiseToCallbacks = exports.Sink = exports.Deferred = exports.PromiseResultEventSource = exports.PromiseResult = exports.PromiseState = void 0;
/* eslint-disable max-classes-per-file, @typescript-eslint/typedef */
var PromiseState;
(function (PromiseState) {
    PromiseState[PromiseState["None"] = 0] = "None";
    PromiseState[PromiseState["Resolved"] = 1] = "Resolved";
    PromiseState[PromiseState["Rejected"] = 2] = "Rejected";
})(PromiseState = exports.PromiseState || (exports.PromiseState = {}));
class PromiseResult {
    constructor(promiseResultEventSource) {
        this.throwIfError = () => {
            if (this.isError) {
                throw this.error;
            }
        };
        promiseResultEventSource.on((result) => {
            if (!this.privIsCompleted) {
                this.privIsCompleted = true;
                this.privIsError = false;
                this.privResult = result;
            }
        }, (error) => {
            if (!this.privIsCompleted) {
                this.privIsCompleted = true;
                this.privIsError = true;
                this.privError = error;
            }
        });
    }
    get isCompleted() {
        return this.privIsCompleted;
    }
    get isError() {
        return this.privIsError;
    }
    get error() {
        return this.privError;
    }
    get result() {
        return this.privResult;
    }
}
exports.PromiseResult = PromiseResult;
class PromiseResultEventSource {
    constructor() {
        this.setResult = (result) => {
            this.privOnSetResult(result);
        };
        this.setError = (error) => {
            this.privOnSetError(error);
        };
        this.on = (onSetResult, onSetError) => {
            this.privOnSetResult = onSetResult;
            this.privOnSetError = onSetError;
        };
    }
}
exports.PromiseResultEventSource = PromiseResultEventSource;
class Deferred {
    constructor() {
        this.resolve = (result) => {
            this.privResolve(result);
            return this;
        };
        this.reject = (error) => {
            this.privReject(error);
            return this;
        };
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        this.privPromise = new Promise((resolve, reject) => {
            this.privResolve = resolve;
            this.privReject = reject;
        });
    }
    get promise() {
        return this.privPromise;
    }
}
exports.Deferred = Deferred;
class Sink {
    constructor() {
        this.privState = PromiseState.None;
        this.privPromiseResult = null;
        this.privPromiseResultEvents = null;
        this.privSuccessHandlers = [];
        this.privErrorHandlers = [];
        this.privPromiseResultEvents = new PromiseResultEventSource();
        this.privPromiseResult = new PromiseResult(this.privPromiseResultEvents);
    }
    get state() {
        return this.privState;
    }
    get result() {
        return this.privPromiseResult;
    }
    resolve(result) {
        if (this.privState !== PromiseState.None) {
            throw new Error("'Cannot resolve a completed promise'");
        }
        this.privState = PromiseState.Resolved;
        this.privPromiseResultEvents.setResult(result);
        for (let i = 0; i < this.privSuccessHandlers.length; i++) {
            this.executeSuccessCallback(result, this.privSuccessHandlers[i], this.privErrorHandlers[i]);
        }
        this.detachHandlers();
    }
    reject(error) {
        if (this.privState !== PromiseState.None) {
            throw new Error("'Cannot reject a completed promise'");
        }
        this.privState = PromiseState.Rejected;
        this.privPromiseResultEvents.setError(error);
        for (const errorHandler of this.privErrorHandlers) {
            this.executeErrorCallback(error, errorHandler);
        }
        this.detachHandlers();
    }
    on(successCallback, errorCallback) {
        if (successCallback == null) {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            successCallback = () => { };
        }
        if (this.privState === PromiseState.None) {
            this.privSuccessHandlers.push(successCallback);
            this.privErrorHandlers.push(errorCallback);
        }
        else {
            if (this.privState === PromiseState.Resolved) {
                this.executeSuccessCallback(this.privPromiseResult.result, successCallback, errorCallback);
            }
            else if (this.privState === PromiseState.Rejected) {
                this.executeErrorCallback(this.privPromiseResult.error, errorCallback);
            }
            this.detachHandlers();
        }
    }
    executeSuccessCallback(result, successCallback, errorCallback) {
        try {
            successCallback(result);
        }
        catch (e) {
            this.executeErrorCallback(`'Unhandled callback error: ${e}'`, errorCallback);
        }
    }
    executeErrorCallback(error, errorCallback) {
        if (errorCallback) {
            try {
                errorCallback(error);
            }
            catch (e) {
                throw new Error(`'Unhandled callback error: ${e}. InnerError: ${error}'`);
            }
        }
        else {
            throw new Error(`'Unhandled error: ${error}'`);
        }
    }
    detachHandlers() {
        this.privErrorHandlers = [];
        this.privSuccessHandlers = [];
    }
}
exports.Sink = Sink;
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function marshalPromiseToCallbacks(promise, cb, err) {
    promise.then((val) => {
        try {
            if (!!cb) {
                cb(val);
            }
        }
        catch (error) {
            if (!!err) {
                try {
                    if (error instanceof Error) {
                        const typedError = error;
                        err(typedError.name + ": " + typedError.message);
                    }
                    else {
                        err(error);
                    }
                    // eslint-disable-next-line no-empty
                }
                catch (error) { }
            }
        }
    }, (error) => {
        if (!!err) {
            try {
                if (error instanceof Error) {
                    const typedError = error;
                    err(typedError.name + ": " + typedError.message);
                }
                else {
                    err(error);
                }
                // eslint-disable-next-line no-empty
            }
            catch (error) { }
        }
    });
}
exports.marshalPromiseToCallbacks = marshalPromiseToCallbacks;

//# sourceMappingURL=Promise.js.map
