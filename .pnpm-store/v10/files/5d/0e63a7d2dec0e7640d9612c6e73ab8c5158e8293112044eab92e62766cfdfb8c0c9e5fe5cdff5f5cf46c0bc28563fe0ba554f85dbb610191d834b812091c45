"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
const url_1 = require("url");
const already_1 = require("already");
const context_http1_1 = require("./context-http1");
const context_http2_1 = require("./context-http2");
const context_https_1 = require("./context-https");
const cookie_jar_1 = require("./cookie-jar");
const core_1 = require("./core");
const fetch_http1_1 = require("./fetch-http1");
const fetch_http2_1 = require("./fetch-http2");
const version_1 = require("./generated/version");
const request_1 = require("./request");
const utils_1 = require("./utils");
const origin_cache_1 = require("./origin-cache");
function makeDefaultUserAgent() {
    const name = `fetch-h2/${version_1.version} (+https://github.com/grantila/fetch-h2)`;
    const node = `nodejs/${process.versions.node}`;
    const nghttp2 = `nghttp2/${process.versions.nghttp2}`;
    const uv = `uv/${process.versions.uv}`;
    return `${name} ${node} ${nghttp2} ${uv}`;
}
const defaultUserAgent = makeDefaultUserAgent();
const defaultAccept = "application/json,text/*;q=0.9,*/*;q=0.8";
class Context {
    constructor(opts) {
        this._httpsFunnel = (0, already_1.funnel)();
        this._http1Funnel = (0, already_1.funnel)();
        this._http2Funnel = (0, already_1.funnel)();
        this._originCache = new origin_cache_1.default();
        this._userAgent = "";
        this._overwriteUserAgent = false;
        this._accept = "";
        this._cookieJar = void 0;
        this._decoders = [];
        this._sessionOptions = {};
        this._httpProtocol = "http1";
        this._httpsProtocols = ["http2", "http1"];
        this._http1Options = {};
        this.setup(opts);
        this.h1Context = new context_http1_1.H1Context(this._http1Options);
        this.h2Context = new context_http2_1.H2Context(this.decoders.bind(this), this.sessionOptions.bind(this));
    }
    setup(opts) {
        opts = opts || {};
        this._cookieJar = "cookieJar" in opts
            ? (opts.cookieJar || new cookie_jar_1.CookieJar())
            : new cookie_jar_1.CookieJar();
        this._userAgent = (0, core_1.parsePerOrigin)(opts.userAgent, "");
        this._overwriteUserAgent =
            (0, core_1.parsePerOrigin)(opts.overwriteUserAgent, false);
        this._accept = (0, core_1.parsePerOrigin)(opts.accept, defaultAccept);
        this._decoders = (0, core_1.parsePerOrigin)(opts.decoders, []);
        this._sessionOptions = (0, core_1.parsePerOrigin)(opts.session, {});
        this._httpProtocol = (0, core_1.parsePerOrigin)(opts.httpProtocol, "http1");
        this._httpsProtocols = (0, core_1.parsePerOrigin)(opts.httpsProtocols, ["http2", "http1"]);
        Object.assign(this._http1Options, opts.http1 || {});
    }
    userAgent(origin) {
        const combine = (userAgent, overwriteUserAgent) => {
            const defaultUA = overwriteUserAgent ? "" : defaultUserAgent;
            return userAgent
                ? defaultUA
                    ? userAgent + " " + defaultUA
                    : userAgent
                : defaultUA;
        };
        return combine((0, core_1.getByOrigin)(this._userAgent, origin), (0, core_1.getByOrigin)(this._overwriteUserAgent, origin));
    }
    decoders(origin) {
        return (0, core_1.getByOrigin)(this._decoders, origin);
    }
    sessionOptions(origin) {
        return (0, core_1.getByOrigin)(this._sessionOptions, origin);
    }
    onPush(pushHandler) {
        this.h2Context._pushHandler = pushHandler;
    }
    async fetch(input, init) {
        return this.retryFetch(input, init);
    }
    async disconnect(url) {
        const { origin } = this.parseInput(url);
        this._originCache.disconnect(origin);
        await Promise.all([
            this.h1Context.disconnect(url),
            this.h2Context.disconnect(url),
        ]);
    }
    async disconnectAll() {
        this._originCache.disconnectAll();
        await Promise.all([
            this.h1Context.disconnectAll(),
            this.h2Context.disconnectAll(),
        ]);
    }
    async retryFetch(input, init, extra, count = 0) {
        ++count;
        return this.retryableFetch(input, init, extra)
            .catch((0, already_1.specific)(core_1.RetryError, err => {
            // TODO: Implement a more robust retry logic
            if (count > 10)
                throw err;
            return this.retryFetch(input, init, extra, count);
        }));
    }
    async retryableFetch(input, init, extra) {
        const { hostname, origin, port, protocol, url } = this.parseInput(input);
        // Rewrite url to get rid of "http1://" and "http2://"
        const request = input instanceof request_1.Request
            ? input.url !== url
                ? input.clone(url)
                : input
            : new request_1.Request(input, { ...(init || {}), url });
        const { rejectUnauthorized } = this.sessionOptions(origin);
        const makeSimpleSession = (protocol) => ({
            accept: () => (0, core_1.getByOrigin)(this._accept, origin),
            contentDecoders: () => (0, core_1.getByOrigin)(this._decoders, origin),
            cookieJar: this._cookieJar,
            protocol,
            userAgent: () => this.userAgent(origin),
            newFetch: this.retryFetch.bind(this),
        });
        const doFetchHttp1 = (socket, cleanup) => {
            const sessionGetterHttp1 = {
                get: (url) => ({
                    cleanup,
                    req: this.getHttp1(url, socket, request, rejectUnauthorized),
                }),
                ...makeSimpleSession("http1"),
            };
            return (0, fetch_http1_1.fetch)(sessionGetterHttp1, request, init, extra);
        };
        const doFetchHttp2 = async (cacheableSession) => {
            const { session, unref } = cacheableSession;
            const cleanup = (0, already_1.once)(unref);
            try {
                const sessionGetterHttp2 = {
                    get: () => ({ session, cleanup }),
                    ...makeSimpleSession("http2"),
                };
                return await (0, fetch_http2_1.fetch)(sessionGetterHttp2, request, init, extra);
            }
            catch (err) {
                cleanup();
                throw err;
            }
        };
        const tryWaitForHttp1 = async (session) => {
            const { socket: freeHttp1Socket, cleanup, shouldCreateNew } = this.h1Context.getFreeSocketForSession(session);
            if (freeHttp1Socket)
                return doFetchHttp1(freeHttp1Socket, cleanup);
            if (!shouldCreateNew) {
                // We've maxed out HTTP/1 connections, wait for one to be
                // freed.
                const { socket, cleanup } = await this.h1Context.waitForSocketBySession(session);
                return doFetchHttp1(socket, cleanup);
            }
        };
        if (protocol === "http1") {
            return this._http1Funnel(async (shouldRetry, retry, shortcut) => {
                var _a;
                if (shouldRetry())
                    return retry();
                // Plain text HTTP/1(.1)
                const cacheItem = this._originCache.get("http1", origin);
                const session = (_a = cacheItem === null || cacheItem === void 0 ? void 0 : cacheItem.session) !== null && _a !== void 0 ? _a : this.h1Context.getSessionForOrigin(origin);
                const resp = await tryWaitForHttp1(session);
                if (resp)
                    return resp;
                const socket = await this.h1Context.makeNewConnection(url);
                this._originCache.set(origin, "http1", session);
                shortcut();
                const cleanup = this.h1Context.addUsedSocket(session, socket);
                return doFetchHttp1(socket, cleanup);
            });
        }
        else if (protocol === "http2") {
            return this._http2Funnel(async (_, __, shortcut) => {
                // Plain text HTTP/2
                const cacheItem = this._originCache.get("http2", origin);
                if (cacheItem) {
                    cacheItem.session.ref();
                    shortcut();
                    return doFetchHttp2(cacheItem.session);
                }
                // Convert socket into http2 session, this will ref (*)
                const cacheableSession = this.h2Context.createHttp2(origin, () => { this._originCache.delete(cacheableSession); });
                this._originCache.set(origin, "http2", cacheableSession);
                shortcut();
                // Session now lingering, it will be re-used by the next get()
                return doFetchHttp2(cacheableSession);
            });
        }
        else // protocol === "https"
         {
            return this._httpsFunnel((shouldRetry, retry, shortcut) => shouldRetry()
                ? retry()
                : this.connectSequenciallyTLS(shortcut, hostname, port, origin, tryWaitForHttp1, doFetchHttp1, doFetchHttp2));
        }
    }
    async connectSequenciallyTLS(shortcut, hostname, port, origin, tryWaitForHttp1, doFetchHttp1, doFetchHttp2) {
        var _a, _b;
        const cacheItem = (_a = this._originCache.get("https2", origin)) !== null && _a !== void 0 ? _a : this._originCache.get("https1", origin);
        if (cacheItem) {
            if (cacheItem.protocol === "https1") {
                shortcut();
                const resp = await tryWaitForHttp1(cacheItem.session);
                if (resp)
                    return resp;
            }
            else if (cacheItem.protocol === "https2") {
                cacheItem.session.ref();
                shortcut();
                return doFetchHttp2(cacheItem.session);
            }
        }
        // Use ALPN to figure out protocol lazily
        const { protocol, socket, altNameMatch } = await (0, context_https_1.connectTLS)(hostname, port, (0, core_1.getByOrigin)(this._httpsProtocols, origin), (0, core_1.getByOrigin)(this._sessionOptions, origin));
        const disconnect = (0, already_1.once)(() => {
            if (!socket.destroyed) {
                socket.destroy();
                socket.unref();
            }
        });
        if (protocol === "http2") {
            // Convert socket into http2 session, this will ref (*)
            // const { cleanup, session, didCreate } =
            const cacheableSession = this.h2Context.createHttp2(origin, () => { this._originCache.delete(cacheableSession); }, {
                createConnection: () => socket,
            });
            this._originCache.set(origin, "https2", cacheableSession, altNameMatch, disconnect);
            shortcut();
            // Session now lingering, it will be re-used by the next get()
            return doFetchHttp2(cacheableSession);
        }
        else // protocol === "http1"
         {
            const session = (_b = cacheItem === null || cacheItem === void 0 ? void 0 : cacheItem.session) !== null && _b !== void 0 ? _b : this.h1Context.getSessionForOrigin(origin);
            // TODO: Update the alt-name list in the origin cache (if the new
            //       TLS socket contains more/other alt-names).
            if (!cacheItem)
                this._originCache.set(origin, "https1", session, altNameMatch, disconnect);
            const cleanup = this.h1Context.addUsedSocket(session, socket);
            shortcut();
            return doFetchHttp1(socket, cleanup);
        }
    }
    getHttp1(url, socket, request, rejectUnauthorized) {
        return this.h1Context.connect(new url_1.URL(url), {
            createConnection: () => socket,
            rejectUnauthorized,
        }, request);
    }
    parseInput(input) {
        const { hostname, origin, port, protocol, url } = (0, utils_1.parseInput)(typeof input !== "string" ? input.url : input);
        const defaultHttp = this._httpProtocol;
        if ((protocol === "http" && defaultHttp === "http1")
            || protocol === "http1")
            return {
                hostname,
                origin,
                port,
                protocol: "http1",
                url,
            };
        else if ((protocol === "http" && defaultHttp === "http2")
            || protocol === "http2")
            return {
                hostname,
                origin,
                port,
                protocol: "http2",
                url,
            };
        else if (protocol === "https")
            return {
                hostname,
                origin,
                port,
                protocol: "https",
                url,
            };
        else
            throw new core_1.FetchError(`Invalid protocol "${protocol}"`);
    }
}
exports.Context = Context;
//# sourceMappingURL=context.js.map