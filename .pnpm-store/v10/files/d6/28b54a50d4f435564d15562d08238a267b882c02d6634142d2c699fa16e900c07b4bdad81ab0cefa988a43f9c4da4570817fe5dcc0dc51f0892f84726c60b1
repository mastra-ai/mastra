"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commands_1 = __importDefault(require("../commands"));
const node_events_1 = require("node:events");
const commander_1 = require("../commander");
const cluster_slots_1 = __importDefault(require("./cluster-slots"));
const multi_command_1 = __importDefault(require("./multi-command"));
const errors_1 = require("../errors");
const parser_1 = require("../client/parser");
const ASKING_1 = require("../commands/ASKING");
const single_entry_cache_1 = __importDefault(require("../single-entry-cache"));
class RedisCluster extends node_events_1.EventEmitter {
    static #createCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            return this._self._execute(parser.firstKey, command.IS_READ_ONLY, this._commandOptions, (client, opts) => client._executeCommand(command, parser, opts, transformReply));
        };
    }
    static #createModuleCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            return this._self._execute(parser.firstKey, command.IS_READ_ONLY, this._self._commandOptions, (client, opts) => client._executeCommand(command, parser, opts, transformReply));
        };
    }
    static #createFunctionCommand(name, fn, resp) {
        const prefix = (0, commander_1.functionArgumentsPrefix)(name, fn);
        const transformReply = (0, commander_1.getTransformReply)(fn, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.push(...prefix);
            fn.parseCommand(parser, ...args);
            return this._self._execute(parser.firstKey, fn.IS_READ_ONLY, this._self._commandOptions, (client, opts) => client._executeCommand(fn, parser, opts, transformReply));
        };
    }
    static #createScriptCommand(script, resp) {
        const prefix = (0, commander_1.scriptArgumentsPrefix)(script);
        const transformReply = (0, commander_1.getTransformReply)(script, resp);
        return async function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.push(...prefix);
            script.parseCommand(parser, ...args);
            return this._self._execute(parser.firstKey, script.IS_READ_ONLY, this._commandOptions, (client, opts) => client._executeScript(script, parser, opts, transformReply));
        };
    }
    static #SingleEntryCache = new single_entry_cache_1.default();
    static factory(config) {
        let Cluster = RedisCluster.#SingleEntryCache.get(config);
        if (!Cluster) {
            Cluster = (0, commander_1.attachConfig)({
                BaseClass: RedisCluster,
                commands: commands_1.default,
                createCommand: RedisCluster.#createCommand,
                createModuleCommand: RedisCluster.#createModuleCommand,
                createFunctionCommand: RedisCluster.#createFunctionCommand,
                createScriptCommand: RedisCluster.#createScriptCommand,
                config
            });
            Cluster.prototype.Multi = multi_command_1.default.extend(config);
            RedisCluster.#SingleEntryCache.set(config, Cluster);
        }
        return (options) => {
            // returning a "proxy" to prevent the namespaces._self to leak between "proxies"
            return Object.create(new Cluster(options));
        };
    }
    static create(options) {
        return RedisCluster.factory(options)(options);
    }
    _options;
    _slots;
    _self = this;
    _commandOptions;
    /**
     * An array of the cluster slots, each slot contain its `master` and `replicas`.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific node (master or replica).
     */
    get slots() {
        return this._self._slots.slots;
    }
    get clientSideCache() {
        return this._self._slots.clientSideCache;
    }
    /**
     * An array of the cluster masters.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific master node.
     */
    get masters() {
        return this._self._slots.masters;
    }
    /**
     * An array of the cluster replicas.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific replica node.
     */
    get replicas() {
        return this._self._slots.replicas;
    }
    /**
     * A map form a node address (`<host>:<port>`) to its shard, each shard contain its `master` and `replicas`.
     * Use with {@link RedisCluster.prototype.nodeClient} to get the client for a specific node (master or replica).
     */
    get nodeByAddress() {
        return this._self._slots.nodeByAddress;
    }
    /**
     * The current pub/sub node.
     */
    get pubSubNode() {
        return this._self._slots.pubSubNode;
    }
    get isOpen() {
        return this._self._slots.isOpen;
    }
    constructor(options) {
        super();
        this._options = options;
        this._slots = new cluster_slots_1.default(options, this.emit.bind(this));
        if (options?.commandOptions) {
            this._commandOptions = options.commandOptions;
        }
    }
    duplicate(overrides) {
        return new (Object.getPrototypeOf(this).constructor)({
            ...this._self._options,
            commandOptions: this._commandOptions,
            ...overrides
        });
    }
    async connect() {
        await this._self._slots.connect();
        return this;
    }
    withCommandOptions(options) {
        const proxy = Object.create(this);
        proxy._commandOptions = options;
        return proxy;
    }
    _commandOptionsProxy(key, value) {
        const proxy = Object.create(this);
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
    // /**
    //  * Override the `policies` command option
    //  * TODO
    //  */
    // withPolicies<POLICIES extends CommandPolicies> (policies: POLICIES) {
    //   return this._commandOptionsProxy('policies', policies);
    // }
    _handleAsk(fn) {
        return async (client, options) => {
            const chainId = Symbol("asking chain");
            const opts = options ? { ...options } : {};
            opts.chainId = chainId;
            const ret = await Promise.all([
                client.sendCommand([ASKING_1.ASKING_CMD], { chainId: chainId }),
                fn(client, opts)
            ]);
            return ret[1];
        };
    }
    async _execute(firstKey, isReadonly, options, fn) {
        const maxCommandRedirections = this._options.maxCommandRedirections ?? 16;
        let client = await this._slots.getClient(firstKey, isReadonly);
        let i = 0;
        let myFn = fn;
        while (true) {
            try {
                return await myFn(client, options);
            }
            catch (err) {
                myFn = fn;
                // TODO: error class
                if (++i > maxCommandRedirections || !(err instanceof Error)) {
                    throw err;
                }
                if (err.message.startsWith('ASK')) {
                    const address = err.message.substring(err.message.lastIndexOf(' ') + 1);
                    let redirectTo = await this._slots.getMasterByAddress(address);
                    if (!redirectTo) {
                        await this._slots.rediscover(client);
                        redirectTo = await this._slots.getMasterByAddress(address);
                    }
                    if (!redirectTo) {
                        throw new Error(`Cannot find node ${address}`);
                    }
                    client = redirectTo;
                    myFn = this._handleAsk(fn);
                    continue;
                }
                if (err.message.startsWith('MOVED')) {
                    await this._slots.rediscover(client);
                    client = await this._slots.getClient(firstKey, isReadonly);
                    continue;
                }
                throw err;
            }
        }
    }
    async sendCommand(firstKey, isReadonly, args, options) {
        // Merge global options with local options
        const opts = {
            ...this._self._commandOptions,
            ...options
        };
        return this._self._execute(firstKey, isReadonly, opts, (client, opts) => client.sendCommand(args, opts));
    }
    MULTI(routing) {
        return new this.Multi(async (firstKey, isReadonly, commands) => {
            const client = await this._self._slots.getClient(firstKey, isReadonly);
            return client._executeMulti(commands);
        }, async (firstKey, isReadonly, commands) => {
            const client = await this._self._slots.getClient(firstKey, isReadonly);
            return client._executePipeline(commands);
        }, routing, this._commandOptions?.typeMapping);
    }
    multi = this.MULTI;
    async SUBSCRIBE(channels, listener, bufferMode) {
        return (await this._self._slots.getPubSubClient())
            .SUBSCRIBE(channels, listener, bufferMode);
    }
    subscribe = this.SUBSCRIBE;
    async UNSUBSCRIBE(channels, listener, bufferMode) {
        return this._self._slots.executeUnsubscribeCommand(client => client.UNSUBSCRIBE(channels, listener, bufferMode));
    }
    unsubscribe = this.UNSUBSCRIBE;
    async PSUBSCRIBE(patterns, listener, bufferMode) {
        return (await this._self._slots.getPubSubClient())
            .PSUBSCRIBE(patterns, listener, bufferMode);
    }
    pSubscribe = this.PSUBSCRIBE;
    async PUNSUBSCRIBE(patterns, listener, bufferMode) {
        return this._self._slots.executeUnsubscribeCommand(client => client.PUNSUBSCRIBE(patterns, listener, bufferMode));
    }
    pUnsubscribe = this.PUNSUBSCRIBE;
    async SSUBSCRIBE(channels, listener, bufferMode) {
        const maxCommandRedirections = this._self._options.maxCommandRedirections ?? 16, firstChannel = Array.isArray(channels) ? channels[0] : channels;
        let client = await this._self._slots.getShardedPubSubClient(firstChannel);
        for (let i = 0;; i++) {
            try {
                return await client.SSUBSCRIBE(channels, listener, bufferMode);
            }
            catch (err) {
                if (++i > maxCommandRedirections || !(err instanceof errors_1.ErrorReply)) {
                    throw err;
                }
                if (err.message.startsWith('MOVED')) {
                    await this._self._slots.rediscover(client);
                    client = await this._self._slots.getShardedPubSubClient(firstChannel);
                    continue;
                }
                throw err;
            }
        }
    }
    sSubscribe = this.SSUBSCRIBE;
    SUNSUBSCRIBE(channels, listener, bufferMode) {
        return this._self._slots.executeShardedUnsubscribeCommand(Array.isArray(channels) ? channels[0] : channels, client => client.SUNSUBSCRIBE(channels, listener, bufferMode));
    }
    sUnsubscribe = this.SUNSUBSCRIBE;
    /**
     * @deprecated Use `close` instead.
     */
    quit() {
        return this._self._slots.quit();
    }
    /**
     * @deprecated Use `destroy` instead.
     */
    disconnect() {
        return this._self._slots.disconnect();
    }
    close() {
        this._self._slots.clientSideCache?.onPoolClose();
        return this._self._slots.close();
    }
    destroy() {
        this._self._slots.clientSideCache?.onPoolClose();
        return this._self._slots.destroy();
    }
    nodeClient(node) {
        return this._self._slots.nodeClient(node);
    }
    /**
     * Returns a random node from the cluster.
     * Userful for running "forward" commands (like PUBLISH) on a random node.
     */
    getRandomNode() {
        return this._self._slots.getRandomNode();
    }
    /**
     * Get a random node from a slot.
     * Useful for running readonly commands on a slot.
     */
    getSlotRandomNode(slot) {
        return this._self._slots.getSlotRandomNode(slot);
    }
    /**
     * @deprecated use `.masters` instead
     * TODO
     */
    getMasters() {
        return this.masters;
    }
    /**
     * @deprecated use `.slots[<SLOT>]` instead
     * TODO
     */
    getSlotMaster(slot) {
        return this.slots[slot].master;
    }
}
exports.default = RedisCluster;
//# sourceMappingURL=index.js.map