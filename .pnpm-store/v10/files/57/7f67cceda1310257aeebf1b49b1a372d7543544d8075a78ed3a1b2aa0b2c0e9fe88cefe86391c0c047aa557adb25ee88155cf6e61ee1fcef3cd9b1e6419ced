"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisSentinelFactory = exports.RedisSentinelClient = void 0;
const node_events_1 = require("node:events");
const client_1 = __importDefault(require("../client"));
const commander_1 = require("../commander");
const commands_1 = __importDefault(require("../commands"));
const utils_1 = require("./utils");
const multi_commands_1 = __importDefault(require("./multi-commands"));
const pub_sub_proxy_1 = require("./pub-sub-proxy");
const promises_1 = require("node:timers/promises");
const module_1 = __importDefault(require("./module"));
const wait_queue_1 = require("./wait-queue");
const cache_1 = require("../client/cache");
class RedisSentinelClient {
    #clientInfo;
    #internal;
    _self;
    /**
     * Indicates if the client connection is open
     *
     * @returns `true` if the client connection is open, `false` otherwise
     */
    get isOpen() {
        return this._self.#internal.isOpen;
    }
    /**
     * Indicates if the client connection is ready to accept commands
     *
     * @returns `true` if the client connection is ready, `false` otherwise
     */
    get isReady() {
        return this._self.#internal.isReady;
    }
    /**
     * Gets the command options configured for this client
     *
     * @returns The command options for this client or `undefined` if none were set
     */
    get commandOptions() {
        return this._self.#commandOptions;
    }
    #commandOptions;
    constructor(internal, clientInfo, commandOptions) {
        this._self = this;
        this.#internal = internal;
        this.#clientInfo = clientInfo;
        this.#commandOptions = commandOptions;
    }
    static factory(config) {
        const SentinelClient = (0, commander_1.attachConfig)({
            BaseClass: RedisSentinelClient,
            commands: commands_1.default,
            createCommand: (utils_1.createCommand),
            createModuleCommand: (utils_1.createModuleCommand),
            createFunctionCommand: (utils_1.createFunctionCommand),
            createScriptCommand: (utils_1.createScriptCommand),
            config
        });
        SentinelClient.prototype.Multi = multi_commands_1.default.extend(config);
        return (internal, clientInfo, commandOptions) => {
            // returning a "proxy" to prevent the namespaces._self to leak between "proxies"
            return Object.create(new SentinelClient(internal, clientInfo, commandOptions));
        };
    }
    static create(options, internal, clientInfo, commandOptions) {
        return RedisSentinelClient.factory(options)(internal, clientInfo, commandOptions);
    }
    withCommandOptions(options) {
        const proxy = Object.create(this);
        proxy._commandOptions = options;
        return proxy;
    }
    _commandOptionsProxy(key, value) {
        const proxy = Object.create(this);
        proxy._commandOptions = Object.create(this._self.#commandOptions ?? null);
        proxy._commandOptions[key] = value;
        return proxy;
    }
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping(typeMapping) {
        return this._commandOptionsProxy('typeMapping', typeMapping);
    }
    async _execute(isReadonly, fn) {
        if (this._self.#clientInfo === undefined) {
            throw new Error("Attempted execution on released RedisSentinelClient lease");
        }
        return await this._self.#internal.execute(fn, this._self.#clientInfo);
    }
    async sendCommand(isReadonly, args, options) {
        return this._execute(isReadonly, client => client.sendCommand(args, options));
    }
    /**
     * @internal
     */
    async _executePipeline(isReadonly, commands) {
        return this._execute(isReadonly, client => client._executePipeline(commands));
    }
    /**f
      * @internal
      */
    async _executeMulti(isReadonly, commands) {
        return this._execute(isReadonly, client => client._executeMulti(commands));
    }
    MULTI() {
        return new this.Multi(this);
    }
    multi = this.MULTI;
    WATCH(key) {
        if (this._self.#clientInfo === undefined) {
            throw new Error("Attempted execution on released RedisSentinelClient lease");
        }
        return this._execute(false, client => client.watch(key));
    }
    watch = this.WATCH;
    UNWATCH() {
        if (this._self.#clientInfo === undefined) {
            throw new Error('Attempted execution on released RedisSentinelClient lease');
        }
        return this._execute(false, client => client.unwatch());
    }
    unwatch = this.UNWATCH;
    /**
     * Releases the client lease back to the pool
     *
     * After calling this method, the client instance should no longer be used as it
     * will be returned to the client pool and may be given to other operations.
     *
     * @returns A promise that resolves when the client is ready to be reused, or undefined
     *          if the client was immediately ready
     * @throws Error if the lease has already been released
     */
    release() {
        if (this._self.#clientInfo === undefined) {
            throw new Error('RedisSentinelClient lease already released');
        }
        const result = this._self.#internal.releaseClientLease(this._self.#clientInfo);
        this._self.#clientInfo = undefined;
        return result;
    }
}
exports.RedisSentinelClient = RedisSentinelClient;
class RedisSentinel extends node_events_1.EventEmitter {
    _self;
    #internal;
    #options;
    /**
     * Indicates if the sentinel connection is open
     *
     * @returns `true` if the sentinel connection is open, `false` otherwise
     */
    get isOpen() {
        return this._self.#internal.isOpen;
    }
    /**
     * Indicates if the sentinel connection is ready to accept commands
     *
     * @returns `true` if the sentinel connection is ready, `false` otherwise
     */
    get isReady() {
        return this._self.#internal.isReady;
    }
    get commandOptions() {
        return this._self.#commandOptions;
    }
    #commandOptions;
    #trace = () => { };
    #reservedClientInfo;
    #masterClientCount = 0;
    #masterClientInfo;
    get clientSideCache() {
        return this._self.#internal.clientSideCache;
    }
    constructor(options) {
        super();
        this._self = this;
        this.#options = options;
        if (options.commandOptions) {
            this.#commandOptions = options.commandOptions;
        }
        this.#internal = new RedisSentinelInternal(options);
        this.#internal.on('error', err => this.emit('error', err));
        /* pass through underling events */
        /* TODO: perhaps make this a struct and one vent, instead of multiple events */
        this.#internal.on('topology-change', (event) => {
            if (!this.emit('topology-change', event)) {
                this._self.#trace(`RedisSentinel: re-emit for topology-change for ${event.type} event returned false`);
            }
        });
    }
    static factory(config) {
        const Sentinel = (0, commander_1.attachConfig)({
            BaseClass: RedisSentinel,
            commands: commands_1.default,
            createCommand: (utils_1.createCommand),
            createModuleCommand: (utils_1.createModuleCommand),
            createFunctionCommand: (utils_1.createFunctionCommand),
            createScriptCommand: (utils_1.createScriptCommand),
            config
        });
        Sentinel.prototype.Multi = multi_commands_1.default.extend(config);
        return (options) => {
            // returning a "proxy" to prevent the namespaces.self to leak between "proxies"
            return Object.create(new Sentinel(options));
        };
    }
    static create(options) {
        return RedisSentinel.factory(options)(options);
    }
    withCommandOptions(options) {
        const proxy = Object.create(this);
        proxy._commandOptions = options;
        return proxy;
    }
    _commandOptionsProxy(key, value) {
        const proxy = Object.create(this);
        // Create new commandOptions object with the inherited properties
        proxy._self.#commandOptions = {
            ...(this._self.#commandOptions || {}),
            [key]: value
        };
        return proxy;
    }
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping(typeMapping) {
        return this._commandOptionsProxy('typeMapping', typeMapping);
    }
    async connect() {
        await this._self.#internal.connect();
        if (this._self.#options.reserveClient) {
            this._self.#reservedClientInfo = await this._self.#internal.getClientLease();
        }
        return this;
    }
    async _execute(isReadonly, fn) {
        let clientInfo;
        if (!isReadonly || !this._self.#internal.useReplicas) {
            if (this._self.#reservedClientInfo) {
                clientInfo = this._self.#reservedClientInfo;
            }
            else {
                this._self.#masterClientInfo ??= await this._self.#internal.getClientLease();
                clientInfo = this._self.#masterClientInfo;
                this._self.#masterClientCount++;
            }
        }
        try {
            return await this._self.#internal.execute(fn, clientInfo);
        }
        finally {
            if (clientInfo !== undefined &&
                clientInfo === this._self.#masterClientInfo &&
                --this._self.#masterClientCount === 0) {
                const promise = this._self.#internal.releaseClientLease(clientInfo);
                this._self.#masterClientInfo = undefined;
                if (promise)
                    await promise;
            }
        }
    }
    async use(fn) {
        const clientInfo = await this._self.#internal.getClientLease();
        try {
            return await fn(RedisSentinelClient.create(this._self.#options, this._self.#internal, clientInfo, this._self.#commandOptions));
        }
        finally {
            const promise = this._self.#internal.releaseClientLease(clientInfo);
            if (promise)
                await promise;
        }
    }
    async sendCommand(isReadonly, args, options) {
        return this._execute(isReadonly, client => client.sendCommand(args, options));
    }
    /**
     * @internal
     */
    async _executePipeline(isReadonly, commands) {
        return this._execute(isReadonly, client => client._executePipeline(commands));
    }
    /**f
      * @internal
      */
    async _executeMulti(isReadonly, commands) {
        return this._execute(isReadonly, client => client._executeMulti(commands));
    }
    MULTI() {
        return new this.Multi(this);
    }
    multi = this.MULTI;
    async close() {
        return this._self.#internal.close();
    }
    destroy() {
        return this._self.#internal.destroy();
    }
    async SUBSCRIBE(channels, listener, bufferMode) {
        return this._self.#internal.subscribe(channels, listener, bufferMode);
    }
    subscribe = this.SUBSCRIBE;
    async UNSUBSCRIBE(channels, listener, bufferMode) {
        return this._self.#internal.unsubscribe(channels, listener, bufferMode);
    }
    unsubscribe = this.UNSUBSCRIBE;
    async PSUBSCRIBE(patterns, listener, bufferMode) {
        return this._self.#internal.pSubscribe(patterns, listener, bufferMode);
    }
    pSubscribe = this.PSUBSCRIBE;
    async PUNSUBSCRIBE(patterns, listener, bufferMode) {
        return this._self.#internal.pUnsubscribe(patterns, listener, bufferMode);
    }
    pUnsubscribe = this.PUNSUBSCRIBE;
    /**
     * Acquires a master client lease for exclusive operations
     *
     * Used when multiple commands need to run on an exclusive client (for example, using `WATCH/MULTI/EXEC`).
     * The returned client must be released after use with the `release()` method.
     *
     * @returns A promise that resolves to a Redis client connected to the master node
     * @example
     * ```javascript
     * const clientLease = await sentinel.acquire();
     *
     * try {
     *   await clientLease.watch('key');
     *   const resp = await clientLease.multi()
     *     .get('key')
     *     .exec();
     * } finally {
     *   clientLease.release();
     * }
     * ```
     */
    async acquire() {
        const clientInfo = await this._self.#internal.getClientLease();
        return RedisSentinelClient.create(this._self.#options, this._self.#internal, clientInfo, this._self.#commandOptions);
    }
    getSentinelNode() {
        return this._self.#internal.getSentinelNode();
    }
    getMasterNode() {
        return this._self.#internal.getMasterNode();
    }
    getReplicaNodes() {
        return this._self.#internal.getReplicaNodes();
    }
    setTracer(tracer) {
        if (tracer) {
            this._self.#trace = (msg) => { tracer.push(msg); };
        }
        else {
            this._self.#trace = () => { };
        }
        this._self.#internal.setTracer(tracer);
    }
}
exports.default = RedisSentinel;
class RedisSentinelInternal extends node_events_1.EventEmitter {
    #isOpen = false;
    get isOpen() {
        return this.#isOpen;
    }
    #isReady = false;
    get isReady() {
        return this.#isReady;
    }
    #name;
    #nodeClientOptions;
    #sentinelClientOptions;
    #scanInterval;
    #passthroughClientErrorEvents;
    #RESP;
    #anotherReset = false;
    #configEpoch = 0;
    #sentinelRootNodes;
    #sentinelClient;
    #masterClients = [];
    #masterClientQueue;
    #masterPoolSize;
    #replicaClients = [];
    #replicaClientsIdx = 0;
    #replicaPoolSize;
    get useReplicas() {
        return this.#replicaPoolSize > 0;
    }
    #connectPromise;
    #maxCommandRediscovers;
    #pubSubProxy;
    #scanTimer;
    #destroy = false;
    #trace = () => { };
    #clientSideCache;
    get clientSideCache() {
        return this.#clientSideCache;
    }
    #validateOptions(options) {
        if (options?.clientSideCache && options?.RESP !== 3) {
            throw new Error('Client Side Caching is only supported with RESP3');
        }
    }
    constructor(options) {
        super();
        this.#validateOptions(options);
        this.#name = options.name;
        this.#RESP = options.RESP;
        this.#sentinelRootNodes = Array.from(options.sentinelRootNodes);
        this.#maxCommandRediscovers = options.maxCommandRediscovers ?? 16;
        this.#masterPoolSize = options.masterPoolSize ?? 1;
        this.#replicaPoolSize = options.replicaPoolSize ?? 0;
        this.#scanInterval = options.scanInterval ?? 0;
        this.#passthroughClientErrorEvents = options.passthroughClientErrorEvents ?? false;
        this.#nodeClientOptions = (options.nodeClientOptions ? { ...options.nodeClientOptions } : {});
        if (this.#nodeClientOptions.url !== undefined) {
            throw new Error("invalid nodeClientOptions for Sentinel");
        }
        if (options.clientSideCache) {
            if (options.clientSideCache instanceof cache_1.PooledClientSideCacheProvider) {
                this.#clientSideCache = this.#nodeClientOptions.clientSideCache = options.clientSideCache;
            }
            else {
                const cscConfig = options.clientSideCache;
                this.#clientSideCache = this.#nodeClientOptions.clientSideCache = new cache_1.BasicPooledClientSideCache(cscConfig);
                //        this.#clientSideCache = this.#nodeClientOptions.clientSideCache = new PooledNoRedirectClientSideCache(cscConfig);
            }
        }
        this.#sentinelClientOptions = options.sentinelClientOptions ? Object.assign({}, options.sentinelClientOptions) : {};
        this.#sentinelClientOptions.modules = module_1.default;
        if (this.#sentinelClientOptions.url !== undefined) {
            throw new Error("invalid sentinelClientOptions for Sentinel");
        }
        this.#masterClientQueue = new wait_queue_1.WaitQueue();
        for (let i = 0; i < this.#masterPoolSize; i++) {
            this.#masterClientQueue.push(i);
        }
        /* persistent object for life of sentinel object */
        this.#pubSubProxy = new pub_sub_proxy_1.PubSubProxy(this.#nodeClientOptions, err => this.emit('error', err));
    }
    #createClient(node, clientOptions, reconnectStrategy) {
        return client_1.default.create({
            //first take the globally set RESP
            RESP: this.#RESP,
            //then take the client options, which can in theory overwrite it
            ...clientOptions,
            socket: {
                ...clientOptions.socket,
                host: node.host,
                port: node.port,
                ...(reconnectStrategy !== undefined && { reconnectStrategy })
            }
        });
    }
    /**
     * Gets a client lease from the master client pool
     *
     * @returns A client info object or a promise that resolves to a client info object
     *          when a client becomes available
     */
    getClientLease() {
        const id = this.#masterClientQueue.shift();
        if (id !== undefined) {
            return { id };
        }
        return this.#masterClientQueue.wait().then(id => ({ id }));
    }
    /**
     * Releases a client lease back to the pool
     *
     * If the client was used for a transaction that might have left it in a dirty state,
     * it will be reset before being returned to the pool.
     *
     * @param clientInfo The client info object representing the client to release
     * @returns A promise that resolves when the client is ready to be reused, or undefined
     *          if the client was immediately ready or no longer exists
     */
    releaseClientLease(clientInfo) {
        const client = this.#masterClients[clientInfo.id];
        // client can be undefined if releasing in middle of a reconfigure
        if (client !== undefined) {
            const dirtyPromise = client.resetIfDirty();
            if (dirtyPromise) {
                return dirtyPromise
                    .then(() => this.#masterClientQueue.push(clientInfo.id));
            }
        }
        this.#masterClientQueue.push(clientInfo.id);
    }
    async connect() {
        if (this.#isOpen) {
            throw new Error("already attempting to open");
        }
        try {
            this.#isOpen = true;
            this.#connectPromise = this.#connect();
            await this.#connectPromise;
            this.#isReady = true;
        }
        finally {
            this.#connectPromise = undefined;
            if (this.#scanInterval > 0) {
                this.#scanTimer = setInterval(this.#reset.bind(this), this.#scanInterval);
            }
        }
    }
    async #connect() {
        let count = 0;
        while (true) {
            this.#trace("starting connect loop");
            count += 1;
            if (this.#destroy) {
                this.#trace("in #connect and want to destroy");
                return;
            }
            try {
                this.#anotherReset = false;
                await this.transform(this.analyze(await this.observe()));
                if (this.#anotherReset) {
                    this.#trace("#connect: anotherReset is true, so continuing");
                    continue;
                }
                this.#trace("#connect: returning");
                return;
            }
            catch (e) {
                this.#trace(`#connect: exception ${e.message}`);
                if (!this.#isReady && count > this.#maxCommandRediscovers) {
                    throw e;
                }
                if (e.message !== 'no valid master node') {
                    console.log(e);
                }
                await (0, promises_1.setTimeout)(1000);
            }
            finally {
                this.#trace("finished connect");
            }
        }
    }
    async execute(fn, clientInfo) {
        let iter = 0;
        while (true) {
            if (this.#connectPromise !== undefined) {
                await this.#connectPromise;
            }
            const client = this.#getClient(clientInfo);
            if (!client.isReady) {
                await this.#reset();
                continue;
            }
            const sockOpts = client.options?.socket;
            this.#trace("attemping to send command to " + sockOpts?.host + ":" + sockOpts?.port);
            try {
                /*
                        // force testing of READONLY errors
                        if (clientInfo !== undefined) {
                          if (Math.floor(Math.random() * 10) < 1) {
                            console.log("throwing READONLY error");
                            throw new Error("READONLY You can't write against a read only replica.");
                          }
                        }
                */
                return await fn(client);
            }
            catch (err) {
                if (++iter > this.#maxCommandRediscovers || !(err instanceof Error)) {
                    throw err;
                }
                /*
                  rediscover and retry if doing a command against a "master"
                  a) READONLY error (topology has changed) but we haven't been notified yet via pubsub
                  b) client is "not ready" (disconnected), which means topology might have changed, but sentinel might not see it yet
                */
                if (clientInfo !== undefined && (err.message.startsWith('READONLY') || !client.isReady)) {
                    await this.#reset();
                    continue;
                }
                throw err;
            }
        }
    }
    async #createPubSub(client) {
        /* Whenever sentinels or slaves get added, or when slave configuration changes, reconfigure */
        await client.pSubscribe(['switch-master', '[-+]sdown', '+slave', '+sentinel', '[-+]odown', '+slave-reconf-done'], (message, channel) => {
            this.#handlePubSubControlChannel(channel, message);
        }, true);
        return client;
    }
    async #handlePubSubControlChannel(channel, message) {
        this.#trace("pubsub control channel message on " + channel);
        this.#reset();
    }
    // if clientInfo is defined, it corresponds to a master client in the #masterClients array, otherwise loop around replicaClients
    #getClient(clientInfo) {
        if (clientInfo !== undefined) {
            return this.#masterClients[clientInfo.id];
        }
        if (this.#replicaClientsIdx >= this.#replicaClients.length) {
            this.#replicaClientsIdx = 0;
        }
        if (this.#replicaClients.length == 0) {
            throw new Error("no replicas available for read");
        }
        return this.#replicaClients[this.#replicaClientsIdx++];
    }
    async #reset() {
        /* closing / don't reset */
        if (this.#isReady == false || this.#destroy == true) {
            return;
        }
        // already in #connect()
        if (this.#connectPromise !== undefined) {
            this.#anotherReset = true;
            return await this.#connectPromise;
        }
        try {
            this.#connectPromise = this.#connect();
            return await this.#connectPromise;
        }
        finally {
            this.#trace("finished reconfgure");
            this.#connectPromise = undefined;
        }
    }
    async close() {
        this.#destroy = true;
        if (this.#connectPromise != undefined) {
            await this.#connectPromise;
        }
        this.#isReady = false;
        this.#clientSideCache?.onPoolClose();
        if (this.#scanTimer) {
            clearInterval(this.#scanTimer);
            this.#scanTimer = undefined;
        }
        const promises = [];
        if (this.#sentinelClient !== undefined) {
            if (this.#sentinelClient.isOpen) {
                promises.push(this.#sentinelClient.close());
            }
            this.#sentinelClient = undefined;
        }
        for (const client of this.#masterClients) {
            if (client.isOpen) {
                promises.push(client.close());
            }
        }
        this.#masterClients = [];
        for (const client of this.#replicaClients) {
            if (client.isOpen) {
                promises.push(client.close());
            }
        }
        this.#replicaClients = [];
        await Promise.all(promises);
        this.#pubSubProxy.destroy();
        this.#isOpen = false;
    }
    // destroy has to be async because its stopping others async events, timers and the like
    // and shouldn't return until its finished.
    async destroy() {
        this.#destroy = true;
        if (this.#connectPromise != undefined) {
            await this.#connectPromise;
        }
        this.#isReady = false;
        this.#clientSideCache?.onPoolClose();
        if (this.#scanTimer) {
            clearInterval(this.#scanTimer);
            this.#scanTimer = undefined;
        }
        if (this.#sentinelClient !== undefined) {
            if (this.#sentinelClient.isOpen) {
                this.#sentinelClient.destroy();
            }
            this.#sentinelClient = undefined;
        }
        for (const client of this.#masterClients) {
            if (client.isOpen) {
                client.destroy();
            }
        }
        this.#masterClients = [];
        for (const client of this.#replicaClients) {
            if (client.isOpen) {
                client.destroy();
            }
        }
        this.#replicaClients = [];
        this.#pubSubProxy.destroy();
        this.#isOpen = false;
        this.#destroy = false;
    }
    async subscribe(channels, listener, bufferMode) {
        return this.#pubSubProxy.subscribe(channels, listener, bufferMode);
    }
    async unsubscribe(channels, listener, bufferMode) {
        return this.#pubSubProxy.unsubscribe(channels, listener, bufferMode);
    }
    async pSubscribe(patterns, listener, bufferMode) {
        return this.#pubSubProxy.pSubscribe(patterns, listener, bufferMode);
    }
    async pUnsubscribe(patterns, listener, bufferMode) {
        return this.#pubSubProxy.pUnsubscribe(patterns, listener, bufferMode);
    }
    // observe/analyze/transform remediation functions
    async observe() {
        for (const node of this.#sentinelRootNodes) {
            let client;
            try {
                this.#trace(`observe: trying to connect to sentinel: ${node.host}:${node.port}`);
                client = this.#createClient(node, this.#sentinelClientOptions, false);
                client.on('error', (err) => this.emit('error', `obseve client error: ${err}`));
                await client.connect();
                this.#trace(`observe: connected to sentinel`);
                const [sentinelData, masterData, replicaData] = await Promise.all([
                    client.sentinel.sentinelSentinels(this.#name),
                    client.sentinel.sentinelMaster(this.#name),
                    client.sentinel.sentinelReplicas(this.#name)
                ]);
                this.#trace("observe: got all sentinel data");
                const ret = {
                    sentinelConnected: node,
                    sentinelData: sentinelData,
                    masterData: masterData,
                    replicaData: replicaData,
                    currentMaster: this.getMasterNode(),
                    currentReplicas: this.getReplicaNodes(),
                    currentSentinel: this.getSentinelNode(),
                    replicaPoolSize: this.#replicaPoolSize,
                    useReplicas: this.useReplicas
                };
                return ret;
            }
            catch (err) {
                this.#trace(`observe: error ${err}`);
                this.emit('error', err);
            }
            finally {
                if (client !== undefined && client.isOpen) {
                    this.#trace(`observe: destroying sentinel client`);
                    client.destroy();
                }
            }
        }
        this.#trace(`observe: none of the sentinels are available`);
        throw new Error('None of the sentinels are available');
    }
    analyze(observed) {
        let master = (0, utils_1.parseNode)(observed.masterData);
        if (master === undefined) {
            this.#trace(`analyze: no valid master node because ${observed.masterData.flags}`);
            throw new Error("no valid master node");
        }
        if (master.host === observed.currentMaster?.host && master.port === observed.currentMaster?.port) {
            this.#trace(`analyze: master node hasn't changed from ${observed.currentMaster?.host}:${observed.currentMaster?.port}`);
            master = undefined;
        }
        else {
            this.#trace(`analyze: master node has changed to ${master.host}:${master.port} from ${observed.currentMaster?.host}:${observed.currentMaster?.port}`);
        }
        let sentinel = observed.sentinelConnected;
        if (sentinel.host === observed.currentSentinel?.host && sentinel.port === observed.currentSentinel.port) {
            this.#trace(`analyze: sentinel node hasn't changed`);
            sentinel = undefined;
        }
        else {
            this.#trace(`analyze: sentinel node has changed to ${sentinel.host}:${sentinel.port}`);
        }
        const replicasToClose = [];
        const replicasToOpen = new Map();
        const desiredSet = new Set();
        const seen = new Set();
        if (observed.useReplicas) {
            const replicaList = (0, utils_1.createNodeList)(observed.replicaData);
            for (const node of replicaList) {
                desiredSet.add(JSON.stringify(node));
            }
            for (const [node, value] of observed.currentReplicas) {
                if (!desiredSet.has(JSON.stringify(node))) {
                    replicasToClose.push(node);
                    this.#trace(`analyze: adding ${node.host}:${node.port} to replicsToClose`);
                }
                else {
                    seen.add(JSON.stringify(node));
                    if (value != observed.replicaPoolSize) {
                        replicasToOpen.set(node, observed.replicaPoolSize - value);
                        this.#trace(`analyze: adding ${node.host}:${node.port} to replicsToOpen`);
                    }
                }
            }
            for (const node of replicaList) {
                if (!seen.has(JSON.stringify(node))) {
                    replicasToOpen.set(node, observed.replicaPoolSize);
                    this.#trace(`analyze: adding ${node.host}:${node.port} to replicsToOpen`);
                }
            }
        }
        const ret = {
            sentinelList: [observed.sentinelConnected].concat((0, utils_1.createNodeList)(observed.sentinelData)),
            epoch: Number(observed.masterData['config-epoch']),
            sentinelToOpen: sentinel,
            masterToOpen: master,
            replicasToClose: replicasToClose,
            replicasToOpen: replicasToOpen,
        };
        return ret;
    }
    async transform(analyzed) {
        this.#trace("transform: enter");
        let promises = [];
        if (analyzed.sentinelToOpen) {
            this.#trace(`transform: opening a new sentinel`);
            if (this.#sentinelClient !== undefined && this.#sentinelClient.isOpen) {
                this.#trace(`transform: destroying old sentinel as open`);
                this.#sentinelClient.destroy();
                this.#sentinelClient = undefined;
            }
            else {
                this.#trace(`transform: not destroying old sentinel as not open`);
            }
            this.#trace(`transform: creating new sentinel to ${analyzed.sentinelToOpen.host}:${analyzed.sentinelToOpen.port}`);
            const node = analyzed.sentinelToOpen;
            const client = this.#createClient(analyzed.sentinelToOpen, this.#sentinelClientOptions, false);
            client.on('error', (err) => {
                if (this.#passthroughClientErrorEvents) {
                    this.emit('error', new Error(`Sentinel Client (${node.host}:${node.port}): ${err.message}`, { cause: err }));
                }
                const event = {
                    type: 'SENTINEL',
                    node: (0, utils_1.clientSocketToNode)(client.options.socket),
                    error: err
                };
                this.emit('client-error', event);
                this.#reset();
            });
            this.#sentinelClient = client;
            this.#trace(`transform: adding sentinel client connect() to promise list`);
            const promise = this.#sentinelClient.connect().then((client) => { return this.#createPubSub(client); });
            promises.push(promise);
            this.#trace(`created sentinel client to ${analyzed.sentinelToOpen.host}:${analyzed.sentinelToOpen.port}`);
            const event = {
                type: "SENTINEL_CHANGE",
                node: analyzed.sentinelToOpen
            };
            this.#trace(`transform: emiting topology-change event for sentinel_change`);
            if (!this.emit('topology-change', event)) {
                this.#trace(`transform: emit for topology-change for sentinel_change returned false`);
            }
        }
        if (analyzed.masterToOpen) {
            this.#trace(`transform: opening a new master`);
            const masterPromises = [];
            const masterWatches = [];
            this.#trace(`transform: destroying old masters if open`);
            for (const client of this.#masterClients) {
                masterWatches.push(client.isWatching || client.isDirtyWatch);
                if (client.isOpen) {
                    client.destroy();
                }
            }
            this.#masterClients = [];
            this.#trace(`transform: creating all master clients and adding connect promises`);
            for (let i = 0; i < this.#masterPoolSize; i++) {
                const node = analyzed.masterToOpen;
                const client = this.#createClient(analyzed.masterToOpen, this.#nodeClientOptions);
                client.on('error', (err) => {
                    if (this.#passthroughClientErrorEvents) {
                        this.emit('error', new Error(`Master Client (${node.host}:${node.port}): ${err.message}`, { cause: err }));
                    }
                    const event = {
                        type: "MASTER",
                        node: (0, utils_1.clientSocketToNode)(client.options.socket),
                        error: err
                    };
                    this.emit('client-error', event);
                });
                if (masterWatches[i]) {
                    client.setDirtyWatch("sentinel config changed in middle of a WATCH Transaction");
                }
                this.#masterClients.push(client);
                masterPromises.push(client.connect());
                this.#trace(`created master client to ${analyzed.masterToOpen.host}:${analyzed.masterToOpen.port}`);
            }
            this.#trace(`transform: adding promise to change #pubSubProxy node`);
            masterPromises.push(this.#pubSubProxy.changeNode(analyzed.masterToOpen));
            promises.push(...masterPromises);
            const event = {
                type: "MASTER_CHANGE",
                node: analyzed.masterToOpen
            };
            this.#trace(`transform: emiting topology-change event for master_change`);
            if (!this.emit('topology-change', event)) {
                this.#trace(`transform: emit for topology-change for master_change returned false`);
            }
            this.#configEpoch++;
        }
        const replicaCloseSet = new Set();
        for (const node of analyzed.replicasToClose) {
            const str = JSON.stringify(node);
            replicaCloseSet.add(str);
        }
        const newClientList = [];
        const removedSet = new Set();
        for (const replica of this.#replicaClients) {
            const node = (0, utils_1.clientSocketToNode)(replica.options.socket);
            const str = JSON.stringify(node);
            if (replicaCloseSet.has(str) || !replica.isOpen) {
                if (replica.isOpen) {
                    const sockOpts = replica.options?.socket;
                    this.#trace(`destroying replica client to ${sockOpts?.host}:${sockOpts?.port}`);
                    replica.destroy();
                }
                if (!removedSet.has(str)) {
                    const event = {
                        type: "REPLICA_REMOVE",
                        node: node
                    };
                    this.emit('topology-change', event);
                    removedSet.add(str);
                }
            }
            else {
                newClientList.push(replica);
            }
        }
        this.#replicaClients = newClientList;
        if (analyzed.replicasToOpen.size != 0) {
            for (const [node, size] of analyzed.replicasToOpen) {
                for (let i = 0; i < size; i++) {
                    const client = this.#createClient(node, this.#nodeClientOptions);
                    client.on('error', (err) => {
                        if (this.#passthroughClientErrorEvents) {
                            this.emit('error', new Error(`Replica Client (${node.host}:${node.port}): ${err.message}`, { cause: err }));
                        }
                        const event = {
                            type: "REPLICA",
                            node: (0, utils_1.clientSocketToNode)(client.options.socket),
                            error: err
                        };
                        this.emit('client-error', event);
                    });
                    this.#replicaClients.push(client);
                    promises.push(client.connect());
                    this.#trace(`created replica client to ${node.host}:${node.port}`);
                }
                const event = {
                    type: "REPLICA_ADD",
                    node: node
                };
                this.emit('topology-change', event);
            }
        }
        if (analyzed.sentinelList.length != this.#sentinelRootNodes.length) {
            this.#sentinelRootNodes = analyzed.sentinelList;
            const event = {
                type: "SENTINE_LIST_CHANGE",
                size: analyzed.sentinelList.length
            };
            this.emit('topology-change', event);
        }
        await Promise.all(promises);
        this.#trace("transform: exit");
    }
    // introspection functions
    getMasterNode() {
        if (this.#masterClients.length == 0) {
            return undefined;
        }
        for (const master of this.#masterClients) {
            if (master.isReady) {
                return (0, utils_1.clientSocketToNode)(master.options.socket);
            }
        }
        return undefined;
    }
    getSentinelNode() {
        if (this.#sentinelClient === undefined) {
            return undefined;
        }
        return (0, utils_1.clientSocketToNode)(this.#sentinelClient.options.socket);
    }
    getReplicaNodes() {
        const ret = new Map();
        const initialMap = new Map();
        for (const replica of this.#replicaClients) {
            const node = (0, utils_1.clientSocketToNode)(replica.options.socket);
            const hash = JSON.stringify(node);
            if (replica.isReady) {
                initialMap.set(hash, (initialMap.get(hash) ?? 0) + 1);
            }
            else {
                if (!initialMap.has(hash)) {
                    initialMap.set(hash, 0);
                }
            }
        }
        for (const [key, value] of initialMap) {
            ret.set(JSON.parse(key), value);
        }
        return ret;
    }
    setTracer(tracer) {
        if (tracer) {
            this.#trace = (msg) => { tracer.push(msg); };
        }
        else {
            // empty function is faster than testing if something is defined or not
            this.#trace = () => { };
        }
    }
}
class RedisSentinelFactory extends node_events_1.EventEmitter {
    options;
    #sentinelRootNodes;
    #replicaIdx = -1;
    constructor(options) {
        super();
        this.options = options;
        this.#sentinelRootNodes = options.sentinelRootNodes;
    }
    async updateSentinelRootNodes() {
        for (const node of this.#sentinelRootNodes) {
            const client = client_1.default.create({
                ...this.options.sentinelClientOptions,
                socket: {
                    ...this.options.sentinelClientOptions?.socket,
                    host: node.host,
                    port: node.port,
                    reconnectStrategy: false
                },
                modules: module_1.default
            }).on('error', (err) => this.emit(`updateSentinelRootNodes: ${err}`));
            try {
                await client.connect();
            }
            catch {
                if (client.isOpen) {
                    client.destroy();
                }
                continue;
            }
            try {
                const sentinelData = await client.sentinel.sentinelSentinels(this.options.name);
                this.#sentinelRootNodes = [node].concat((0, utils_1.createNodeList)(sentinelData));
                return;
            }
            finally {
                client.destroy();
            }
        }
        throw new Error("Couldn't connect to any sentinel node");
    }
    async getMasterNode() {
        let connected = false;
        for (const node of this.#sentinelRootNodes) {
            const client = client_1.default.create({
                ...this.options.sentinelClientOptions,
                socket: {
                    ...this.options.sentinelClientOptions?.socket,
                    host: node.host,
                    port: node.port,
                    reconnectStrategy: false
                },
                modules: module_1.default
            }).on('error', err => this.emit(`getMasterNode: ${err}`));
            try {
                await client.connect();
            }
            catch {
                if (client.isOpen) {
                    client.destroy();
                }
                continue;
            }
            connected = true;
            try {
                const masterData = await client.sentinel.sentinelMaster(this.options.name);
                let master = (0, utils_1.parseNode)(masterData);
                if (master === undefined) {
                    continue;
                }
                return master;
            }
            finally {
                client.destroy();
            }
        }
        if (connected) {
            throw new Error("Master Node Not Enumerated");
        }
        throw new Error("couldn't connect to any sentinels");
    }
    async getMasterClient() {
        const master = await this.getMasterNode();
        return client_1.default.create({
            ...this.options.nodeClientOptions,
            socket: {
                ...this.options.nodeClientOptions?.socket,
                host: master.host,
                port: master.port
            }
        });
    }
    async getReplicaNodes() {
        let connected = false;
        for (const node of this.#sentinelRootNodes) {
            const client = client_1.default.create({
                ...this.options.sentinelClientOptions,
                socket: {
                    ...this.options.sentinelClientOptions?.socket,
                    host: node.host,
                    port: node.port,
                    reconnectStrategy: false
                },
                modules: module_1.default
            }).on('error', err => this.emit(`getReplicaNodes: ${err}`));
            try {
                await client.connect();
            }
            catch {
                if (client.isOpen) {
                    client.destroy();
                }
                continue;
            }
            connected = true;
            try {
                const replicaData = await client.sentinel.sentinelReplicas(this.options.name);
                const replicas = (0, utils_1.createNodeList)(replicaData);
                if (replicas.length == 0) {
                    continue;
                }
                return replicas;
            }
            finally {
                client.destroy();
            }
        }
        if (connected) {
            throw new Error("No Replicas Nodes Enumerated");
        }
        throw new Error("couldn't connect to any sentinels");
    }
    async getReplicaClient() {
        const replicas = await this.getReplicaNodes();
        if (replicas.length == 0) {
            throw new Error("no available replicas");
        }
        this.#replicaIdx++;
        if (this.#replicaIdx >= replicas.length) {
            this.#replicaIdx = 0;
        }
        return client_1.default.create({
            ...this.options.nodeClientOptions,
            socket: {
                ...this.options.nodeClientOptions?.socket,
                host: replicas[this.#replicaIdx].host,
                port: replicas[this.#replicaIdx].port
            }
        });
    }
}
exports.RedisSentinelFactory = RedisSentinelFactory;
//# sourceMappingURL=index.js.map