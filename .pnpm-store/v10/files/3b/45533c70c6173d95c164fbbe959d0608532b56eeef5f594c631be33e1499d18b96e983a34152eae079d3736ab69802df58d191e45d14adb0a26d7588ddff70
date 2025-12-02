"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const commands_1 = __importDefault(require("../commands"));
const socket_1 = __importDefault(require("./socket"));
const authx_1 = require("../authx");
const commands_queue_1 = __importDefault(require("./commands-queue"));
const node_events_1 = require("node:events");
const commander_1 = require("../commander");
const errors_1 = require("../errors");
const node_url_1 = require("node:url");
const pub_sub_1 = require("./pub-sub");
const multi_command_1 = __importDefault(require("./multi-command"));
const HELLO_1 = __importDefault(require("../commands/HELLO"));
const legacy_mode_1 = require("./legacy-mode");
const pool_1 = require("./pool");
const generic_transformers_1 = require("../commands/generic-transformers");
const cache_1 = require("./cache");
const parser_1 = require("./parser");
const single_entry_cache_1 = __importDefault(require("../single-entry-cache"));
const package_json_1 = require("../../package.json");
class RedisClient extends node_events_1.EventEmitter {
    static #createCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            return this._self._executeCommand(command, parser, this._commandOptions, transformReply);
        };
    }
    static #createModuleCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            return this._self._executeCommand(command, parser, this._self._commandOptions, transformReply);
        };
    }
    static #createFunctionCommand(name, fn, resp) {
        const prefix = (0, commander_1.functionArgumentsPrefix)(name, fn);
        const transformReply = (0, commander_1.getTransformReply)(fn, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.push(...prefix);
            fn.parseCommand(parser, ...args);
            return this._self._executeCommand(fn, parser, this._self._commandOptions, transformReply);
        };
    }
    static #createScriptCommand(script, resp) {
        const prefix = (0, commander_1.scriptArgumentsPrefix)(script);
        const transformReply = (0, commander_1.getTransformReply)(script, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.push(...prefix);
            script.parseCommand(parser, ...args);
            return this._executeScript(script, parser, this._commandOptions, transformReply);
        };
    }
    static #SingleEntryCache = new single_entry_cache_1.default();
    static factory(config) {
        let Client = _a.#SingleEntryCache.get(config);
        if (!Client) {
            Client = (0, commander_1.attachConfig)({
                BaseClass: _a,
                commands: commands_1.default,
                createCommand: _a.#createCommand,
                createModuleCommand: _a.#createModuleCommand,
                createFunctionCommand: _a.#createFunctionCommand,
                createScriptCommand: _a.#createScriptCommand,
                config
            });
            Client.prototype.Multi = multi_command_1.default.extend(config);
            _a.#SingleEntryCache.set(config, Client);
        }
        return (options) => {
            // returning a "proxy" to prevent the namespaces._self to leak between "proxies"
            return Object.create(new Client(options));
        };
    }
    static create(options) {
        return _a.factory(options)(options);
    }
    static parseOptions(options) {
        if (options?.url) {
            const parsed = _a.parseURL(options.url);
            if (options.socket) {
                if (options.socket.tls !== undefined && options.socket.tls !== parsed.socket.tls) {
                    throw new TypeError(`tls socket option is set to ${options.socket.tls} which is mismatch with protocol or the URL ${options.url} passed`);
                }
                parsed.socket = Object.assign(options.socket, parsed.socket);
            }
            Object.assign(options, parsed);
        }
        return options;
    }
    static parseURL(url) {
        // https://www.iana.org/assignments/uri-schemes/prov/redis
        const { hostname, port, protocol, username, password, pathname } = new node_url_1.URL(url), parsed = {
            socket: {
                host: hostname,
                tls: false
            }
        };
        if (protocol !== 'redis:' && protocol !== 'rediss:') {
            throw new TypeError('Invalid protocol');
        }
        parsed.socket.tls = protocol === 'rediss:';
        if (port) {
            parsed.socket.port = Number(port);
        }
        if (username) {
            parsed.username = decodeURIComponent(username);
        }
        if (password) {
            parsed.password = decodeURIComponent(password);
        }
        if (username || password) {
            parsed.credentialsProvider = {
                type: 'async-credentials-provider',
                credentials: async () => ({
                    username: username ? decodeURIComponent(username) : undefined,
                    password: password ? decodeURIComponent(password) : undefined
                })
            };
        }
        if (pathname.length > 1) {
            const database = Number(pathname.substring(1));
            if (isNaN(database)) {
                throw new TypeError('Invalid pathname');
            }
            parsed.database = database;
        }
        return parsed;
    }
    #options;
    #socket;
    #queue;
    #selectedDB = 0;
    #monitorCallback;
    _self = this;
    _commandOptions;
    // flag used to annotate that the client
    // was in a watch transaction when
    // a topology change occured
    #dirtyWatch;
    #watchEpoch;
    #clientSideCache;
    #credentialsSubscription = null;
    get clientSideCache() {
        return this._self.#clientSideCache;
    }
    get options() {
        return this._self.#options;
    }
    get isOpen() {
        return this._self.#socket.isOpen;
    }
    get isReady() {
        return this._self.#socket.isReady;
    }
    get isPubSubActive() {
        return this._self.#queue.isPubSubActive;
    }
    get socketEpoch() {
        return this._self.#socket.socketEpoch;
    }
    get isWatching() {
        return this._self.#watchEpoch !== undefined;
    }
    /**
     * Indicates whether the client's WATCH command has been invalidated by a topology change.
     * When this returns true, any transaction using WATCH will fail with a WatchError.
     * @returns true if the watched keys have been modified, false otherwise
     */
    get isDirtyWatch() {
        return this._self.#dirtyWatch !== undefined;
    }
    /**
     * Marks the client's WATCH command as invalidated due to a topology change.
     * This will cause any subsequent EXEC in a transaction to fail with a WatchError.
     * @param msg - The error message explaining why the WATCH is dirty
     */
    setDirtyWatch(msg) {
        this._self.#dirtyWatch = msg;
    }
    constructor(options) {
        super();
        this.#validateOptions(options);
        this.#options = this.#initiateOptions(options);
        this.#queue = this.#initiateQueue();
        this.#socket = this.#initiateSocket();
        if (options?.clientSideCache) {
            if (options.clientSideCache instanceof cache_1.ClientSideCacheProvider) {
                this.#clientSideCache = options.clientSideCache;
            }
            else {
                const cscConfig = options.clientSideCache;
                this.#clientSideCache = new cache_1.BasicClientSideCache(cscConfig);
            }
            this.#queue.setInvalidateCallback(this.#clientSideCache.invalidate.bind(this.#clientSideCache));
        }
    }
    #validateOptions(options) {
        if (options?.clientSideCache && options?.RESP !== 3) {
            throw new Error('Client Side Caching is only supported with RESP3');
        }
    }
    #initiateOptions(options) {
        // Convert username/password to credentialsProvider if no credentialsProvider is already in place
        if (!options?.credentialsProvider && (options?.username || options?.password)) {
            options.credentialsProvider = {
                type: 'async-credentials-provider',
                credentials: async () => ({
                    username: options.username,
                    password: options.password
                })
            };
        }
        if (options?.database) {
            this._self.#selectedDB = options.database;
        }
        if (options?.commandOptions) {
            this._commandOptions = options.commandOptions;
        }
        if (options?.url) {
            const parsedOptions = _a.parseOptions(options);
            if (parsedOptions?.database) {
                this._self.#selectedDB = parsedOptions.database;
            }
            return parsedOptions;
        }
        return options;
    }
    #initiateQueue() {
        return new commands_queue_1.default(this.#options?.RESP ?? 2, this.#options?.commandsQueueMaxLength, (channel, listeners) => this.emit('sharded-channel-moved', channel, listeners));
    }
    /**
     * @param credentials
     */
    reAuthenticate = async (credentials) => {
        // Re-authentication is not supported on RESP2 with PubSub active
        if (!(this.isPubSubActive && !this.#options?.RESP)) {
            await this.sendCommand((0, generic_transformers_1.parseArgs)(commands_1.default.AUTH, {
                username: credentials.username,
                password: credentials.password ?? ''
            }));
        }
    };
    #subscribeForStreamingCredentials(cp) {
        return cp.subscribe({
            onNext: credentials => {
                this.reAuthenticate(credentials).catch(error => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    cp.onReAuthenticationError(new authx_1.CredentialsError(errorMessage));
                });
            },
            onError: (e) => {
                const errorMessage = `Error from streaming credentials provider: ${e.message}`;
                cp.onReAuthenticationError(new authx_1.UnableToObtainNewCredentialsError(errorMessage));
            }
        });
    }
    async #handshake(chainId, asap) {
        const promises = [];
        const commandsWithErrorHandlers = await this.#getHandshakeCommands();
        if (asap)
            commandsWithErrorHandlers.reverse();
        for (const { cmd, errorHandler } of commandsWithErrorHandlers) {
            promises.push(this.#queue
                .addCommand(cmd, {
                chainId,
                asap
            })
                .catch(errorHandler));
        }
        return promises;
    }
    async #getHandshakeCommands() {
        const commands = [];
        const cp = this.#options?.credentialsProvider;
        if (this.#options?.RESP) {
            const hello = {};
            if (cp && cp.type === 'async-credentials-provider') {
                const credentials = await cp.credentials();
                if (credentials.password) {
                    hello.AUTH = {
                        username: credentials.username ?? 'default',
                        password: credentials.password
                    };
                }
            }
            if (cp && cp.type === 'streaming-credentials-provider') {
                const [credentials, disposable] = await this.#subscribeForStreamingCredentials(cp);
                this.#credentialsSubscription = disposable;
                if (credentials.password) {
                    hello.AUTH = {
                        username: credentials.username ?? 'default',
                        password: credentials.password
                    };
                }
            }
            if (this.#options.name) {
                hello.SETNAME = this.#options.name;
            }
            commands.push({ cmd: (0, generic_transformers_1.parseArgs)(HELLO_1.default, this.#options.RESP, hello) });
        }
        else {
            if (cp && cp.type === 'async-credentials-provider') {
                const credentials = await cp.credentials();
                if (credentials.username || credentials.password) {
                    commands.push({
                        cmd: (0, generic_transformers_1.parseArgs)(commands_1.default.AUTH, {
                            username: credentials.username,
                            password: credentials.password ?? ''
                        })
                    });
                }
            }
            if (cp && cp.type === 'streaming-credentials-provider') {
                const [credentials, disposable] = await this.#subscribeForStreamingCredentials(cp);
                this.#credentialsSubscription = disposable;
                if (credentials.username || credentials.password) {
                    commands.push({
                        cmd: (0, generic_transformers_1.parseArgs)(commands_1.default.AUTH, {
                            username: credentials.username,
                            password: credentials.password ?? ''
                        })
                    });
                }
            }
            if (this.#options?.name) {
                commands.push({
                    cmd: (0, generic_transformers_1.parseArgs)(commands_1.default.CLIENT_SETNAME, this.#options.name)
                });
            }
        }
        if (this.#selectedDB !== 0) {
            commands.push({ cmd: ['SELECT', this.#selectedDB.toString()] });
        }
        if (this.#options?.readonly) {
            commands.push({ cmd: (0, generic_transformers_1.parseArgs)(commands_1.default.READONLY) });
        }
        if (!this.#options?.disableClientInfo) {
            commands.push({
                cmd: ['CLIENT', 'SETINFO', 'LIB-VER', package_json_1.version],
                errorHandler: () => {
                    // Client libraries are expected to pipeline this command
                    // after authentication on all connections and ignore failures
                    // since they could be connected to an older version that doesn't support them.
                }
            });
            commands.push({
                cmd: [
                    'CLIENT',
                    'SETINFO',
                    'LIB-NAME',
                    this.#options?.clientInfoTag
                        ? `node-redis(${this.#options.clientInfoTag})`
                        : 'node-redis'
                ],
                errorHandler: () => {
                    // Client libraries are expected to pipeline this command
                    // after authentication on all connections and ignore failures
                    // since they could be connected to an older version that doesn't support them.
                }
            });
        }
        if (this.#clientSideCache) {
            commands.push({ cmd: this.#clientSideCache.trackingOn() });
        }
        return commands;
    }
    #initiateSocket() {
        const socketInitiator = async () => {
            const promises = [], chainId = Symbol('Socket Initiator');
            const resubscribePromise = this.#queue.resubscribe(chainId);
            if (resubscribePromise) {
                promises.push(resubscribePromise);
            }
            if (this.#monitorCallback) {
                promises.push(this.#queue.monitor(this.#monitorCallback, {
                    typeMapping: this._commandOptions?.typeMapping,
                    chainId,
                    asap: true
                }));
            }
            promises.push(...(await this.#handshake(chainId, true)));
            if (promises.length) {
                this.#write();
                return Promise.all(promises);
            }
        };
        return new socket_1.default(socketInitiator, this.#options?.socket)
            .on('data', chunk => {
            try {
                this.#queue.decoder.write(chunk);
            }
            catch (err) {
                this.#queue.resetDecoder();
                this.emit('error', err);
            }
        })
            .on('error', err => {
            this.emit('error', err);
            this.#clientSideCache?.onError();
            if (this.#socket.isOpen && !this.#options?.disableOfflineQueue) {
                this.#queue.flushWaitingForReply(err);
            }
            else {
                this.#queue.flushAll(err);
            }
        })
            .on('connect', () => this.emit('connect'))
            .on('ready', () => {
            this.emit('ready');
            this.#setPingTimer();
            this.#maybeScheduleWrite();
        })
            .on('reconnecting', () => this.emit('reconnecting'))
            .on('drain', () => this.#maybeScheduleWrite())
            .on('end', () => this.emit('end'));
    }
    #pingTimer;
    #setPingTimer() {
        if (!this.#options?.pingInterval || !this.#socket.isReady)
            return;
        clearTimeout(this.#pingTimer);
        this.#pingTimer = setTimeout(() => {
            if (!this.#socket.isReady)
                return;
            this.sendCommand(['PING'])
                .then(reply => this.emit('ping-interval', reply))
                .catch(err => this.emit('error', err))
                .finally(() => this.#setPingTimer());
        }, this.#options.pingInterval);
    }
    withCommandOptions(options) {
        const proxy = Object.create(this._self);
        proxy._commandOptions = options;
        return proxy;
    }
    _commandOptionsProxy(key, value) {
        const proxy = Object.create(this._self);
        proxy._commandOptions = Object.create(this._commandOptions ?? null);
        proxy._commandOptions[key] = value;
        return proxy;
    }
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping(typeMapping) {
        return this._commandOptionsProxy('typeMapping', typeMapping);
    }
    /**
     * Override the `abortSignal` command option
     */
    withAbortSignal(abortSignal) {
        return this._commandOptionsProxy('abortSignal', abortSignal);
    }
    /**
     * Override the `asap` command option to `true`
     */
    asap() {
        return this._commandOptionsProxy('asap', true);
    }
    /**
     * Create the "legacy" (v3/callback) interface
     */
    legacy() {
        return new legacy_mode_1.RedisLegacyClient(this);
    }
    /**
     * Create {@link RedisClientPool `RedisClientPool`} using this client as a prototype
     */
    createPool(options) {
        return pool_1.RedisClientPool.create(this._self.#options, options);
    }
    duplicate(overrides) {
        return new (Object.getPrototypeOf(this).constructor)({
            ...this._self.#options,
            commandOptions: this._commandOptions,
            ...overrides
        });
    }
    async connect() {
        await this._self.#socket.connect();
        return this;
    }
    /**
     * @internal
     */
    async _executeCommand(command, parser, commandOptions, transformReply) {
        const csc = this._self.#clientSideCache;
        const defaultTypeMapping = this._self.#options?.commandOptions === commandOptions;
        const fn = () => { return this.sendCommand(parser.redisArgs, commandOptions); };
        if (csc && command.CACHEABLE && defaultTypeMapping) {
            return await csc.handleCache(this._self, parser, fn, transformReply, commandOptions?.typeMapping);
        }
        else {
            const reply = await fn();
            if (transformReply) {
                return transformReply(reply, parser.preserve, commandOptions?.typeMapping);
            }
            return reply;
        }
    }
    /**
     * @internal
     */
    async _executeScript(script, parser, options, transformReply) {
        const args = parser.redisArgs;
        let reply;
        try {
            reply = await this.sendCommand(args, options);
        }
        catch (err) {
            if (!err?.message?.startsWith?.('NOSCRIPT'))
                throw err;
            args[0] = 'EVAL';
            args[1] = script.SCRIPT;
            reply = await this.sendCommand(args, options);
        }
        return transformReply ?
            transformReply(reply, parser.preserve, options?.typeMapping) :
            reply;
    }
    sendCommand(args, options) {
        if (!this._self.#socket.isOpen) {
            return Promise.reject(new errors_1.ClientClosedError());
        }
        else if (!this._self.#socket.isReady && this._self.#options?.disableOfflineQueue) {
            return Promise.reject(new errors_1.ClientOfflineError());
        }
        // Merge global options with provided options
        const opts = {
            ...this._self._commandOptions,
            ...options
        };
        const promise = this._self.#queue.addCommand(args, opts);
        this._self.#scheduleWrite();
        return promise;
    }
    async SELECT(db) {
        await this.sendCommand(['SELECT', db.toString()]);
        this._self.#selectedDB = db;
    }
    select = this.SELECT;
    #pubSubCommand(promise) {
        if (promise === undefined)
            return Promise.resolve();
        this.#scheduleWrite();
        return promise;
    }
    SUBSCRIBE(channels, listener, bufferMode) {
        return this._self.#pubSubCommand(this._self.#queue.subscribe(pub_sub_1.PUBSUB_TYPE.CHANNELS, channels, listener, bufferMode));
    }
    subscribe = this.SUBSCRIBE;
    UNSUBSCRIBE(channels, listener, bufferMode) {
        return this._self.#pubSubCommand(this._self.#queue.unsubscribe(pub_sub_1.PUBSUB_TYPE.CHANNELS, channels, listener, bufferMode));
    }
    unsubscribe = this.UNSUBSCRIBE;
    PSUBSCRIBE(patterns, listener, bufferMode) {
        return this._self.#pubSubCommand(this._self.#queue.subscribe(pub_sub_1.PUBSUB_TYPE.PATTERNS, patterns, listener, bufferMode));
    }
    pSubscribe = this.PSUBSCRIBE;
    PUNSUBSCRIBE(patterns, listener, bufferMode) {
        return this._self.#pubSubCommand(this._self.#queue.unsubscribe(pub_sub_1.PUBSUB_TYPE.PATTERNS, patterns, listener, bufferMode));
    }
    pUnsubscribe = this.PUNSUBSCRIBE;
    SSUBSCRIBE(channels, listener, bufferMode) {
        return this._self.#pubSubCommand(this._self.#queue.subscribe(pub_sub_1.PUBSUB_TYPE.SHARDED, channels, listener, bufferMode));
    }
    sSubscribe = this.SSUBSCRIBE;
    SUNSUBSCRIBE(channels, listener, bufferMode) {
        return this._self.#pubSubCommand(this._self.#queue.unsubscribe(pub_sub_1.PUBSUB_TYPE.SHARDED, channels, listener, bufferMode));
    }
    sUnsubscribe = this.SUNSUBSCRIBE;
    async WATCH(key) {
        const reply = await this._self.sendCommand((0, generic_transformers_1.pushVariadicArguments)(['WATCH'], key));
        this._self.#watchEpoch ??= this._self.socketEpoch;
        return reply;
    }
    watch = this.WATCH;
    async UNWATCH() {
        const reply = await this._self.sendCommand(['UNWATCH']);
        this._self.#watchEpoch = undefined;
        return reply;
    }
    unwatch = this.UNWATCH;
    getPubSubListeners(type) {
        return this._self.#queue.getPubSubListeners(type);
    }
    extendPubSubChannelListeners(type, channel, listeners) {
        return this._self.#pubSubCommand(this._self.#queue.extendPubSubChannelListeners(type, channel, listeners));
    }
    extendPubSubListeners(type, listeners) {
        return this._self.#pubSubCommand(this._self.#queue.extendPubSubListeners(type, listeners));
    }
    #write() {
        this.#socket.write(this.#queue.commandsToWrite());
    }
    #scheduledWrite;
    #scheduleWrite() {
        if (!this.#socket.isReady || this.#scheduledWrite)
            return;
        this.#scheduledWrite = setImmediate(() => {
            this.#write();
            this.#scheduledWrite = undefined;
        });
    }
    #maybeScheduleWrite() {
        if (!this.#queue.isWaitingToWrite())
            return;
        this.#scheduleWrite();
    }
    /**
     * @internal
     */
    async _executePipeline(commands, selectedDB) {
        if (!this._self.#socket.isOpen) {
            return Promise.reject(new errors_1.ClientClosedError());
        }
        const chainId = Symbol('Pipeline Chain'), promise = Promise.all(commands.map(({ args }) => this._self.#queue.addCommand(args, {
            chainId,
            typeMapping: this._commandOptions?.typeMapping
        })));
        this._self.#scheduleWrite();
        const result = await promise;
        if (selectedDB !== undefined) {
            this._self.#selectedDB = selectedDB;
        }
        return result;
    }
    /**
     * @internal
     */
    async _executeMulti(commands, selectedDB) {
        const dirtyWatch = this._self.#dirtyWatch;
        this._self.#dirtyWatch = undefined;
        const watchEpoch = this._self.#watchEpoch;
        this._self.#watchEpoch = undefined;
        if (!this._self.#socket.isOpen) {
            throw new errors_1.ClientClosedError();
        }
        if (dirtyWatch) {
            throw new errors_1.WatchError(dirtyWatch);
        }
        if (watchEpoch && watchEpoch !== this._self.socketEpoch) {
            throw new errors_1.WatchError('Client reconnected after WATCH');
        }
        const typeMapping = this._commandOptions?.typeMapping;
        const chainId = Symbol('MULTI Chain');
        const promises = [
            this._self.#queue.addCommand(['MULTI'], { chainId }),
        ];
        for (const { args } of commands) {
            promises.push(this._self.#queue.addCommand(args, {
                chainId,
                typeMapping
            }));
        }
        promises.push(this._self.#queue.addCommand(['EXEC'], { chainId }));
        this._self.#scheduleWrite();
        const results = await Promise.all(promises), execResult = results[results.length - 1];
        if (execResult === null) {
            throw new errors_1.WatchError();
        }
        if (selectedDB !== undefined) {
            this._self.#selectedDB = selectedDB;
        }
        return execResult;
    }
    MULTI() {
        return new this.Multi(this._executeMulti.bind(this), this._executePipeline.bind(this), this._commandOptions?.typeMapping);
    }
    multi = this.MULTI;
    async *scanIterator(options) {
        let cursor = options?.cursor ?? '0';
        do {
            const reply = await this.scan(cursor, options);
            cursor = reply.cursor;
            yield reply.keys;
        } while (cursor !== '0');
    }
    async *hScanIterator(key, options) {
        let cursor = options?.cursor ?? '0';
        do {
            const reply = await this.hScan(key, cursor, options);
            cursor = reply.cursor;
            yield reply.entries;
        } while (cursor !== '0');
    }
    async *hScanValuesIterator(key, options) {
        let cursor = options?.cursor ?? '0';
        do {
            const reply = await this.hScanNoValues(key, cursor, options);
            cursor = reply.cursor;
            yield reply.fields;
        } while (cursor !== '0');
    }
    async *hScanNoValuesIterator(key, options) {
        let cursor = options?.cursor ?? '0';
        do {
            const reply = await this.hScanNoValues(key, cursor, options);
            cursor = reply.cursor;
            yield reply.fields;
        } while (cursor !== '0');
    }
    async *sScanIterator(key, options) {
        let cursor = options?.cursor ?? '0';
        do {
            const reply = await this.sScan(key, cursor, options);
            cursor = reply.cursor;
            yield reply.members;
        } while (cursor !== '0');
    }
    async *zScanIterator(key, options) {
        let cursor = options?.cursor ?? '0';
        do {
            const reply = await this.zScan(key, cursor, options);
            cursor = reply.cursor;
            yield reply.members;
        } while (cursor !== '0');
    }
    async MONITOR(callback) {
        const promise = this._self.#queue.monitor(callback, {
            typeMapping: this._commandOptions?.typeMapping
        });
        this._self.#scheduleWrite();
        await promise;
        this._self.#monitorCallback = callback;
    }
    monitor = this.MONITOR;
    /**
     * Reset the client to its default state (i.e. stop PubSub, stop monitoring, select default DB, etc.)
     */
    async reset() {
        const chainId = Symbol('Reset Chain'), promises = [this._self.#queue.reset(chainId)], selectedDB = this._self.#options?.database ?? 0;
        this._self.#credentialsSubscription?.dispose();
        this._self.#credentialsSubscription = null;
        promises.push(...(await this._self.#handshake(chainId, false)));
        this._self.#scheduleWrite();
        await Promise.all(promises);
        this._self.#selectedDB = selectedDB;
        this._self.#monitorCallback = undefined;
        this._self.#dirtyWatch = undefined;
        this._self.#watchEpoch = undefined;
    }
    /**
     * If the client has state, reset it.
     * An internal function to be used by wrapper class such as `RedisClientPool`.
     * @internal
     */
    resetIfDirty() {
        let shouldReset = false;
        if (this._self.#selectedDB !== (this._self.#options?.database ?? 0)) {
            console.warn('Returning a client with a different selected DB');
            shouldReset = true;
        }
        if (this._self.#monitorCallback) {
            console.warn('Returning a client with active MONITOR');
            shouldReset = true;
        }
        if (this._self.#queue.isPubSubActive) {
            console.warn('Returning a client with active PubSub');
            shouldReset = true;
        }
        if (this._self.#dirtyWatch || this._self.#watchEpoch) {
            console.warn('Returning a client with active WATCH');
            shouldReset = true;
        }
        if (shouldReset) {
            return this.reset();
        }
    }
    /**
     * @deprecated use .close instead
     */
    QUIT() {
        this._self.#credentialsSubscription?.dispose();
        this._self.#credentialsSubscription = null;
        return this._self.#socket.quit(async () => {
            clearTimeout(this._self.#pingTimer);
            const quitPromise = this._self.#queue.addCommand(['QUIT']);
            this._self.#scheduleWrite();
            return quitPromise;
        });
    }
    quit = this.QUIT;
    /**
     * @deprecated use .destroy instead
     */
    disconnect() {
        return Promise.resolve(this.destroy());
    }
    /**
     * Close the client. Wait for pending commands.
     */
    close() {
        return new Promise(resolve => {
            clearTimeout(this._self.#pingTimer);
            this._self.#socket.close();
            this._self.#clientSideCache?.onClose();
            if (this._self.#queue.isEmpty()) {
                this._self.#socket.destroySocket();
                return resolve();
            }
            const maybeClose = () => {
                if (!this._self.#queue.isEmpty())
                    return;
                this._self.#socket.off('data', maybeClose);
                this._self.#socket.destroySocket();
                resolve();
            };
            this._self.#socket.on('data', maybeClose);
            this._self.#credentialsSubscription?.dispose();
            this._self.#credentialsSubscription = null;
        });
    }
    /**
     * Destroy the client. Rejects all commands immediately.
     */
    destroy() {
        clearTimeout(this._self.#pingTimer);
        this._self.#queue.flushAll(new errors_1.DisconnectsClientError());
        this._self.#socket.destroy();
        this._self.#clientSideCache?.onClose();
        this._self.#credentialsSubscription?.dispose();
        this._self.#credentialsSubscription = null;
    }
    ref() {
        this._self.#socket.ref();
    }
    unref() {
        this._self.#socket.unref();
    }
}
_a = RedisClient;
exports.default = RedisClient;
//# sourceMappingURL=index.js.map