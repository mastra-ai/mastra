"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commands_1 = __importDefault(require("../commands"));
const multi_command_1 = __importDefault(require("../multi-command"));
const commander_1 = require("../commander");
const parser_1 = require("../client/parser");
class RedisClusterMultiCommand {
    static #createCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            const firstKey = parser.firstKey;
            return this.addCommand(firstKey, command.IS_READ_ONLY, redisArgs, transformReply);
        };
    }
    static #createModuleCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            const firstKey = parser.firstKey;
            return this._self.addCommand(firstKey, command.IS_READ_ONLY, redisArgs, transformReply);
        };
    }
    static #createFunctionCommand(name, fn, resp) {
        const prefix = (0, commander_1.functionArgumentsPrefix)(name, fn);
        const transformReply = (0, commander_1.getTransformReply)(fn, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.push(...prefix);
            fn.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            const firstKey = parser.firstKey;
            return this._self.addCommand(firstKey, fn.IS_READ_ONLY, redisArgs, transformReply);
        };
    }
    static #createScriptCommand(script, resp) {
        const transformReply = (0, commander_1.getTransformReply)(script, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            script.parseCommand(parser, ...args);
            const scriptArgs = parser.redisArgs;
            scriptArgs.preserve = parser.preserve;
            const firstKey = parser.firstKey;
            return this.#addScript(firstKey, script.IS_READ_ONLY, script, scriptArgs, transformReply);
        };
    }
    static extend(config) {
        return (0, commander_1.attachConfig)({
            BaseClass: RedisClusterMultiCommand,
            commands: commands_1.default,
            createCommand: RedisClusterMultiCommand.#createCommand,
            createModuleCommand: RedisClusterMultiCommand.#createModuleCommand,
            createFunctionCommand: RedisClusterMultiCommand.#createFunctionCommand,
            createScriptCommand: RedisClusterMultiCommand.#createScriptCommand,
            config
        });
    }
    #multi;
    #executeMulti;
    #executePipeline;
    #firstKey;
    #isReadonly = true;
    constructor(executeMulti, executePipeline, routing, typeMapping) {
        this.#multi = new multi_command_1.default(typeMapping);
        this.#executeMulti = executeMulti;
        this.#executePipeline = executePipeline;
        this.#firstKey = routing;
    }
    #setState(firstKey, isReadonly) {
        this.#firstKey ??= firstKey;
        this.#isReadonly &&= isReadonly;
    }
    addCommand(firstKey, isReadonly, args, transformReply) {
        this.#setState(firstKey, isReadonly);
        this.#multi.addCommand(args, transformReply);
        return this;
    }
    #addScript(firstKey, isReadonly, script, args, transformReply) {
        this.#setState(firstKey, isReadonly);
        this.#multi.addScript(script, args, transformReply);
        return this;
    }
    async exec(execAsPipeline = false) {
        if (execAsPipeline)
            return this.execAsPipeline();
        return this.#multi.transformReplies(await this.#executeMulti(this.#firstKey, this.#isReadonly, this.#multi.queue));
    }
    EXEC = this.exec;
    execTyped(execAsPipeline = false) {
        return this.exec(execAsPipeline);
    }
    async execAsPipeline() {
        if (this.#multi.queue.length === 0)
            return [];
        return this.#multi.transformReplies(await this.#executePipeline(this.#firstKey, this.#isReadonly, this.#multi.queue));
    }
    execAsPipelineTyped() {
        return this.execAsPipeline();
    }
}
exports.default = RedisClusterMultiCommand;
//# sourceMappingURL=multi-command.js.map