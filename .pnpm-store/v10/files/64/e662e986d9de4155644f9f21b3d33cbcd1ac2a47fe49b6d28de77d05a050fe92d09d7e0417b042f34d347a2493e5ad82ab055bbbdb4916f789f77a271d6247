"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commands_1 = __importDefault(require("../commands"));
const multi_command_1 = __importDefault(require("../multi-command"));
const commander_1 = require("../commander");
const parser_1 = require("../client/parser");
class RedisSentinelMultiCommand {
    static _createCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            return this.addCommand(command.IS_READ_ONLY, redisArgs, transformReply);
        };
    }
    static _createModuleCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            return this._self.addCommand(command.IS_READ_ONLY, redisArgs, transformReply);
        };
    }
    static _createFunctionCommand(name, fn, resp) {
        const prefix = (0, commander_1.functionArgumentsPrefix)(name, fn);
        const transformReply = (0, commander_1.getTransformReply)(fn, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            parser.push(...prefix);
            fn.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            return this._self.addCommand(fn.IS_READ_ONLY, redisArgs, transformReply);
        };
    }
    static _createScriptCommand(script, resp) {
        const transformReply = (0, commander_1.getTransformReply)(script, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            script.parseCommand(parser, ...args);
            const scriptArgs = parser.redisArgs;
            scriptArgs.preserve = parser.preserve;
            return this.#addScript(script.IS_READ_ONLY, script, scriptArgs, transformReply);
        };
    }
    static extend(config) {
        return (0, commander_1.attachConfig)({
            BaseClass: RedisSentinelMultiCommand,
            commands: commands_1.default,
            createCommand: RedisSentinelMultiCommand._createCommand,
            createModuleCommand: RedisSentinelMultiCommand._createModuleCommand,
            createFunctionCommand: RedisSentinelMultiCommand._createFunctionCommand,
            createScriptCommand: RedisSentinelMultiCommand._createScriptCommand,
            config
        });
    }
    #multi = new multi_command_1.default();
    #sentinel;
    #isReadonly = true;
    constructor(sentinel, typeMapping) {
        this.#multi = new multi_command_1.default(typeMapping);
        this.#sentinel = sentinel;
    }
    #setState(isReadonly) {
        this.#isReadonly &&= isReadonly;
    }
    addCommand(isReadonly, args, transformReply) {
        this.#setState(isReadonly);
        this.#multi.addCommand(args, transformReply);
        return this;
    }
    #addScript(isReadonly, script, args, transformReply) {
        this.#setState(isReadonly);
        this.#multi.addScript(script, args, transformReply);
        return this;
    }
    async exec(execAsPipeline = false) {
        if (execAsPipeline)
            return this.execAsPipeline();
        return this.#multi.transformReplies(await this.#sentinel._executeMulti(this.#isReadonly, this.#multi.queue));
    }
    EXEC = this.exec;
    execTyped(execAsPipeline = false) {
        return this.exec(execAsPipeline);
    }
    async execAsPipeline() {
        if (this.#multi.queue.length === 0)
            return [];
        return this.#multi.transformReplies(await this.#sentinel._executePipeline(this.#isReadonly, this.#multi.queue));
    }
    execAsPipelineTyped() {
        return this.execAsPipeline();
    }
}
exports.default = RedisSentinelMultiCommand;
//# sourceMappingURL=multi-commands.js.map