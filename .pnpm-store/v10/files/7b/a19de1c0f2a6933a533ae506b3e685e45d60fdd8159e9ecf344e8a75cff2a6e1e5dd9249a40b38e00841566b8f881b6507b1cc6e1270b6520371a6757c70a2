"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns information about the function that is currently running and information about the available execution engines
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('FUNCTION', 'STATS');
    },
    transformReply: {
        2: (reply) => {
            return {
                running_script: transformRunningScript(reply[1]),
                engines: transformEngines(reply[3])
            };
        },
        3: undefined
    }
};
function transformRunningScript(reply) {
    if ((0, generic_transformers_1.isNullReply)(reply)) {
        return null;
    }
    const unwraped = reply;
    return {
        name: unwraped[1],
        command: unwraped[3],
        duration_ms: unwraped[5]
    };
}
function transformEngines(reply) {
    const unwraped = reply;
    const engines = Object.create(null);
    for (let i = 0; i < unwraped.length; i++) {
        const name = unwraped[i], stats = unwraped[++i], unwrapedStats = stats;
        engines[name.toString()] = {
            libraries_count: unwrapedStats[1],
            functions_count: unwrapedStats[3]
        };
    }
    return engines;
}
//# sourceMappingURL=FUNCTION_STATS.js.map