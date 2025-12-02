"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisClientPool = void 0;
const commands_1 = __importDefault(require("../commands"));
const _1 = __importDefault(require("."));
const node_events_1 = require("node:events");
const linked_list_1 = require("./linked-list");
const errors_1 = require("../errors");
const commander_1 = require("../commander");
const multi_command_1 = __importDefault(require("./multi-command"));
const cache_1 = require("./cache");
const parser_1 = require("./parser");
const single_entry_cache_1 = __importDefault(require("../single-entry-cache"));
class RedisClientPool extends node_events_1.EventEmitter {
    static #createCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            return this.execute(client => client._executeCommand(command, parser, this._commandOptions, transformReply));
        };
    }
    static #createModuleCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            return this._self.execute(client => client._executeCommand(command, parser, this._self._commandOptions, transformReply));
        };
    }
    static #createFunctionCommand(name, fn, resp) {
        const prefix = (0, commander_1.functionArgumentsPrefix)(name, fn);
        const transformReply = (0, commander_1.getTransformReply)(fn, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.push(...prefix);
            fn.parseCommand(parser, ...args);
            return this._self.execute(client => client._executeCommand(fn, parser, this._self._commandOptions, transformReply));
        };
    }
    static #createScriptCommand(script, resp) {
        const prefix = (0, commander_1.scriptArgumentsPrefix)(script);
        const transformReply = (0, commander_1.getTransformReply)(script, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.pushVariadic(prefix);
            script.parseCommand(parser, ...args);
            return this.execute(client => client._executeScript(script, parser, this._commandOptions, transformReply));
        };
    }
    static #SingleEntryCache = new single_entry_cache_1.default();
    static create(clientOptions, options) {
        let Pool = RedisClientPool.#SingleEntryCache.get(clientOptions);
        if (!Pool) {
            Pool = (0, commander_1.attachConfig)({
                BaseClass: RedisClientPool,
                commands: commands_1.default,
                createCommand: RedisClientPool.#createCommand,
                createModuleCommand: RedisClientPool.#createModuleCommand,
                createFunctionCommand: RedisClientPool.#createFunctionCommand,
                createScriptCommand: RedisClientPool.#createScriptCommand,
                config: clientOptions
            });
            Pool.prototype.Multi = multi_command_1.default.extend(clientOptions);
            RedisClientPool.#SingleEntryCache.set(clientOptions, Pool);
        }
        // returning a "proxy" to prevent the namespaces._self to leak between "proxies"
        return Object.create(new Pool(clientOptions, options));
    }
    // TODO: defaults
    static #DEFAULTS = {
        minimum: 1,
        maximum: 100,
        acquireTimeout: 3000,
        cleanupDelay: 3000
    };
    #clientFactory;
    #options;
    #idleClients = new linked_list_1.SinglyLinkedList();
    /**
     * The number of idle clients.
     */
    get idleClients() {
        return this._self.#idleClients.length;
    }
    #clientsInUse = new linked_list_1.DoublyLinkedList();
    /**
     * The number of clients in use.
     */
    get clientsInUse() {
        return this._self.#clientsInUse.length;
    }
    /**
     * The total number of clients in the pool (including connecting, idle, and in use).
     */
    get totalClients() {
        return this._self.#idleClients.length + this._self.#clientsInUse.length;
    }
    #tasksQueue = new linked_list_1.SinglyLinkedList();
    /**
     * The number of tasks waiting for a client to become available.
     */
    get tasksQueueLength() {
        return this._self.#tasksQueue.length;
    }
    #isOpen = false;
    /**
     * Whether the pool is open (either connecting or connected).
     */
    get isOpen() {
        return this._self.#isOpen;
    }
    #isClosing = false;
    /**
     * Whether the pool is closing (*not* closed).
     */
    get isClosing() {
        return this._self.#isClosing;
    }
    #clientSideCache;
    get clientSideCache() {
        return this._self.#clientSideCache;
    }
    /**
     * You are probably looking for {@link RedisClient.createPool `RedisClient.createPool`},
     * {@link RedisClientPool.fromClient `RedisClientPool.fromClient`},
     * or {@link RedisClientPool.fromOptions `RedisClientPool.fromOptions`}...
     */
    constructor(clientOptions, options) {
        super();
        this.#options = {
            ...RedisClientPool.#DEFAULTS,
            ...options
        };
        if (options?.clientSideCache) {
            if (clientOptions === undefined) {
                clientOptions = {};
            }
            if (options.clientSideCache instanceof cache_1.PooledClientSideCacheProvider) {
                this.#clientSideCache = clientOptions.clientSideCache = options.clientSideCache;
            }
            else {
                const cscConfig = options.clientSideCache;
                this.#clientSideCache = clientOptions.clientSideCache = new cache_1.BasicPooledClientSideCache(cscConfig);
                //        this.#clientSideCache = clientOptions.clientSideCache = new PooledNoRedirectClientSideCache(cscConfig);
            }
        }
        this.#clientFactory = _1.default.factory(clientOptions).bind(undefined, clientOptions);
    }
    _self = this;
    _commandOptions;
    withCommandOptions(options) {
        const proxy = Object.create(this._self);
        proxy._commandOptions = options;
        return proxy;
    }
    #commandOptionsProxy(key, value) {
        const proxy = Object.create(this._self);
        proxy._commandOptions = Object.create(this._commandOptions ?? null);
        proxy._commandOptions[key] = value;
        return proxy;
    }
    /**
     * Override the `typeMapping` command option
     */
    withTypeMapping(typeMapping) {
        return this._self.#commandOptionsProxy('typeMapping', typeMapping);
    }
    /**
     * Override the `abortSignal` command option
     */
    withAbortSignal(abortSignal) {
        return this._self.#commandOptionsProxy('abortSignal', abortSignal);
    }
    /**
     * Override the `asap` command option to `true`
     * TODO: remove?
     */
    asap() {
        return this._self.#commandOptionsProxy('asap', true);
    }
    async connect() {
        if (this._self.#isOpen)
            return; // TODO: throw error?
        this._self.#isOpen = true;
        const promises = [];
        while (promises.length < this._self.#options.minimum) {
            promises.push(this._self.#create());
        }
        try {
            await Promise.all(promises);
        }
        catch (err) {
            this.destroy();
            throw err;
        }
        return this;
    }
    async #create() {
        const node = this._self.#clientsInUse.push(this._self.#clientFactory()
            .on('error', (err) => this.emit('error', err)));
        try {
            const client = node.value;
            await client.connect();
        }
        catch (err) {
            this._self.#clientsInUse.remove(node);
            throw err;
        }
        this._self.#returnClient(node);
    }
    execute(fn) {
        return new Promise((resolve, reject) => {
            const client = this._self.#idleClients.shift(), { tail } = this._self.#tasksQueue;
            if (!client) {
                let timeout;
                if (this._self.#options.acquireTimeout > 0) {
                    timeout = setTimeout(() => {
                        this._self.#tasksQueue.remove(task, tail);
                        reject(new errors_1.TimeoutError('Timeout waiting for a client')); // TODO: message
                    }, this._self.#options.acquireTimeout);
                }
                const task = this._self.#tasksQueue.push({
                    timeout,
                    // @ts-ignore
                    resolve,
                    reject,
                    fn
                });
                if (this.totalClients < this._self.#options.maximum) {
                    this._self.#create();
                }
                return;
            }
            const node = this._self.#clientsInUse.push(client);
            // @ts-ignore
            this._self.#executeTask(node, resolve, reject, fn);
        });
    }
    #executeTask(node, resolve, reject, fn) {
        const result = fn(node.value);
        if (result instanceof Promise) {
            result
                .then(resolve, reject)
                .finally(() => this.#returnClient(node));
        }
        else {
            resolve(result);
            this.#returnClient(node);
        }
    }
    #returnClient(node) {
        const task = this.#tasksQueue.shift();
        if (task) {
            clearTimeout(task.timeout);
            this.#executeTask(node, task.resolve, task.reject, task.fn);
            return;
        }
        this.#clientsInUse.remove(node);
        this.#idleClients.push(node.value);
        this.#scheduleCleanup();
    }
    cleanupTimeout;
    #scheduleCleanup() {
        if (this.totalClients <= this.#options.minimum)
            return;
        clearTimeout(this.cleanupTimeout);
        this.cleanupTimeout = setTimeout(() => this.#cleanup(), this.#options.cleanupDelay);
    }
    #cleanup() {
        const toDestroy = Math.min(this.#idleClients.length, this.totalClients - this.#options.minimum);
        for (let i = 0; i < toDestroy; i++) {
            // TODO: shift vs pop
            const client = this.#idleClients.shift();
            client.destroy();
        }
    }
    sendCommand(args, options) {
        return this.execute(client => client.sendCommand(args, options));
    }
    MULTI() {
        return new this.Multi((commands, selectedDB) => this.execute(client => client._executeMulti(commands, selectedDB)), commands => this.execute(client => client._executePipeline(commands)), this._commandOptions?.typeMapping);
    }
    multi = this.MULTI;
    async close() {
        if (this._self.#isClosing)
            return; // TODO: throw err?
        if (!this._self.#isOpen)
            return; // TODO: throw err?
        this._self.#isClosing = true;
        try {
            const promises = [];
            for (const client of this._self.#idleClients) {
                promises.push(client.close());
            }
            for (const client of this._self.#clientsInUse) {
                promises.push(client.close());
            }
            await Promise.all(promises);
            this.#clientSideCache?.onPoolClose();
            this._self.#idleClients.reset();
            this._self.#clientsInUse.reset();
        }
        catch (err) {
        }
        finally {
            this._self.#isClosing = false;
        }
    }
    destroy() {
        for (const client of this._self.#idleClients) {
            client.destroy();
        }
        this._self.#idleClients.reset();
        for (const client of this._self.#clientsInUse) {
            client.destroy();
        }
        this._self.#clientSideCache?.onPoolClose();
        this._self.#clientsInUse.reset();
        this._self.#isOpen = false;
    }
}
exports.RedisClientPool = RedisClientPool;
//# sourceMappingURL=pool.js.map