"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_events_1 = require("node:events");
const node_net_1 = __importDefault(require("node:net"));
const node_tls_1 = __importDefault(require("node:tls"));
const errors_1 = require("../errors");
const promises_1 = require("node:timers/promises");
class RedisSocket extends node_events_1.EventEmitter {
    #initiator;
    #connectTimeout;
    #reconnectStrategy;
    #socketFactory;
    #socketTimeout;
    #socket;
    #isOpen = false;
    get isOpen() {
        return this.#isOpen;
    }
    #isReady = false;
    get isReady() {
        return this.#isReady;
    }
    #isSocketUnrefed = false;
    #socketEpoch = 0;
    get socketEpoch() {
        return this.#socketEpoch;
    }
    constructor(initiator, options) {
        super();
        this.#initiator = initiator;
        this.#connectTimeout = options?.connectTimeout ?? 5000;
        this.#reconnectStrategy = this.#createReconnectStrategy(options);
        this.#socketFactory = this.#createSocketFactory(options);
        this.#socketTimeout = options?.socketTimeout;
    }
    #createReconnectStrategy(options) {
        const strategy = options?.reconnectStrategy;
        if (strategy === false || typeof strategy === 'number') {
            return () => strategy;
        }
        if (strategy) {
            return (retries, cause) => {
                try {
                    const retryIn = strategy(retries, cause);
                    if (retryIn !== false && !(retryIn instanceof Error) && typeof retryIn !== 'number') {
                        throw new TypeError(`Reconnect strategy should return \`false | Error | number\`, got ${retryIn} instead`);
                    }
                    return retryIn;
                }
                catch (err) {
                    this.emit('error', err);
                    return this.defaultReconnectStrategy(retries, err);
                }
            };
        }
        return this.defaultReconnectStrategy;
    }
    #createSocketFactory(options) {
        // TLS
        if (options?.tls === true) {
            const withDefaults = {
                ...options,
                port: options?.port ?? 6379,
                // https://nodejs.org/api/tls.html#tlsconnectoptions-callback "Any socket.connect() option not already listed"
                // @types/node is... incorrect...
                // @ts-expect-error
                noDelay: options?.noDelay ?? true,
                // https://nodejs.org/api/tls.html#tlsconnectoptions-callback "Any socket.connect() option not already listed"
                // @types/node is... incorrect...
                // @ts-expect-error
                keepAlive: options?.keepAlive ?? true,
                // https://nodejs.org/api/tls.html#tlsconnectoptions-callback "Any socket.connect() option not already listed"
                // @types/node is... incorrect...
                // @ts-expect-error
                keepAliveInitialDelay: options?.keepAliveInitialDelay ?? 5000,
                timeout: undefined,
                onread: undefined,
                readable: true,
                writable: true
            };
            return {
                create() {
                    return node_tls_1.default.connect(withDefaults);
                },
                event: 'secureConnect'
            };
        }
        // IPC
        if (options && 'path' in options) {
            const withDefaults = {
                ...options,
                timeout: undefined,
                onread: undefined,
                readable: true,
                writable: true
            };
            return {
                create() {
                    return node_net_1.default.createConnection(withDefaults);
                },
                event: 'connect'
            };
        }
        // TCP
        const withDefaults = {
            ...options,
            port: options?.port ?? 6379,
            noDelay: options?.noDelay ?? true,
            keepAlive: options?.keepAlive ?? true,
            keepAliveInitialDelay: options?.keepAliveInitialDelay ?? 5000,
            timeout: undefined,
            onread: undefined,
            readable: true,
            writable: true
        };
        return {
            create() {
                return node_net_1.default.createConnection(withDefaults);
            },
            event: 'connect'
        };
    }
    #shouldReconnect(retries, cause) {
        const retryIn = this.#reconnectStrategy(retries, cause);
        if (retryIn === false) {
            this.#isOpen = false;
            this.emit('error', cause);
            return cause;
        }
        else if (retryIn instanceof Error) {
            this.#isOpen = false;
            this.emit('error', cause);
            return new errors_1.ReconnectStrategyError(retryIn, cause);
        }
        return retryIn;
    }
    async connect() {
        if (this.#isOpen) {
            throw new Error('Socket already opened');
        }
        this.#isOpen = true;
        return this.#connect();
    }
    async #connect() {
        let retries = 0;
        do {
            try {
                this.#socket = await this.#createSocket();
                this.emit('connect');
                try {
                    await this.#initiator();
                }
                catch (err) {
                    this.#socket.destroy();
                    this.#socket = undefined;
                    throw err;
                }
                this.#isReady = true;
                this.#socketEpoch++;
                this.emit('ready');
            }
            catch (err) {
                const retryIn = this.#shouldReconnect(retries++, err);
                if (typeof retryIn !== 'number') {
                    throw retryIn;
                }
                this.emit('error', err);
                await (0, promises_1.setTimeout)(retryIn);
                this.emit('reconnecting');
            }
        } while (this.#isOpen && !this.#isReady);
    }
    async #createSocket() {
        const socket = this.#socketFactory.create();
        let onTimeout;
        if (this.#connectTimeout !== undefined) {
            onTimeout = () => socket.destroy(new errors_1.ConnectionTimeoutError());
            socket.once('timeout', onTimeout);
            socket.setTimeout(this.#connectTimeout);
        }
        if (this.#isSocketUnrefed) {
            socket.unref();
        }
        await (0, node_events_1.once)(socket, this.#socketFactory.event);
        if (onTimeout) {
            socket.removeListener('timeout', onTimeout);
        }
        if (this.#socketTimeout) {
            socket.once('timeout', () => {
                socket.destroy(new errors_1.SocketTimeoutError(this.#socketTimeout));
            });
            socket.setTimeout(this.#socketTimeout);
        }
        socket
            .once('error', err => this.#onSocketError(err))
            .once('close', hadError => {
            if (hadError || !this.#isOpen || this.#socket !== socket)
                return;
            this.#onSocketError(new errors_1.SocketClosedUnexpectedlyError());
        })
            .on('drain', () => this.emit('drain'))
            .on('data', data => this.emit('data', data));
        return socket;
    }
    #onSocketError(err) {
        const wasReady = this.#isReady;
        this.#isReady = false;
        this.emit('error', err);
        if (!wasReady || !this.#isOpen || typeof this.#shouldReconnect(0, err) !== 'number')
            return;
        this.emit('reconnecting');
        this.#connect().catch(() => {
            // the error was already emitted, silently ignore it
        });
    }
    write(iterable) {
        if (!this.#socket)
            return;
        this.#socket.cork();
        for (const args of iterable) {
            for (const toWrite of args) {
                this.#socket.write(toWrite);
            }
            if (this.#socket.writableNeedDrain)
                break;
        }
        this.#socket.uncork();
    }
    async quit(fn) {
        if (!this.#isOpen) {
            throw new errors_1.ClientClosedError();
        }
        this.#isOpen = false;
        const reply = await fn();
        this.destroySocket();
        return reply;
    }
    close() {
        if (!this.#isOpen) {
            throw new errors_1.ClientClosedError();
        }
        this.#isOpen = false;
    }
    destroy() {
        if (!this.#isOpen) {
            throw new errors_1.ClientClosedError();
        }
        this.#isOpen = false;
        this.destroySocket();
    }
    destroySocket() {
        this.#isReady = false;
        if (this.#socket) {
            this.#socket.destroy();
            this.#socket = undefined;
        }
        this.emit('end');
    }
    ref() {
        this.#isSocketUnrefed = false;
        this.#socket?.ref();
    }
    unref() {
        this.#isSocketUnrefed = true;
        this.#socket?.unref();
    }
    defaultReconnectStrategy(retries, cause) {
        // By default, do not reconnect on socket timeout.
        if (cause instanceof errors_1.SocketTimeoutError) {
            return false;
        }
        // Generate a random jitter between 0 – 200 ms:
        const jitter = Math.floor(Math.random() * 200);
        // Delay is an exponential back off, (times^2) * 50 ms, with a maximum value of 2000 ms:
        const delay = Math.min(Math.pow(2, retries) * 50, 2000);
        return delay + jitter;
    }
}
exports.default = RedisSocket;
//# sourceMappingURL=socket.js.map