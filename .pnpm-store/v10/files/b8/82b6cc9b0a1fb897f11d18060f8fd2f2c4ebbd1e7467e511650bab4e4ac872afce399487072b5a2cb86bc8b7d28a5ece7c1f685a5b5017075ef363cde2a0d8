"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
const client_1 = __importDefault(require("../client"));
const pub_sub_1 = require("../client/pub-sub");
const cluster_key_slot_1 = __importDefault(require("cluster-key-slot"));
const cache_1 = require("../client/cache");
class RedisClusterSlots {
    static #SLOTS = 16384;
    #options;
    #clientFactory;
    #emit;
    slots = new Array(_a.#SLOTS);
    masters = new Array();
    replicas = new Array();
    nodeByAddress = new Map();
    pubSubNode;
    clientSideCache;
    #isOpen = false;
    get isOpen() {
        return this.#isOpen;
    }
    #validateOptions(options) {
        if (options?.clientSideCache && options?.RESP !== 3) {
            throw new Error('Client Side Caching is only supported with RESP3');
        }
    }
    constructor(options, emit) {
        this.#validateOptions(options);
        this.#options = options;
        if (options?.clientSideCache) {
            if (options.clientSideCache instanceof cache_1.PooledClientSideCacheProvider) {
                this.clientSideCache = options.clientSideCache;
            }
            else {
                this.clientSideCache = new cache_1.BasicPooledClientSideCache(options.clientSideCache);
            }
        }
        this.#clientFactory = client_1.default.factory(this.#options);
        this.#emit = emit;
    }
    async connect() {
        if (this.#isOpen) {
            throw new Error('Cluster already open');
        }
        this.#isOpen = true;
        try {
            await this.#discoverWithRootNodes();
        }
        catch (err) {
            this.#isOpen = false;
            throw err;
        }
    }
    async #discoverWithRootNodes() {
        let start = Math.floor(Math.random() * this.#options.rootNodes.length);
        for (let i = start; i < this.#options.rootNodes.length; i++) {
            if (!this.#isOpen)
                throw new Error('Cluster closed');
            if (await this.#discover(this.#options.rootNodes[i]))
                return;
        }
        for (let i = 0; i < start; i++) {
            if (!this.#isOpen)
                throw new Error('Cluster closed');
            if (await this.#discover(this.#options.rootNodes[i]))
                return;
        }
        throw new errors_1.RootNodesUnavailableError();
    }
    #resetSlots() {
        this.slots = new Array(_a.#SLOTS);
        this.masters = [];
        this.replicas = [];
        this._randomNodeIterator = undefined;
    }
    async #discover(rootNode) {
        this.clientSideCache?.clear();
        this.clientSideCache?.disable();
        try {
            const addressesInUse = new Set(), promises = [], eagerConnect = this.#options.minimizeConnections !== true;
            const shards = await this.#getShards(rootNode);
            this.#resetSlots(); // Reset slots AFTER shards have been fetched to prevent a race condition
            for (const { from, to, master, replicas } of shards) {
                const shard = {
                    master: this.#initiateSlotNode(master, false, eagerConnect, addressesInUse, promises)
                };
                if (this.#options.useReplicas) {
                    shard.replicas = replicas.map(replica => this.#initiateSlotNode(replica, true, eagerConnect, addressesInUse, promises));
                }
                for (let i = from; i <= to; i++) {
                    this.slots[i] = shard;
                }
            }
            if (this.pubSubNode && !addressesInUse.has(this.pubSubNode.address)) {
                const channelsListeners = this.pubSubNode.client.getPubSubListeners(pub_sub_1.PUBSUB_TYPE.CHANNELS), patternsListeners = this.pubSubNode.client.getPubSubListeners(pub_sub_1.PUBSUB_TYPE.PATTERNS);
                this.pubSubNode.client.destroy();
                if (channelsListeners.size || patternsListeners.size) {
                    promises.push(this.#initiatePubSubClient({
                        [pub_sub_1.PUBSUB_TYPE.CHANNELS]: channelsListeners,
                        [pub_sub_1.PUBSUB_TYPE.PATTERNS]: patternsListeners
                    }));
                }
            }
            for (const [address, node] of this.nodeByAddress.entries()) {
                if (addressesInUse.has(address))
                    continue;
                if (node.client) {
                    node.client.destroy();
                }
                const { pubSub } = node;
                if (pubSub) {
                    pubSub.client.destroy();
                }
                this.nodeByAddress.delete(address);
            }
            await Promise.all(promises);
            this.clientSideCache?.enable();
            return true;
        }
        catch (err) {
            this.#emit('error', err);
            return false;
        }
    }
    async #getShards(rootNode) {
        const options = this.#clientOptionsDefaults(rootNode);
        options.socket ??= {};
        options.socket.reconnectStrategy = false;
        options.RESP = this.#options.RESP;
        options.commandOptions = undefined;
        // TODO: find a way to avoid type casting
        const client = await this.#clientFactory(options)
            .on('error', err => this.#emit('error', err))
            .connect();
        try {
            // switch to `CLUSTER SHARDS` when Redis 7.0 will be the minimum supported version
            return await client.clusterSlots();
        }
        finally {
            client.destroy();
        }
    }
    #getNodeAddress(address) {
        switch (typeof this.#options.nodeAddressMap) {
            case 'object':
                return this.#options.nodeAddressMap[address];
            case 'function':
                return this.#options.nodeAddressMap(address);
        }
    }
    #clientOptionsDefaults(options) {
        if (!this.#options.defaults)
            return options;
        let socket;
        if (this.#options.defaults.socket) {
            socket = {
                ...this.#options.defaults.socket,
                ...options?.socket
            };
        }
        else {
            socket = options?.socket;
        }
        return {
            ...this.#options.defaults,
            ...options,
            socket: socket
        };
    }
    #initiateSlotNode(shard, readonly, eagerConnent, addressesInUse, promises) {
        const address = `${shard.host}:${shard.port}`;
        let node = this.nodeByAddress.get(address);
        if (!node) {
            node = {
                ...shard,
                address,
                readonly,
                client: undefined,
                connectPromise: undefined
            };
            if (eagerConnent) {
                promises.push(this.#createNodeClient(node));
            }
            this.nodeByAddress.set(address, node);
        }
        if (!addressesInUse.has(address)) {
            addressesInUse.add(address);
            (readonly ? this.replicas : this.masters).push(node);
        }
        return node;
    }
    #createClient(node, readonly = node.readonly) {
        return this.#clientFactory(this.#clientOptionsDefaults({
            clientSideCache: this.clientSideCache,
            RESP: this.#options.RESP,
            socket: this.#getNodeAddress(node.address) ?? {
                host: node.host,
                port: node.port
            },
            readonly
        })).on('error', err => console.error(err));
    }
    #createNodeClient(node, readonly) {
        const client = node.client = this.#createClient(node, readonly);
        return node.connectPromise = client.connect()
            .finally(() => node.connectPromise = undefined);
    }
    nodeClient(node) {
        return (node.connectPromise ?? // if the node is connecting
            node.client ?? // if the node is connected
            this.#createNodeClient(node) // if the not is disconnected
        );
    }
    #runningRediscoverPromise;
    async rediscover(startWith) {
        this.#runningRediscoverPromise ??= this.#rediscover(startWith)
            .finally(() => this.#runningRediscoverPromise = undefined);
        return this.#runningRediscoverPromise;
    }
    async #rediscover(startWith) {
        if (await this.#discover(startWith.options))
            return;
        return this.#discoverWithRootNodes();
    }
    /**
     * @deprecated Use `close` instead.
     */
    quit() {
        return this.#destroy(client => client.quit());
    }
    /**
     * @deprecated Use `destroy` instead.
     */
    disconnect() {
        return this.#destroy(client => client.disconnect());
    }
    close() {
        return this.#destroy(client => client.close());
    }
    destroy() {
        this.#isOpen = false;
        for (const client of this.#clients()) {
            client.destroy();
        }
        if (this.pubSubNode) {
            this.pubSubNode.client.destroy();
            this.pubSubNode = undefined;
        }
        this.#resetSlots();
        this.nodeByAddress.clear();
    }
    *#clients() {
        for (const master of this.masters) {
            if (master.client) {
                yield master.client;
            }
            if (master.pubSub) {
                yield master.pubSub.client;
            }
        }
        for (const replica of this.replicas) {
            if (replica.client) {
                yield replica.client;
            }
        }
    }
    async #destroy(fn) {
        this.#isOpen = false;
        const promises = [];
        for (const client of this.#clients()) {
            promises.push(fn(client));
        }
        if (this.pubSubNode) {
            promises.push(fn(this.pubSubNode.client));
            this.pubSubNode = undefined;
        }
        this.#resetSlots();
        this.nodeByAddress.clear();
        await Promise.allSettled(promises);
    }
    getClient(firstKey, isReadonly) {
        if (!firstKey) {
            return this.nodeClient(this.getRandomNode());
        }
        const slotNumber = (0, cluster_key_slot_1.default)(firstKey);
        if (!isReadonly) {
            return this.nodeClient(this.slots[slotNumber].master);
        }
        return this.nodeClient(this.getSlotRandomNode(slotNumber));
    }
    *#iterateAllNodes() {
        let i = Math.floor(Math.random() * (this.masters.length + this.replicas.length));
        if (i < this.masters.length) {
            do {
                yield this.masters[i];
            } while (++i < this.masters.length);
            for (const replica of this.replicas) {
                yield replica;
            }
        }
        else {
            i -= this.masters.length;
            do {
                yield this.replicas[i];
            } while (++i < this.replicas.length);
        }
        while (true) {
            for (const master of this.masters) {
                yield master;
            }
            for (const replica of this.replicas) {
                yield replica;
            }
        }
    }
    _randomNodeIterator;
    getRandomNode() {
        this._randomNodeIterator ??= this.#iterateAllNodes();
        return this._randomNodeIterator.next().value;
    }
    *#slotNodesIterator(slot) {
        let i = Math.floor(Math.random() * (1 + slot.replicas.length));
        if (i < slot.replicas.length) {
            do {
                yield slot.replicas[i];
            } while (++i < slot.replicas.length);
        }
        while (true) {
            yield slot.master;
            for (const replica of slot.replicas) {
                yield replica;
            }
        }
    }
    getSlotRandomNode(slotNumber) {
        const slot = this.slots[slotNumber];
        if (!slot.replicas?.length) {
            return slot.master;
        }
        slot.nodesIterator ??= this.#slotNodesIterator(slot);
        return slot.nodesIterator.next().value;
    }
    getMasterByAddress(address) {
        const master = this.nodeByAddress.get(address);
        if (!master)
            return;
        return this.nodeClient(master);
    }
    getPubSubClient() {
        if (!this.pubSubNode)
            return this.#initiatePubSubClient();
        return this.pubSubNode.connectPromise ?? this.pubSubNode.client;
    }
    async #initiatePubSubClient(toResubscribe) {
        const index = Math.floor(Math.random() * (this.masters.length + this.replicas.length)), node = index < this.masters.length ?
            this.masters[index] :
            this.replicas[index - this.masters.length], client = this.#createClient(node, false);
        this.pubSubNode = {
            address: node.address,
            client,
            connectPromise: client.connect()
                .then(async (client) => {
                if (toResubscribe) {
                    await Promise.all([
                        client.extendPubSubListeners(pub_sub_1.PUBSUB_TYPE.CHANNELS, toResubscribe[pub_sub_1.PUBSUB_TYPE.CHANNELS]),
                        client.extendPubSubListeners(pub_sub_1.PUBSUB_TYPE.PATTERNS, toResubscribe[pub_sub_1.PUBSUB_TYPE.PATTERNS])
                    ]);
                }
                this.pubSubNode.connectPromise = undefined;
                return client;
            })
                .catch(err => {
                this.pubSubNode = undefined;
                throw err;
            })
        };
        return this.pubSubNode.connectPromise;
    }
    async executeUnsubscribeCommand(unsubscribe) {
        const client = await this.getPubSubClient();
        await unsubscribe(client);
        if (!client.isPubSubActive) {
            client.destroy();
            this.pubSubNode = undefined;
        }
    }
    getShardedPubSubClient(channel) {
        const { master } = this.slots[(0, cluster_key_slot_1.default)(channel)];
        if (!master.pubSub)
            return this.#initiateShardedPubSubClient(master);
        return master.pubSub.connectPromise ?? master.pubSub.client;
    }
    async #initiateShardedPubSubClient(master) {
        const client = this.#createClient(master, false)
            .on('server-sunsubscribe', async (channel, listeners) => {
            try {
                await this.rediscover(client);
                const redirectTo = await this.getShardedPubSubClient(channel);
                await redirectTo.extendPubSubChannelListeners(pub_sub_1.PUBSUB_TYPE.SHARDED, channel, listeners);
            }
            catch (err) {
                this.#emit('sharded-shannel-moved-error', err, channel, listeners);
            }
        });
        master.pubSub = {
            client,
            connectPromise: client.connect()
                .then(client => {
                master.pubSub.connectPromise = undefined;
                return client;
            })
                .catch(err => {
                master.pubSub = undefined;
                throw err;
            })
        };
        return master.pubSub.connectPromise;
    }
    async executeShardedUnsubscribeCommand(channel, unsubscribe) {
        const { master } = this.slots[(0, cluster_key_slot_1.default)(channel)];
        if (!master.pubSub)
            return;
        const client = master.pubSub.connectPromise ?
            await master.pubSub.connectPromise :
            master.pubSub.client;
        await unsubscribe(client);
        if (!client.isPubSubActive) {
            client.destroy();
            master.pubSub = undefined;
        }
    }
}
_a = RedisClusterSlots;
exports.default = RedisClusterSlots;
//# sourceMappingURL=cluster-slots.js.map