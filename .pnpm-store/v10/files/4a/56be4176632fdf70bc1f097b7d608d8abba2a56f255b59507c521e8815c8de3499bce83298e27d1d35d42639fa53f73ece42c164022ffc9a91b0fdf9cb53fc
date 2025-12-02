"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEvalArguments = void 0;
function parseEvalArguments(parser, script, options) {
    parser.push(script);
    if (options?.keys) {
        parser.pushKeysLength(options.keys);
    }
    else {
        parser.push('0');
    }
    if (options?.arguments) {
        parser.push(...options.arguments);
    }
}
exports.parseEvalArguments = parseEvalArguments;
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Executes a Lua script server side
     * @param parser - The Redis command parser
     * @param script - Lua script to execute
     * @param options - Script execution options including keys and arguments
     */
    parseCommand(...args) {
        args[0].push('EVAL');
        parseEvalArguments(...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=EVAL.js.map