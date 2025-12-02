"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commands_1 = __importDefault(require("../commands"));
const multi_command_1 = __importDefault(require("../multi-command"));
const commander_1 = require("../commander");
const parser_1 = require("./parser");
class RedisClientMultiCommand {
    static #createCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            return this.addCommand(redisArgs, transformReply);
        };
    }
    static #createModuleCommand(command, resp) {
        const transformReply = (0, commander_1.getTransformReply)(command, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            command.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            return this._self.addCommand(redisArgs, transformReply);
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
            return this._self.addCommand(redisArgs, transformReply);
        };
    }
    static #createScriptCommand(script, resp) {
        const transformReply = (0, commander_1.getTransformReply)(script, resp);
        return function (...args) {
            const parser = new parser_1.BasicCommandParser();
            script.parseCommand(parser, ...args);
            const redisArgs = parser.redisArgs;
            redisArgs.preserve = parser.preserve;
            return this.#addScript(script, redisArgs, transformReply);
        };
    }
    static extend(config) {
        return (0, commander_1.attachConfig)({
            BaseClass: RedisClientMultiCommand,
            commands: commands_1.default,
            createCommand: RedisClientMultiCommand.#createCommand,
            createModuleCommand: RedisClientMultiCommand.#createModuleCommand,
            createFunctionCommand: RedisClientMultiCommand.#createFunctionCommand,
            createScriptCommand: RedisClientMultiCommand.#createScriptCommand,
            config
        });
    }
    #multi;
    #executeMulti;
    #executePipeline;
    #selectedDB;
    constructor(executeMulti, executePipeline, typeMapping) {
        this.#multi = new multi_command_1.default(typeMapping);
        this.#executeMulti = executeMulti;
        this.#executePipeline = executePipeline;
    }
    SELECT(db, transformReply) {
        this.#selectedDB = db;
        this.#multi.addCommand(['SELECT', db.toString()], transformReply);
        return this;
    }
    select = this.SELECT;
    addCommand(args, transformReply) {
        this.#multi.addCommand(args, transformReply);
        return this;
    }
    #addScript(script, args, transformReply) {
        this.#multi.addScript(script, args, transformReply);
        return this;
    }
    async exec(execAsPipeline = false) {
        if (execAsPipeline)
            return this.execAsPipeline();
        return this.#multi.transformReplies(await this.#executeMulti(this.#multi.queue, this.#selectedDB));
    }
    EXEC = this.exec;
    execTyped(execAsPipeline = false) {
        return this.exec(execAsPipeline);
    }
    async execAsPipeline() {
        if (this.#multi.queue.length === 0)
            return [];
        return this.#multi.transformReplies(await this.#executePipeline(this.#multi.queue, this.#selectedDB));
    }
    execAsPipelineTyped() {
        return this.execAsPipeline();
    }
}
exports.default = RedisClientMultiCommand;
//# sourceMappingURL=multi-command.js.map