"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.H1Context = exports.OriginPool = void 0;
const http_1 = require("http");
const https_1 = require("https");
const net_1 = require("net");
const url_1 = require("url");
const already_1 = require("already");
const core_1 = require("./core");
const utils_1 = require("./utils");
class OriginPool {
    constructor(keepAlive, keepAliveMsecs, maxSockets, maxFreeSockets, timeout) {
        this.usedSockets = new Set();
        this.unusedSockets = new Set();
        this.waiting = [];
        this.keepAlive = keepAlive;
        this.keepAliveMsecs = keepAliveMsecs;
        this.maxSockets = maxSockets;
        this.maxFreeSockets = maxFreeSockets;
        this.connOpts = timeout == null ? {} : { timeout };
    }
    connect(options) {
        const request = options.protocol === "https:"
            ? https_1.request
            : http_1.request;
        const opts = { ...options };
        if (opts.rejectUnauthorized == null || options.protocol === "https")
            delete opts.rejectUnauthorized;
        const req = request({ ...this.connOpts, ...opts });
        return req;
    }
    addUsed(socket) {
        if (this.keepAlive)
            socket.setKeepAlive(true, this.keepAliveMsecs);
        socket.once("close", () => {
            this.usedSockets.delete(socket);
            this.unusedSockets.delete(socket);
        });
        this.usedSockets.add(socket);
        return this.makeCleaner(socket);
    }
    getFreeSocket() {
        const socketAndCleanup = this.getFirstUnused();
        if (socketAndCleanup)
            return { ...socketAndCleanup, shouldCreateNew: false };
        const shouldCreateNew = this.maxSockets >= this.usedSockets.size;
        return { shouldCreateNew };
    }
    waitForSocket() {
        const deferred = (0, already_1.defer)();
        this.waiting.push(deferred);
        // Trigger due to potential race-condition
        this.pumpWaiting();
        return deferred.promise;
    }
    async disconnectAll() {
        await Promise.all([...this.usedSockets, ...this.unusedSockets]
            .map(socket => socket.destroyed ? void 0 : this.disconnectSocket(socket)));
        const waiting = this.waiting;
        this.waiting.length = 0;
        waiting.forEach(waiter => 
        // TODO: Better error class + message
        waiter.reject(new Error("Disconnected")));
    }
    getFirstUnused() {
        for (const socket of this.unusedSockets.values()) {
            // We obviously have a socket
            this.moveToUsed(socket);
            return { socket, cleanup: this.makeCleaner(socket) };
        }
        return null;
    }
    tryReuse(socket) {
        if (this.waiting.length === 0)
            return false;
        const waiting = this.waiting.shift();
        waiting.resolve({ socket, cleanup: this.makeCleaner(socket) });
        return true;
    }
    pumpWaiting() {
        while (this.waiting.length > 0 && this.unusedSockets.size > 0) {
            const socketAndCleanup = this.getFirstUnused();
            const waiting = this.waiting.shift();
            waiting.resolve(socketAndCleanup);
        }
    }
    async disconnectSocket(socket) {
        socket.destroy();
    }
    makeCleaner(socket) {
        let hasCleaned = false;
        return () => {
            if (hasCleaned)
                return;
            hasCleaned = true;
            if (!socket.destroyed)
                this.moveToUnused(socket);
        };
    }
    async moveToUnused(socket) {
        if (this.tryReuse(socket))
            return;
        this.usedSockets.delete(socket);
        if (this.maxFreeSockets < this.unusedSockets.size + 1) {
            await this.disconnectSocket(socket);
            return;
        }
        this.unusedSockets.add(socket);
        socket.unref();
    }
    moveToUsed(socket) {
        this.unusedSockets.delete(socket);
        this.usedSockets.add(socket);
        socket.ref();
        return socket;
    }
}
exports.OriginPool = OriginPool;
class ContextPool {
    constructor(options) {
        this.pools = new Map();
        this.keepAlive = (0, core_1.parsePerOrigin)(options.keepAlive, true);
        this.keepAliveMsecs = (0, core_1.parsePerOrigin)(options.keepAliveMsecs, 1000);
        this.maxSockets = (0, core_1.parsePerOrigin)(options.maxSockets, 256);
        this.maxFreeSockets = (0, core_1.parsePerOrigin)(options.maxFreeSockets, Infinity);
        this.timeout = (0, core_1.parsePerOrigin)(options.timeout, void 0);
    }
    hasOrigin(origin) {
        return this.pools.has(origin);
    }
    getOriginPool(origin) {
        const pool = this.pools.get(origin);
        if (!pool) {
            const keepAlive = (0, core_1.getByOrigin)(this.keepAlive, origin);
            const keepAliveMsecs = (0, core_1.getByOrigin)(this.keepAliveMsecs, origin);
            const maxSockets = (0, core_1.getByOrigin)(this.maxSockets, origin);
            const maxFreeSockets = (0, core_1.getByOrigin)(this.maxFreeSockets, origin);
            const timeout = (0, core_1.getByOrigin)(this.timeout, origin);
            const newPool = new OriginPool(keepAlive, keepAliveMsecs, maxSockets, maxFreeSockets, timeout);
            this.pools.set(origin, newPool);
            return newPool;
        }
        return pool;
    }
    async disconnect(origin) {
        const pool = this.pools.get(origin);
        if (pool)
            await pool.disconnectAll();
    }
    async disconnectAll() {
        const pools = [...this.pools.values()];
        await Promise.all(pools.map(pool => pool.disconnectAll()));
    }
}
function sessionToPool(session) {
    return session;
}
class H1Context {
    constructor(options) {
        this.contextPool = new ContextPool(options);
    }
    getSessionForOrigin(origin) {
        return this.contextPool.getOriginPool(origin);
    }
    getFreeSocketForSession(session) {
        const pool = sessionToPool(session);
        return pool.getFreeSocket();
    }
    addUsedSocket(session, socket) {
        const pool = sessionToPool(session);
        return pool.addUsed(socket);
    }
    waitForSocketBySession(session) {
        return sessionToPool(session).waitForSocket();
    }
    connect(url, extraOptions, request) {
        const { origin, protocol, hostname, password, pathname, search, username, } = url;
        const path = pathname + search;
        const port = parseInt((0, utils_1.parseInput)(url.href).port, 10);
        const method = request.method;
        const auth = (username || password)
            ? { auth: `${username}:${password}` }
            : {};
        const options = {
            ...extraOptions,
            agent: false,
            hostname,
            method,
            path,
            port,
            protocol,
            ...auth,
        };
        if (!options.headers)
            options.headers = {};
        options.headers.connection = this.contextPool.keepAlive
            ? "keep-alive"
            : "close";
        return this.contextPool.getOriginPool(origin).connect(options);
    }
    async makeNewConnection(url) {
        return new Promise((resolve, reject) => {
            const { hostname, port } = (0, utils_1.parseInput)(url);
            const socket = (0, net_1.createConnection)(parseInt(port, 10), hostname, () => {
                resolve(socket);
            });
            socket.once("error", reject);
            return socket;
        });
    }
    disconnect(url) {
        const { origin } = new url_1.URL(url);
        this.contextPool.disconnect(origin);
    }
    disconnectAll() {
        this.contextPool.disconnectAll();
    }
}
exports.H1Context = H1Context;
//# sourceMappingURL=context-http1.js.map