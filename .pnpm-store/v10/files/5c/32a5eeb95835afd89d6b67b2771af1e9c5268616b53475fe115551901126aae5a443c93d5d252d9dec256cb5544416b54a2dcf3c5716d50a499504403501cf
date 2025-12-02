"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSubProxy = void 0;
const node_events_1 = __importDefault(require("node:events"));
const pub_sub_1 = require("../client/pub-sub");
const client_1 = __importDefault(require("../client"));
class PubSubProxy extends node_events_1.default {
    #clientOptions;
    #onError;
    #node;
    #state;
    #subscriptions;
    constructor(clientOptions, onError) {
        super();
        this.#clientOptions = clientOptions;
        this.#onError = onError;
    }
    #createClient() {
        if (this.#node === undefined) {
            throw new Error("pubSubProxy: didn't define node to do pubsub against");
        }
        return new client_1.default({
            ...this.#clientOptions,
            socket: {
                ...this.#clientOptions.socket,
                host: this.#node.host,
                port: this.#node.port
            }
        });
    }
    async #initiatePubSubClient(withSubscriptions = false) {
        const client = this.#createClient()
            .on('error', this.#onError);
        const connectPromise = client.connect()
            .then(async (client) => {
            if (this.#state?.client !== client) {
                // if pubsub was deactivated while connecting (`this.#pubSubClient === undefined`)
                // or if the node changed (`this.#pubSubClient.client !== client`)
                client.destroy();
                return this.#state?.connectPromise;
            }
            if (withSubscriptions && this.#subscriptions) {
                await Promise.all([
                    client.extendPubSubListeners(pub_sub_1.PUBSUB_TYPE.CHANNELS, this.#subscriptions[pub_sub_1.PUBSUB_TYPE.CHANNELS]),
                    client.extendPubSubListeners(pub_sub_1.PUBSUB_TYPE.PATTERNS, this.#subscriptions[pub_sub_1.PUBSUB_TYPE.PATTERNS])
                ]);
            }
            if (this.#state.client !== client) {
                // if the node changed (`this.#pubSubClient.client !== client`)
                client.destroy();
                return this.#state?.connectPromise;
            }
            this.#state.connectPromise = undefined;
            return client;
        })
            .catch(err => {
            this.#state = undefined;
            throw err;
        });
        this.#state = {
            client,
            connectPromise
        };
        return connectPromise;
    }
    #getPubSubClient() {
        if (!this.#state)
            return this.#initiatePubSubClient();
        return (this.#state.connectPromise ??
            this.#state.client);
    }
    async changeNode(node) {
        this.#node = node;
        if (!this.#state)
            return;
        // if `connectPromise` is undefined, `this.#subscriptions` is already set
        // and `this.#state.client` might not have the listeners set yet
        if (this.#state.connectPromise === undefined) {
            this.#subscriptions = {
                [pub_sub_1.PUBSUB_TYPE.CHANNELS]: this.#state.client.getPubSubListeners(pub_sub_1.PUBSUB_TYPE.CHANNELS),
                [pub_sub_1.PUBSUB_TYPE.PATTERNS]: this.#state.client.getPubSubListeners(pub_sub_1.PUBSUB_TYPE.PATTERNS)
            };
            this.#state.client.destroy();
        }
        await this.#initiatePubSubClient(true);
    }
    #executeCommand(fn) {
        const client = this.#getPubSubClient();
        if (client instanceof client_1.default) {
            return fn(client);
        }
        return client.then(client => {
            // if pubsub was deactivated while connecting
            if (client === undefined)
                return;
            return fn(client);
        }).catch(err => {
            if (this.#state?.client.isPubSubActive) {
                this.#state.client.destroy();
                this.#state = undefined;
            }
            throw err;
        });
    }
    subscribe(channels, listener, bufferMode) {
        return this.#executeCommand(client => client.SUBSCRIBE(channels, listener, bufferMode));
    }
    #unsubscribe(fn) {
        return this.#executeCommand(async (client) => {
            const reply = await fn(client);
            if (!client.isPubSubActive) {
                client.destroy();
                this.#state = undefined;
            }
            return reply;
        });
    }
    async unsubscribe(channels, listener, bufferMode) {
        return this.#unsubscribe(client => client.UNSUBSCRIBE(channels, listener, bufferMode));
    }
    async pSubscribe(patterns, listener, bufferMode) {
        return this.#executeCommand(client => client.PSUBSCRIBE(patterns, listener, bufferMode));
    }
    async pUnsubscribe(patterns, listener, bufferMode) {
        return this.#unsubscribe(client => client.PUNSUBSCRIBE(patterns, listener, bufferMode));
    }
    destroy() {
        this.#subscriptions = undefined;
        if (this.#state === undefined)
            return;
        // `connectPromise` already handles the case of `this.#pubSubState = undefined`
        if (!this.#state.connectPromise) {
            this.#state.client.destroy();
        }
        this.#state = undefined;
    }
}
exports.PubSubProxy = PubSubProxy;
//# sourceMappingURL=pub-sub-proxy.js.map