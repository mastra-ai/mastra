"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.H2Context = void 0;
const http2_1 = require("http2");
const url_1 = require("url");
const callguard_1 = require("callguard");
const core_1 = require("./core");
const request_1 = require("./request");
const response_1 = require("./response");
const utils_1 = require("./utils");
const utils_http2_1 = require("./utils-http2");
const { HTTP2_HEADER_PATH, } = http2_1.constants;
class H2Context {
    constructor(getDecoders, getSessionOptions) {
        // TODO: Remove in favor of protocol-agnostic origin cache
        this._h2sessions = new Map();
        this._h2staleSessions = new Map();
        this._getDecoders = getDecoders;
        this._getSessionOptions = getSessionOptions;
        /* istanbul ignore next */
        if (process.env.DEBUG_FETCH_H2) {
            const debug = (line, ...args) => {
                // tslint:disable-next-line
                console.error(line, ...args);
            };
            const printSession = (origin, session) => {
                debug("  First origin:", origin);
                debug("   Ref-counter:", session.__fetch_h2_refcount);
                debug("   Destroyed:", session.destroyed);
                debug("   Destroyed mark:", session.__fetch_h2_destroyed);
            };
            process.on("SIGUSR2", () => {
                debug("[Debug fetch-h2]: H2 sessions");
                debug(" Active sessions");
                [...this._h2sessions.entries()]
                    .forEach(([origin, { session }]) => {
                    printSession(origin, session);
                });
                debug(" Stale sessions");
                [...this._h2staleSessions.entries()]
                    .forEach(([origin, set]) => {
                    [...set]
                        .forEach((session) => {
                        printSession(origin, session);
                    });
                });
            });
        }
    }
    createHttp2(origin, onGotGoaway, extraOptions) {
        const sessionItem = this.connectHttp2(origin, extraOptions);
        const { promise } = sessionItem;
        // Handle session closure (delete from store)
        promise
            .then(session => {
            session.once("close", () => this.disconnect(origin, session));
            session.once("goaway", (_errorCode, _lastStreamID, _opaqueData) => {
                (0, utils_http2_1.setGotGoaway)(session);
                onGotGoaway();
                this.releaseSession(origin);
            });
        })
            .catch(() => {
            if (sessionItem.session)
                this.disconnect(origin, sessionItem.session);
        });
        this._h2sessions.set(origin, sessionItem);
        const { promise: session, ref, unref } = sessionItem;
        return {
            ref,
            unref,
            session,
        };
    }
    disconnectSession(session) {
        return new Promise(resolve => {
            if (session.destroyed)
                return resolve();
            session.once("close", () => resolve());
            session.destroy();
        });
    }
    releaseSession(origin) {
        const sessionItem = this.deleteActiveSession(origin);
        if (!sessionItem)
            return;
        if (!this._h2staleSessions.has(origin))
            this._h2staleSessions.set(origin, new Set());
        this._h2staleSessions.get(origin)
            .add(sessionItem.session);
    }
    deleteActiveSession(origin) {
        const sessionItem = this._h2sessions.get(origin);
        if (!sessionItem)
            return;
        this._h2sessions.delete(origin);
        sessionItem.session.unref();
        // Never re-ref, this session is over
        (0, utils_http2_1.setDestroyed)(sessionItem.session);
        return sessionItem;
    }
    async disconnectStaleSessions(origin) {
        const promises = [];
        const sessionSet = this._h2staleSessions.get(origin);
        if (!sessionSet)
            return;
        this._h2staleSessions.delete(origin);
        for (const session of sessionSet)
            promises.push(this.disconnectSession(session));
        return Promise.all(promises).then(() => { });
    }
    disconnectAll() {
        const promises = [];
        for (const eventualH2session of this._h2sessions.values()) {
            promises.push(this.handleDisconnect(eventualH2session));
        }
        this._h2sessions.clear();
        for (const origin of this._h2staleSessions.keys()) {
            promises.push(this.disconnectStaleSessions(origin));
        }
        return Promise.all(promises).then(() => { });
    }
    disconnect(url, session) {
        const { origin } = new url_1.URL(url);
        const promises = [];
        const sessionItem = this.deleteActiveSession(origin);
        if (sessionItem && (!session || sessionItem.session === session))
            promises.push(this.handleDisconnect(sessionItem));
        if (!session) {
            promises.push(this.disconnectStaleSessions(origin));
        }
        else if (this._h2staleSessions.has(origin)) {
            const sessionSet = this._h2staleSessions.get(origin);
            if (sessionSet.has(session)) {
                sessionSet.delete(session);
                promises.push(this.disconnectSession(session));
            }
        }
        return Promise.all(promises).then(() => { });
    }
    handleDisconnect(sessionItem) {
        const { promise, session } = sessionItem;
        if (session)
            session.destroy();
        return promise
            .then(_h2session => { })
            .catch(err => {
            const debugMode = false;
            if (debugMode)
                // tslint:disable-next-line
                console.warn("Disconnect error", err);
        });
    }
    handlePush(origin, pushedStream, requestHeaders, ref, unref) {
        if (!this._pushHandler)
            return; // Drop push. TODO: Signal through error log: #8
        const path = requestHeaders[HTTP2_HEADER_PATH];
        // Remove pseudo-headers
        Object.keys(requestHeaders)
            .filter(name => name.charAt(0) === ":")
            .forEach(name => { delete requestHeaders[name]; });
        const pushedRequest = new request_1.Request(path, { headers: requestHeaders, allowForbiddenHeaders: true });
        ref();
        const futureResponse = new Promise((resolve, reject) => {
            const guard = (0, callguard_1.syncGuard)(reject, { catchAsync: true });
            pushedStream.once("close", unref);
            pushedStream.once("aborted", () => reject(new core_1.AbortError("Response aborted")));
            pushedStream.once("frameError", () => reject(new Error("Push request failed")));
            pushedStream.once("error", reject);
            pushedStream.once("push", guard((responseHeaders) => {
                const response = new response_1.StreamResponse(this._getDecoders(origin), path, pushedStream, responseHeaders, false, {}, void 0, 2, false);
                resolve(response);
            }));
        });
        futureResponse
            .catch(_err => { }); // TODO: #8
        const getResponse = () => futureResponse;
        return this._pushHandler(origin, pushedRequest, getResponse);
    }
    connectHttp2(origin, extraOptions = {}) {
        const makeConnectionTimeout = () => new core_1.TimeoutError(`Connection timeout to ${origin}`);
        const makeError = (event) => event
            ? new Error(`Unknown connection error (${event}): ${origin}`)
            : new Error(`Connection closed`);
        let session = void 0;
        // TODO: #8
        // tslint:disable-next-line
        const aGuard = (0, callguard_1.asyncGuard)(console.error.bind(console));
        const sessionRefs = {};
        const makeRefs = (session) => {
            const monkeySession = session;
            monkeySession.__fetch_h2_refcount = 1; // Begins ref'd
            sessionRefs.ref = () => {
                if ((0, utils_http2_1.isDestroyed)(session))
                    return;
                if (monkeySession.__fetch_h2_refcount === 0)
                    // Go from unref'd to ref'd
                    session.ref();
                ++monkeySession.__fetch_h2_refcount;
            };
            sessionRefs.unref = () => {
                if ((0, utils_http2_1.isDestroyed)(session))
                    return;
                --monkeySession.__fetch_h2_refcount;
                if (monkeySession.__fetch_h2_refcount === 0)
                    // Go from ref'd to unref'd
                    session.unref();
            };
        };
        const options = {
            ...this._getSessionOptions(origin),
            ...extraOptions,
        };
        const promise = new Promise((resolve, reject) => {
            session =
                (0, http2_1.connect)(origin, options, () => resolve(session));
            makeRefs(session);
            session.on("stream", aGuard((stream, headers) => this.handlePush(origin, stream, headers, () => sessionRefs.ref(), () => sessionRefs.unref())));
            session.once("close", () => reject((0, utils_1.makeOkError)(makeError())));
            session.once("timeout", () => reject(makeConnectionTimeout()));
            session.once("error", reject);
        });
        return {
            firstOrigin: origin,
            promise,
            ref: () => sessionRefs.ref(),
            session,
            unref: () => sessionRefs.unref(),
        };
    }
}
exports.H2Context = H2Context;
//# sourceMappingURL=context-http2.js.map