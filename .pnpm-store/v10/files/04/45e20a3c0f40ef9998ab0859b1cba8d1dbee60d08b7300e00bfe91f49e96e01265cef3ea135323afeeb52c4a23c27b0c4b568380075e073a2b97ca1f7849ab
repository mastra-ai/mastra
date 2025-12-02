"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisLegacyClient = void 0;
const commander_1 = require("../commander");
const commands_1 = __importDefault(require("../commands"));
const multi_command_1 = __importDefault(require("../multi-command"));
class RedisLegacyClient {
    static #transformArguments(redisArgs, args) {
        let callback;
        if (typeof args[args.length - 1] === 'function') {
            callback = args.pop();
        }
        RedisLegacyClient.pushArguments(redisArgs, args);
        return callback;
    }
    static pushArguments(redisArgs, args) {
        for (let i = 0; i < args.length; ++i) {
            const arg = args[i];
            if (Array.isArray(arg)) {
                RedisLegacyClient.pushArguments(redisArgs, arg);
            }
            else {
                redisArgs.push(typeof arg === 'number' || arg instanceof Date ?
                    arg.toString() :
                    arg);
            }
        }
    }
    static getTransformReply(command, resp) {
        return command.TRANSFORM_LEGACY_REPLY ?
            (0, commander_1.getTransformReply)(command, resp) :
            undefined;
    }
    static #createCommand(name, command, resp) {
        const transformReply = RedisLegacyClient.getTransformReply(command, resp);
        return function (...args) {
            const redisArgs = [name], callback = RedisLegacyClient.#transformArguments(redisArgs, args), promise = this.#client.sendCommand(redisArgs);
            if (!callback) {
                promise.catch(err => this.#client.emit('error', err));
                return;
            }
            promise
                .then(reply => callback(null, transformReply ? transformReply(reply) : reply))
                .catch(err => callback(err));
        };
    }
    #client;
    #Multi;
    constructor(client) {
        this.#client = client;
        const RESP = client.options?.RESP ?? 2;
        for (const [name, command] of Object.entries(commands_1.default)) {
            // TODO: as any?
            this[name] = RedisLegacyClient.#createCommand(name, command, RESP);
        }
        this.#Multi = LegacyMultiCommand.factory(RESP);
    }
    sendCommand(...args) {
        const redisArgs = [], callback = RedisLegacyClient.#transformArguments(redisArgs, args), promise = this.#client.sendCommand(redisArgs);
        if (!callback) {
            promise.catch(err => this.#client.emit('error', err));
            return;
        }
        promise
            .then(reply => callback(null, reply))
            .catch(err => callback(err));
    }
    multi() {
        return this.#Multi(this.#client);
    }
}
exports.RedisLegacyClient = RedisLegacyClient;
class LegacyMultiCommand {
    static #createCommand(name, command, resp) {
        const transformReply = RedisLegacyClient.getTransformReply(command, resp);
        return function (...args) {
            const redisArgs = [name];
            RedisLegacyClient.pushArguments(redisArgs, args);
            this.#multi.addCommand(redisArgs, transformReply);
            return this;
        };
    }
    static factory(resp) {
        const Multi = class extends LegacyMultiCommand {
        };
        for (const [name, command] of Object.entries(commands_1.default)) {
            // TODO: as any?
            Multi.prototype[name] = LegacyMultiCommand.#createCommand(name, command, resp);
        }
        return (client) => {
            return new Multi(client);
        };
    }
    #multi = new multi_command_1.default();
    #client;
    constructor(client) {
        this.#client = client;
    }
    sendCommand(...args) {
        const redisArgs = [];
        RedisLegacyClient.pushArguments(redisArgs, args);
        this.#multi.addCommand(redisArgs);
        return this;
    }
    exec(cb) {
        const promise = this.#client._executeMulti(this.#multi.queue);
        if (!cb) {
            promise.catch(err => this.#client.emit('error', err));
            return;
        }
        promise
            .then(results => cb(null, this.#multi.transformReplies(results)))
            .catch(err => cb?.(err));
    }
}
//# sourceMappingURL=legacy-mode.js.map